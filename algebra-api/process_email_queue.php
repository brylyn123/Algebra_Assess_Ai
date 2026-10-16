<?php
/**
 * Drains the notification email queue.
 *
 * Usage (CLI):
 *   php process_email_queue.php          # send up to 200 pending emails
 *   php process_email_queue.php 500      # send up to 500 pending emails
 *
 * The app also delivers queued emails automatically from its notification
 * poll endpoints (get_unread_count.php / get_notifications.php). This script
 * is a safety net for delivering emails when nobody has the app open, and can
 * be scheduled with Windows Task Scheduler (or cron on Linux), e.g. every 1 minute.
 *
 * HTTP access is disabled on purpose; run it from the CLI only.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'CLI only.']);
    exit(1);
}

require_once __DIR__ . '/notifications_helper.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 200;

$sent = processEmailQueue($limit);

// Report what is left
global $conn;
$pending = 0;
$failed = 0;
if ($conn instanceof mysqli) {
    ensureEmailQueueTable($conn);
    $res = $conn->query("SELECT status, COUNT(*) AS cnt FROM email_queue GROUP BY status");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            if ($row['status'] === 'pending') { $pending = (int)$row['cnt']; }
            if ($row['status'] === 'failed') { $failed = (int)$row['cnt']; }
        }
        $res->free();
    }
    $conn->close();
}

echo "Sent: {$sent} | Still pending: {$pending} | Failed: {$failed}\n";
exit($failed > 0 ? 1 : 0);
