<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents('php://input'), true);
$email = trim((string)($data['email'] ?? ''));
$otp = trim((string)($data['otp'] ?? ''));

if ($email === '' || $otp === '') {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Email and OTP are required.']);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Please enter a valid email address.']);
    exit();
}

if (!preg_match('/^\d{6}$/', $otp)) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'OTP must be exactly 6 digits.']);
    exit();
}

try {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    // Check OTP columns exist
    $otpColumnCheck = $conn->query("SHOW COLUMNS FROM {$userTable} LIKE 'reset_otp'");
    if ($otpColumnCheck && $otpColumnCheck->num_rows === 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Password reset is not available yet.']);
        exit();
    }

    $stmt = $conn->prepare("SELECT user_id, reset_otp, reset_otp_expires FROM {$userTable} WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid email or OTP.']);
        exit();
    }

    if (empty($user['reset_otp']) || $user['reset_otp'] !== $otp) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid OTP. Please check the code and try again.']);
        exit();
    }

    if ($user['reset_otp_expires'] && strtotime($user['reset_otp_expires']) < time()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'OTP has expired. Please request a new one.']);
        exit();
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'OTP verified successfully. You can now reset your password.',
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to verify OTP. Please try again later.',
    ]);
}

$conn->close();
?>