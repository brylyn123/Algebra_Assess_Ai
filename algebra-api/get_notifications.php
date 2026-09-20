<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$authUser = requireAuthenticatedUser();
$user_id = (int)$authUser['user_id'];

$limit = isset($_GET['limit']) ? min(max((int)$_GET['limit'], 1), 50) : 20;
$offset = isset($_GET['offset']) ? max((int)$_GET['offset'], 0) : 0;

try {
    ensureNotificationsTable($conn);

    $countStmt = $conn->prepare("SELECT COUNT(*) AS total FROM Notifications WHERE user_id = ?");
    $countStmt->bind_param('i', $user_id);
    $countStmt->execute();
    $totalRow = $countStmt->get_result()->fetch_assoc();
    $countStmt->close();
    $total = (int)($totalRow['total'] ?? 0);

    $stmt = $conn->prepare(
        "SELECT n.notification_id, n.type, n.title, n.message, n.reference_type, n.reference_id,
                n.is_read, n.created_at,
                u.first_name AS sender_first_name, u.last_name AS sender_last_name
         FROM Notifications n
         LEFT JOIN Users u ON u.user_id = n.sender_user_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?"
    );
    $stmt->bind_param('iii', $user_id, $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    $notifications = [];
    while ($row = $result->fetch_assoc()) {
        $senderName = trim(($row['sender_first_name'] ?? '') . ' ' . ($row['sender_last_name'] ?? ''));
        $notifications[] = [
            'notification_id' => (int)$row['notification_id'],
            'type' => $row['type'],
            'title' => $row['title'],
            'message' => $row['message'],
            'reference_type' => $row['reference_type'],
            'reference_id' => $row['reference_id'] !== null ? (int)$row['reference_id'] : null,
            'is_read' => (int)$row['is_read'] === 1,
            'created_at' => $row['created_at'],
            'sender_name' => $senderName ?: null,
        ];
    }
    $stmt->close();

    $unreadStmt = $conn->prepare("SELECT COUNT(*) AS unread FROM Notifications WHERE user_id = ? AND is_read = 0");
    $unreadStmt->bind_param('i', $user_id);
    $unreadStmt->execute();
    $unreadRow = $unreadStmt->get_result()->fetch_assoc();
    $unreadStmt->close();

    echo json_encode([
        'status' => 'success',
        'notifications' => $notifications,
        'total' => $total,
        'unread_count' => (int)($unreadRow['unread'] ?? 0),
        'limit' => $limit,
        'offset' => $offset,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load notifications.']);
}

$conn->close();
?>
