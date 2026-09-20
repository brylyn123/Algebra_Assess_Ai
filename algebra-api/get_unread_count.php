<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$authUser = requireAuthenticatedUser();
$user_id = (int)$authUser['user_id'];

try {
    ensureNotificationsTable($conn);

    $stmt = $conn->prepare("SELECT COUNT(*) AS unread FROM Notifications WHERE user_id = ? AND is_read = 0");
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    echo json_encode([
        'status' => 'success',
        'unread_count' => (int)($row['unread'] ?? 0),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to get unread count.']);
}

$conn->close();
?>
