<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents('php://input'), true);
$token = trim((string)($data['token'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$newPassword = (string)($data['password'] ?? '');

if ($token === '' || $email === '' || $newPassword === '') {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Token, email, and new password are required.']);
    exit();
}

if (strlen($newPassword) < 8 || strlen($newPassword) > 128) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Password must be between 8 and 128 characters.']);
    exit();
}

try {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    // Check that columns exist
    $columnCheck = $conn->query("SHOW COLUMNS FROM {$userTable} LIKE 'reset_token'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Password reset is not available yet.']);
        exit();
    }

    // Find user by email and token
    $stmt = $conn->prepare("SELECT user_id, reset_token_expires FROM {$userTable} WHERE email = ? AND reset_token = ? LIMIT 1");
    $stmt->bind_param('ss', $email, $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid or expired reset link.']);
        exit();
    }

    // Check expiry
    if ($user['reset_token_expires'] && strtotime($user['reset_token_expires']) < time()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Reset link has expired. Please request a new one.']);
        exit();
    }

    // Hash new password and update
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateStmt = $conn->prepare("UPDATE {$userTable} SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?");
    $updateStmt->bind_param('si', $hashedPassword, $user['user_id']);
    $updateStmt->execute();
    $updateStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'Password has been reset successfully. You can now log in.',
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to reset password. Please try again later.',
    ]);
}

$conn->close();
