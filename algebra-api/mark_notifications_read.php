<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$authUser = requireAuthenticatedUser();
$user_id = (int)$authUser['user_id'];

$data = json_decode(file_get_contents("php://input"), true);
$notificationIds = $data['notification_ids'] ?? [];
$markAll = !empty($data['mark_all']);

try {
    ensureNotificationsTable($conn);

    if ($markAll) {
        $stmt = $conn->prepare("UPDATE Notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
    } elseif (!empty($notificationIds) && is_array($notificationIds)) {
        $ids = array_map('intval', $notificationIds);
        $ids = array_filter($ids, fn($id) => $id > 0);
        if (empty($ids)) {
            echo json_encode(['status' => 'success', 'message' => 'No notifications to update.', 'updated' => 0]);
            exit;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $types = str_repeat('i', count($ids)) . 'i';
        $params = array_merge($ids, [$user_id]);

        $stmt = $conn->prepare("UPDATE Notifications SET is_read = 1 WHERE notification_id IN ($placeholders) AND user_id = ?");
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Provide notification_ids or set mark_all to true.']);
        exit;
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Notifications marked as read.',
        'updated' => $affected,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to update notifications.']);
}

$conn->close();
?>
