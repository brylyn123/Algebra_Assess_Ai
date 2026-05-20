<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRolesSchema($conn);
ensureUserAccountStatusSchema($conn);

$roleExpression = getUserRoleNameExpression($conn, 'u');
$roleJoin = getUserRoleJoinClause($conn, 'u');

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';
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
         FROM users u
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
        if (password_verify($password, $user['password'])) {
            $role = $user['role'];
            $finalUser = $user;
            $finalUser['teacher_id'] = $role === 'teacher' ? (int)$user['user_id'] : null;
            $finalUser['student_id'] = $role === 'student' ? (int)$user['user_id'] : null;
            $finalUser['idNumber'] = $user['institutional_id'];
            $finalUser['firstName'] = $user['first_Name'];
            $finalUser['middleName'] = $user['middle_Name'];
            $finalUser['lastName'] = $user['last_Name'];
            unset($finalUser['password']);

            echo json_encode(["status" => "success", "user" => $finalUser]);
        } else {
            echo json_encode(["status" => "error", "message" => "Incorrect password."]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Active account not found."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Server Error: " . $e->getMessage()]);
}
?>
