<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents('php://input'), true);
$email = trim((string)($data['email'] ?? ''));

if ($email === '') {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Email address is required.']);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Please enter a valid email address.']);
    exit();
}

try {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $stmt = $conn->prepare("SELECT user_id, email FROM {$userTable} WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    // Always return success to prevent email enumeration
    if (!$user) {
        echo json_encode([
            'status' => 'success',
            'message' => 'If an account exists with that email, a password reset link has been sent.',
        ]);
        exit();
    }

    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Store token in database (add column if needed)
    $columnCheck = $conn->query("SHOW COLUMNS FROM {$userTable} LIKE 'reset_token'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE {$userTable} ADD COLUMN reset_token VARCHAR(64) NULL");
        $conn->query("ALTER TABLE {$userTable} ADD COLUMN reset_token_expires DATETIME NULL");
    }

    $updateStmt = $conn->prepare("UPDATE {$userTable} SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?");
    $updateStmt->bind_param('ssi', $token, $expiresAt, $user['user_id']);
    $updateStmt->execute();
    $updateStmt->close();

    // For development: return token directly (remove in production, use email instead)
    echo json_encode([
        'status' => 'success',
        'message' => 'Password reset link generated.',
        'reset_token' => $token,
        'email' => $email,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to process your request. Please try again later.',
    ]);
}

$conn->close();
