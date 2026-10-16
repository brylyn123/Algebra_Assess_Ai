<?php
// Test: enqueue notification emails and drain them through processEmailQueue()
require_once __DIR__ . '/algebra-api/notifications_helper.php';

$to = $argv[1] ?? (getenv('SMTP_USERNAME') ?: '');
$count = isset($argv[2]) ? max(1, (int)$argv[2]) : 3;
if ($to === '') {
    echo "No recipient given and SMTP_USERNAME not set.\n";
    exit(1);
}

global $conn;

// Clean up rows from previous test runs (subject prefix is unique to this test)
$conn->query("DELETE FROM email_queue WHERE subject LIKE '[AlgebraAssess] Test: Grade Returned%'");

// 1. Enqueue — must be fast (this is what API requests do now)
$start = microtime(true);
for ($i = 1; $i <= $count; $i++) {
    sendNotificationEmail(
        $to,
        'grade_returned',
        "Test: Grade Returned {$i}/{$count}",
        "Queue test email {$i} of {$count} from AlgebraAssess."
    );
}
$enqueueMs = round((microtime(true) - $start) * 1000, 1);
echo "Enqueued {$count} email(s) in {$enqueueMs}ms (API response would return immediately)\n";

// 2. Drain — background delivery
$start = microtime(true);
$sent = processEmailQueue($count + 5);
$sendS = round(microtime(true) - $start, 2);
echo "processEmailQueue sent {$sent} email(s) in {$sendS}s\n";

// 3. Verify queue statuses
$res = $conn->query("SELECT status, COUNT(*) AS cnt FROM email_queue GROUP BY status");
$counts = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $counts[$row['status']] = (int)$row['cnt'];
    }
    $res->free();
}
echo "Queue status: " . json_encode($counts) . "\n";

$ok = $sent === $count;
echo $ok ? "OK: all test emails delivered\n" : "FAILED: expected {$sent} === {$count}\n";
exit($ok ? 0 : 1);
