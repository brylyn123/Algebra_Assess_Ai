<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRolesSchema($conn);
ensureUserAccountStatusSchema($conn);

$data = json_decode(file_get_contents("php://input"), true);
$credential = trim((string)($data['credential'] ?? ''));

if ($credential === '') {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Google credential is required."]);
    exit();
}

// Verify the Google ID token by decoding the JWT payload
// In production, verify the signature against Google's public keys
function decodeGoogleJwtPayload(string $jwt): ?array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        return null;
    }

    $payload = $parts[1];
    $payload = strtr($payload, '-_', '+/');
    $remainder = strlen($payload) % 4;
    if ($remainder) {
        $payload .= str_repeat('=', 4 - $remainder);
    }

    $decoded = base64_decode($payload, true);
    if ($decoded === false) {
        return null;
    }

    $json = json_decode($decoded, true);
    if (!is_array($json)) {
        return null;
    }

    // Basic validation: must have required Google token fields
    $requiredFields = ['iss', 'aud', 'exp', 'sub', 'email'];
    foreach ($requiredFields as $field) {
        if (empty($json[$field])) {
            return null;
        }
    }

    // Verify issuer
    $validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!in_array($json['iss'], $validIssuers, true)) {
        return null;
    }

    // Verify expiration
    if (isset($json['exp']) && $json['exp'] < time()) {
        return null;
    }

    return $json;
}

$payload = decodeGoogleJwtPayload($credential);

if (!$payload) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Invalid Google credential."]);
    exit();
}

$googleId = $payload['sub'];
$googleEmail = $payload['email'];
$googleName = $payload['name'] ?? '';
$googlePicture = $payload['picture'] ?? '';

// Extract first and last name from the Google profile
$firstName = $payload['given_name'] ?? '';
$lastName = $payload['family_name'] ?? '';

if ($firstName === '' && $lastName === '' && $googleName !== '') {
    $nameParts = explode(' ', $googleName, 2);
    $firstName = $nameParts[0] ?? '';
    $lastName = $nameParts[1] ?? '';
}

if ($firstName === '' && $lastName === '') {
    $firstName = explode('@', $googleEmail)[0] ?? 'User';
}

$userTable = resolveExistingTableName($conn, ['Users', 'users']);
$roleExpression = getUserRoleNameExpression($conn, 'u');
$roleJoin = getUserRoleJoinClause($conn, 'u');

// Check if user already exists with this Google ID or email
$stmt = $conn->prepare(
    "SELECT
        u.user_id,
        u.institutional_id,
        u.first_name AS first_Name,
        u.middle_name AS middle_Name,
        u.last_name AS last_Name,
        u.email,
        u.role_id,
        {$roleExpression} AS role,
        u.account_status,
        u.college_id,
        u.course_id,
        u.section_id,
        u.year_id,
        c.college_name AS collegeName,
        crs.course_name AS courseName,
        sec.section_name AS sectionName,
        yl.year_level AS yearLevel
     FROM {$userTable} u
     LEFT JOIN Colleges c ON c.college_id = u.college_id
     LEFT JOIN Course crs ON crs.course_id = u.course_id
     LEFT JOIN Section sec ON sec.section_id = u.section_id
     LEFT JOIN Year_Level yl ON yl.year_id = u.year_id
     {$roleJoin}
     WHERE u.email = ?
       AND u.account_status = 'active'
     LIMIT 1"
);
$stmt->bind_param("s", $googleEmail);
$stmt->execute();
$result = $stmt->get_result();
$user = $result ? $result->fetch_assoc() : null;
$stmt->close();

if ($user) {
    // User exists - log them in
    $role = $user['role'];
    $finalUser = $user;
    $finalUser['teacher_id'] = $role === 'teacher' ? (int)$user['user_id'] : null;
    $finalUser['student_id'] = $role === 'student' ? (int)$user['user_id'] : null;
    $finalUser['idNumber'] = $user['institutional_id'];
    $finalUser['firstName'] = $user['first_Name'];
    $finalUser['middleName'] = $user['middle_Name'];
    $finalUser['lastName'] = $user['last_Name'];
    $finalUser['authProvider'] = 'google';
    unset($finalUser['password']);

    setAuthenticatedUser($finalUser);

    echo json_encode(["status" => "success", "user" => $finalUser]);
} else {
    // New user - create account with default teacher role and pending status
    // Students cannot self-register via Google; teachers get auto-created with active status
    $roleId = getRoleIdByName($conn, 'teacher');
    if ($roleId === null) {
        $roleId = 1; // fallback
    }

    $institutionalId = '';
    $middleName = '';

    // Check for legacy role column
    $hasLegacyRoleColumn = schemaColumnExists($conn, $userTable, 'role');

    $conn->begin_transaction();
    try {
        ensureUserAccountStatusSchema($conn);

        if ($hasLegacyRoleColumn) {
            $insertStmt = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id, first_name, middle_name, last_name,
                    email, password, college_id, course_id, section_id, year_id,
                    role_id, account_status, role
                ) VALUES (?, ?, '', ?, ?, '', NULL, NULL, NULL, NULL, ?, 'active', 'teacher')"
            );
            $insertStmt->bind_param("ssssi", $institutionalId, $firstName, $lastName, $googleEmail, $roleId);
        } else {
            $insertStmt = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id, first_name, middle_name, last_name,
                    email, password, college_id, course_id, section_id, year_id,
                    role_id, account_status
                ) VALUES (?, ?, '', ?, ?, '', NULL, NULL, NULL, NULL, ?, 'active')"
            );
            $insertStmt->bind_param("ssssi", $institutionalId, $firstName, $lastName, $googleEmail, $roleId);
        }

        $insertStmt->execute();
        $newUserId = $conn->insert_id;
        $insertStmt->close();
        $conn->commit();

        // Log the new user in
        $newUser = [
            'user_id' => $newUserId,
            'teacher_id' => (int)$newUserId,
            'student_id' => null,
            'institutional_id' => $institutionalId,
            'firstName' => $firstName,
            'middleName' => '',
            'lastName' => $lastName,
            'email' => $googleEmail,
            'role' => 'teacher',
            'account_status' => 'active',
            'college_id' => null,
            'course_id' => null,
            'section_id' => null,
            'year_id' => null,
            'collegeName' => null,
            'courseName' => null,
            'sectionName' => null,
            'yearLevel' => null,
            'authProvider' => 'google',
        ];

        setAuthenticatedUser($newUser);

        echo json_encode(["status" => "success", "user" => $newUser]);
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to create account. Please try again."]);
    }
}
$conn->close();
?>