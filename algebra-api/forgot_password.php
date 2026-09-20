<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'smtp_mailer.php';

// Load .env variables
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            putenv("{$parts[0]}={$parts[1]}");
        }
    }
}

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

    if (!$user) {
        echo json_encode([
            'status' => 'success',
            'message' => 'If an account exists with that email, a reset code has been sent.',
            'otp_sent' => false,
        ]);
        exit();
    }

    // Generate 6-digit OTP
    $otp = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

    // Add OTP columns if they don't exist
    $otpColumnCheck = $conn->query("SHOW COLUMNS FROM {$userTable} LIKE 'reset_otp'");
    if ($otpColumnCheck && $otpColumnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE {$userTable} ADD COLUMN reset_otp VARCHAR(6) NULL");
        $conn->query("ALTER TABLE {$userTable} ADD COLUMN reset_otp_expires DATETIME NULL");
    }

    // Store OTP in database
    $updateStmt = $conn->prepare("UPDATE {$userTable} SET reset_otp = ?, reset_otp_expires = ? WHERE user_id = ?");
    $updateStmt->bind_param('ssi', $otp, $expiresAt, $user['user_id']);
    $updateStmt->execute();
    $updateStmt->close();

    // Mask the email for display
    $parts = explode('@', $email);
    $name = $parts[0] ?? '';
    $domain = $parts[1] ?? '';
    $maskedName = mb_strlen($name) > 1
        ? $name[0] . str_repeat('*', max(mb_strlen($name) - 2, 3)) . (mb_strlen($name) > 1 ? substr($name, -1) : '')
        : str_repeat('*', 3);
    $maskedEmail = $maskedName . '@' . $domain;

    // Send OTP via email using SMTP
    $emailSent = false;
    $emailError = '';

    $smtpUser = getenv('SMTP_USERNAME') ?: '';
    $smtpPass = getenv('SMTP_PASSWORD') ?: '';

    if ($smtpUser && $smtpPass) {
        try {
            $mailer = SmtpMailer::fromEnv();
            $subject = 'AlgebraAssess - Your Password Reset Code';
            $htmlBody = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">AlgebraAssess</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Password Reset Code</h2>
            <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Use the code below to reset your password. It expires in 10 minutes.</p>
            <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
              <span style="font-size:32px;font-weight:bold;color:#6366f1;letter-spacing:8px;font-family:monospace;">' . $otp . '</span>
            </div>
            <p style="color:#94a3b8;margin:0;font-size:12px;">If you did not request this, please ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>';
            $plainBody = "Your password reset code is: {$otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.";

            $mailer->send($email, $subject, $htmlBody, true);
            $emailSent = true;
        } catch (Exception $e) {
            $emailError = $e->getMessage();
        }
    }

    $response = [
        'status' => 'success',
        'maskedEmail' => $maskedEmail,
        'otp_sent' => true,
    ];

    if ($emailSent) {
        $response['message'] = "A 6-digit reset code has been sent to {$maskedEmail}.";
    } elseif ($smtpUser && $smtpPass) {
        $response['message'] = 'Failed to send email: ' . ($emailError ?: 'Unknown error');
        $response['status'] = 'error';
    } else {
        // No SMTP configured — return OTP for development
        $response['message'] = "Reset code generated for {$maskedEmail}. SMTP not configured — code shown below for development.";
        $response['otp'] = $otp;
    }

    echo json_encode($response);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to process your request. Please try again later.',
    ]);
}

$conn->close();
?>