<?php
require_once 'cors.php';
require_once 'db_connection.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

function respond_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $message]);
    exit();
}

$data = json_decode(file_get_contents('php://input'));
if (!$data) respond_error('Invalid JSON payload.');

// Extract data from React
$role = strtolower(trim($data->role));
$email = trim($data->email);
$password = trim($data->password);
$firstName = trim($data->firstName);
$middleName = trim($data->middleName ?? '');
$lastName = trim($data->lastName);
$idNumber = trim($data->idNumber); // This is Student ID or Employee ID

// 1. Check if user already exists in the 'users' table
$checkStmt = $conn->prepare('SELECT user_id FROM users WHERE username = ?');
$checkStmt->bind_param('s', $email);
$checkStmt->execute();
if ($checkStmt->get_result()->num_rows > 0) {
    respond_error('An account with this email already exists.');
}

// 2. Start Transaction to ensure both tables are updated or none at all
$conn->begin_transaction();

try {
    // A. Insert into "users" table (Login Credentials)
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $userStmt = $conn->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    $userStmt->bind_param('sss', $email, $passwordHash, $role);
    $userStmt->execute();

    $newUserId = $conn->insert_id; // The link for the Foreign Key

    // B. Insert into the specific profile table based on Role
    if ($role === 'teacher') {
        // Based on your UI/ERD for Teachers
        // Note: You may need to fetch the numeric college_id based on $data->collegeName
        $collegeId = 1; // Default or Lookup logic here
        
        $stmt = $conn->prepare("INSERT INTO Teacher (teacher_id, first_name, middle_name, last_name, email, password, college_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('ssssssii', $idNumber, $firstName, $middleName, $lastName, $email, $passwordHash, $collegeId, $newUserId);
    } 
    else if ($role === 'student') {
        // Based on your UI/ERD for Students
        // Note: You may need to fetch numeric IDs for section_id and year_id
        $sectionId = 1; 
        $yearId = 1;

        $stmt = $conn->prepare("INSERT INTO Student (student_id, first_name, middle_name, last_name, user_id, section_id, year_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('ssssiii', $idNumber, $firstName, $middleName, $lastName, $newUserId, $sectionId, $yearId);
    }

    $stmt->execute();
    
    // Commit the changes
    $conn->commit();
    echo json_encode(['status' => 'success', 'message' => 'Registration successful!']);

} catch (Exception $e) {
    $conn->rollback(); 
    respond_error('Database error: ' . $e->getMessage(), 500);
}