<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRolesSchema($conn);
ensureUserAccountStatusSchema($conn);

$authUser = requireAuthenticatedUser();
$authRole = strtolower((string)($authUser['role'] ?? ''));
validateCsrfToken();

if (!in_array($authRole, ['teacher', 'admin'], true)) {
    http_response_code(403);
    echo json_encode([
        'status' => 'error',
        'message' => 'You are not allowed to reset passwords.',
    ]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim((string)($data['email'] ?? ''));
$newPassword = (string)($data['newPassword'] ?? '');

if ($email === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Email and new password are required.',
    ]);
    exit();
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Password must be at least 8 characters long.',
    ]);
    exit();
}

try {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $stmt = $conn->prepare("SELECT user_id FROM {$userTable} WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $targetUser = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$targetUser) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'User not found.',
        ]);
        exit();
    }

    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
    $update = $conn->prepare("UPDATE {$userTable} SET password = ? WHERE user_id = ?");
    $update->bind_param('si', $hashedPassword, $targetUser['user_id']);
    $update->execute();
    $update->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'Password updated successfully.',
        'email' => $email,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to reset password.',
    ]);
}
