<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'rate_limiter.php';

ensureRolesSchema($conn);
ensureUserAccountStatusSchema($conn);

$clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$loginIpHash = crc32($clientIp);
rateLimitOrDie($conn, abs($loginIpHash), 'login', 10, 900);

$userTable = resolveExistingTableName($conn, ['Users', 'users']);
$roleExpression = getUserRoleNameExpression($conn, 'u');
$roleJoin = getUserRoleJoinClause($conn, 'u');

$data = json_decode(file_get_contents("php://input"), true);
$email = trim((string)($data['email'] ?? ''));
$password = $data['password'] ?? '';

try {
    $stmt = $conn->prepare(
        "SELECT
            u.user_id,
            u.institutional_id,
            u.first_name AS first_Name,
            u.middle_name AS middle_Name,
            u.last_name AS last_Name,
            u.email,
            u.password,
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
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($user = $result->fetch_assoc()) {
        $storedPassword = (string)($user['password'] ?? '');
        $isPasswordValid = password_verify($password, $storedPassword);
        $needsRehash = password_needs_rehash($storedPassword, PASSWORD_BCRYPT);

        if (!$isPasswordValid) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Incorrect password."]);
            exit();
        }

        if ($needsRehash) {
            $rehash = password_hash($password, PASSWORD_BCRYPT);
            $update = $conn->prepare("UPDATE {$userTable} SET password = ? WHERE user_id = ?");
            $update->bind_param("si", $rehash, $user['user_id']);
            $update->execute();
            $update->close();
        }

        $role = $user['role'];
        $finalUser = $user;
        $finalUser['teacher_id'] = $role === 'teacher' ? (int)$user['user_id'] : null;
        $finalUser['student_id'] = $role === 'student' ? (int)$user['user_id'] : null;
        $finalUser['idNumber'] = $user['institutional_id'];
        $finalUser['firstName'] = $user['first_Name'];
        $finalUser['middleName'] = $user['middle_Name'];
        $finalUser['lastName'] = $user['last_Name'];
        unset($finalUser['password']);

        setAuthenticatedUser($finalUser);

        echo json_encode(["status" => "success", "user" => $finalUser]);
    } else {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Active account not found."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal error occurred."]);
}
?>
