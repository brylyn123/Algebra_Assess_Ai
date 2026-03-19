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

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';

try {
    // 1. SEARCH THE USERS TABLE ONLY (Security)
    // We do NOT select 'firstname' here because it doesn't exist in 'users'
    $stmt = $conn->prepare("SELECT user_id, email, password, role FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($user = $result->fetch_assoc()) {
        // 2. VERIFY HASHED PASSWORD
        if (password_verify($password, $user['password'])) {
            
            $userId = $user['user_id'];
            $role = $user['role'];
            $profileData = [];

            // 3. SEARCH THE PROFILE TABLE (Identity)
            // We use 'AS' to map your lowercase DB columns to the camelCase React needs
            if ($role === 'teacher') {
                $profile = $conn->prepare("SELECT teacher_id, first_name AS first_Name, middle_name AS middle_Name, last_name AS last_Name, college_id FROM teacher WHERE user_id = ?");
            } else {
                $profile = $conn->prepare("SELECT first_name AS first_Name, middle_name AS middle_Name, last_name AS last_Name, section_id, year_id FROM student WHERE user_id = ?");
            }
            
            $profile->bind_param("i", $userId);
            $profile->execute();
            $profileData = $profile->get_result()->fetch_assoc();

            // 4. MERGE DATA AND SEND TO REACT
            $finalUser = array_merge($user, $profileData ? $profileData : []);
            unset($finalUser['password']); // Safety first!

            echo json_encode(["status" => "success", "user" => $finalUser]);
        } else {
            echo json_encode(["status" => "error", "message" => "Incorrect password."]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Email not found."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Server Error: " . $e->getMessage()]);
}
?>
