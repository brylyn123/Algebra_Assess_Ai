<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/schema_utils.php';

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

    $senderInt = $senderVal !== null ? (int)$senderVal : 0;
    $refIdInt = $refIdVal !== null ? (int)$refIdVal : 0;
    $types = 'iiisssi';
    $stmt->bind_param($types, $userId, $senderInt, $type, $title, $message, $refTypeVal, $refIdInt);

    $result = $stmt->execute();
    if (!$result) {
        error_log('Notification execute failed: ' . $stmt->error);
    }
    $stmt->close();
    return $result;
}

function sendNotificationEmail(string $toEmail, string $type, string $title, string $message): bool {
    if (empty($toEmail)) {
        return false;
    }

    $siteName = 'AlgebraAssess';
    $subject = "[{$siteName}] {$title}";

    $typeLabel = match ($type) {
        'assessment_created' => 'New Assessment',
        'assessment_submitted' => 'New Submission',
        'grade_returned' => 'Grade Returned',
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

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        "From: {$siteName} <noreply@" . ($_SERVER['SERVER_NAME'] ?? 'algebraassess.local') . '>',
    ];

    return @mail($toEmail, $subject, $htmlBody, implode("\r\n", $headers));
}
