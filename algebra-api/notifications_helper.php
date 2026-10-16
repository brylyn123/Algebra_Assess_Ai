<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/schema_utils.php';
require_once __DIR__ . '/smtp_mailer.php';

function createNotification(
    mysqli $conn,
    int $userId,
    ?int $senderUserId,
    string $type,
    string $title,
    string $message,
    ?string $referenceType = null,
    ?int $referenceId = null
): bool {
    ensureNotificationsTable($conn);

    $senderVal = $senderUserId ?? null;
    $refTypeVal = $referenceType ?? null;
    $refIdVal = $referenceId ?? null;

    $stmt = $conn->prepare(
        "INSERT INTO Notifications (user_id, sender_user_id, type, title, message, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    if (!$stmt) {
        error_log('Notification prepare failed: ' . $conn->error);
        return false;
    }

    $senderInt = $senderVal !== null ? (int)$senderVal : null;
    $refIdInt = $refIdVal !== null ? (int)$refIdVal : null;
    $types = 'iissssi';
    $stmt->bind_param($types, $userId, $senderInt, $type, $title, $message, $refTypeVal, $refIdInt);

    $result = $stmt->execute();
    if (!$result) {
        error_log('Notification execute failed: ' . $stmt->error);
    }
    $stmt->close();
    return $result;
}

function sendNotificationEmail(string $toEmail, string $type, string $title, string $message): bool {
    global $conn;

    if (empty($toEmail) || !($conn instanceof mysqli)) {
        return false;
    }

    $siteName = 'AlgebraAssess';
    $subject = "[{$siteName}] {$title}";

    $typeLabel = match ($type) {
        'assessment_created' => 'New Assessment',
        'assessment_submitted' => 'New Submission',
        'grade_returned' => 'Grade Returned',
        'grade_updated' => 'Grade Updated',
        'grade_reset' => 'Grade Reset',
        default => 'Notification',
    };

    $htmlBody = "
    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
        <div style='background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;'>
            <h1 style='color: white; margin: 0; font-size: 20px;'>{$siteName}</h1>
            <p style='color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 12px;'>{$typeLabel}</p>
        </div>
        <div style='background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;'>
            <h2 style='color: #1e293b; margin: 0 0 12px; font-size: 16px;'>{$title}</h2>
            <p style='color: #475569; margin: 0 0 16px; font-size: 14px; line-height: 1.5;'>{$message}</p>
            <p style='color: #94a3b8; margin: 0; font-size: 12px;'>This is an automated notification from {$siteName}.</p>
        </div>
    </div>";

    // Fast path: queue the email instead of sending it inline, so API
    // responses (e.g. Return All on a large class) never wait on SMTP.
    // processEmailQueue() delivers queued emails from lightweight poll
    // endpoints and the CLI drain script.
    try {
        ensureEmailQueueTable($conn);
        $stmt = $conn->prepare(
            "INSERT INTO email_queue (to_email, type, subject, html_body) VALUES (?, ?, ?, ?)"
        );
        if (!$stmt) {
            error_log('Email queue prepare failed: ' . $conn->error);
            return false;
        }
        $stmt->bind_param('ssss', $toEmail, $type, $subject, $htmlBody);
        $result = $stmt->execute();
        if (!$result) {
            error_log('Email queue insert failed: ' . $stmt->error);
        }
        $stmt->close();
        return (bool)$result;
    } catch (Throwable $e) {
        error_log('Email queue enqueue failed for ' . $toEmail . ': ' . $e->getMessage());
        return false;
    }
}

function processEmailQueue(int $limit = 30): int {
    global $conn;

    if (!($conn instanceof mysqli) || $limit < 1) {
        return 0;
    }

    // Sending is slower than enqueueing; allow the batch to finish
    @set_time_limit(120);

    try {
        ensureEmailQueueTable($conn);

        // Recover rows stuck in 'sending' (e.g. process killed mid-send)
        $conn->query("UPDATE email_queue SET status = 'pending'
                      WHERE status = 'sending' AND updated_at < (NOW() - INTERVAL 10 MINUTE)");

        $limit = min($limit, 200);
        $res = $conn->query(
            "SELECT id, to_email, subject, html_body, attempts
             FROM email_queue
             WHERE status = 'pending' AND attempts < 3
             ORDER BY id ASC
             LIMIT {$limit}"
        );
        if (!$res || $res->num_rows === 0) {
            return 0;
        }

        // Atomically claim rows so concurrent requests never double-send
        $batch = [];
        $claimStmt = $conn->prepare(
            "UPDATE email_queue SET status = 'sending', attempts = attempts + 1
             WHERE id = ? AND status = 'pending'"
        );
        while ($row = $res->fetch_assoc()) {
            $rowId = (int)$row['id'];
            $claimStmt->bind_param('i', $rowId);
            $claimStmt->execute();
            if ($claimStmt->affected_rows === 1) {
                $batch[] = $row;
            }
        }
        $claimStmt->close();
        $res->free();

        if (empty($batch)) {
            return 0;
        }

        $smtpConfigured = (getenv('SMTP_USERNAME') ?: '') !== '' && (getenv('SMTP_PASSWORD') ?: '') !== '';
        $errors = [];

        if ($smtpConfigured) {
            $messages = [];
            foreach ($batch as $row) {
                $messages[] = [
                    'to' => $row['to_email'],
                    'subject' => $row['subject'],
                    'body' => $row['html_body'],
                    'is_html' => true,
                ];
            }
            try {
                $mailer = SmtpMailer::fromEnv();
                $errors = $mailer->sendBatch($messages);
            } catch (Throwable $e) {
                $errors = array_fill(0, count($batch), $e->getMessage());
            }
        } else {
            // Legacy fallback for environments without SMTP credentials
            $headers = [
                'MIME-Version: 1.0',
                'Content-type: text/html; charset=UTF-8',
                'From: AlgebraAssess <noreply@' . ($_SERVER['SERVER_NAME'] ?? 'algebraassess.local') . '>',
            ];
            foreach ($batch as $idx => $row) {
                $errors[$idx] = @mail($row['to_email'], $row['subject'], $row['html_body'], implode("\r\n", $headers))
                    ? null
                    : 'mail() failed (no SMTP configured)';
            }
        }

        $sentCount = 0;
        foreach ($batch as $idx => $row) {
            $rowId = (int)$row['id'];
            // null = success; only fall back when the index is missing entirely
            $error = array_key_exists($idx, $errors) ? $errors[$idx] : 'missing result';

            if ($error === null) {
                $upd = $conn->prepare(
                    "UPDATE email_queue SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = ?"
                );
                $upd->bind_param('i', $rowId);
                $upd->execute();
                $upd->close();
                $sentCount++;
            } else {
                $failedAfter = ((int)$row['attempts']) + 1 >= 3;
                $status = $failedAfter ? 'failed' : 'pending';
                $errMsg = mb_substr((string)$error, 0, 500);
                $upd = $conn->prepare(
                    "UPDATE email_queue SET status = ?, last_error = ? WHERE id = ?"
                );
                $upd->bind_param('ssi', $status, $errMsg, $rowId);
                $upd->execute();
                $upd->close();
                error_log("Email queue send failed for {$row['to_email']} (attempt " . (((int)$row['attempts']) + 1) . "): {$error}");
            }
        }

        return $sentCount;
    } catch (Throwable $e) {
        error_log('processEmailQueue failed: ' . $e->getMessage());
        return 0;
    }
}
