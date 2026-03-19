<?php
// 1. CORS Headers - MUST BE AT THE VERY TOP
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

// 2. Handle the "Preflight" OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';

// 3. Get the JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "No data provided."]);
    exit();
}

// Extract variables from the React payload
$firstName  = $data['firstName'] ?? '';
$middleName = $data['middleName'] ?? '';
$lastName   = $data['lastName'] ?? '';
$email      = $data['email'] ?? '';
$password = password_hash($data['password'] ?? '', PASSWORD_BCRYPT); // In production, use password_hash()
$role       = $data['role'] ?? '';
$idNumber   = $data['idNumber'] ?? '';
$college    = trim($data['collegeName'] ?? '');
$section    = $data['sectionName'] ?? ''; // Student only
$yearLevel  = $data['yearLevel'] ?? '';   // Student only

// 4. Start Database Transaction
$conn->begin_transaction();

try {
    // Check if email exists
    $check = $conn->prepare("SELECT email FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        throw new Exception("Email already registered.");
    }

    // Insert into 'users' table
    // 1. Insert into 'users' (Security only)
    $stmtUser = $conn->prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)");
    $stmtUser->bind_param("sss", $email, $password, $role);
    $stmtUser->execute();
    $newUserId = $conn->insert_id;

    // 2. Insert into profile table (Identity + Linking)
   // If your database uses lowercase 'firstname', etc.
    if ($role === 'teacher') {
        $collegeId = null;
        if ($college !== '') {
            $lookupCollege = $conn->prepare("SELECT college_id FROM College WHERE college_name = ?");
            $lookupCollege->bind_param("s", $college);
            $lookupCollege->execute();
            $collegeResult = $lookupCollege->get_result();
            if ($row = $collegeResult->fetch_assoc()) {
                $collegeId = (int)$row['college_id'];
            } else {
                $newCollegeId = $conn->query("SELECT COALESCE(MAX(college_id), 0) + 1 AS next_id FROM College")->fetch_assoc()['next_id'] ?? 1;
                $insertCollege = $conn->prepare("INSERT INTO College (college_id, college_name) VALUES (?, ?)");
                $insertCollege->bind_param("is", $newCollegeId, $college);
                $insertCollege->execute();
                $insertCollege->close();
                $collegeId = $newCollegeId;
            }
            $lookupCollege->close();
        }
        $stmtProf = $conn->prepare("INSERT INTO teacher (user_id, teacher_id, first_name, middle_name, last_name, college_id) VALUES (?, ?, ?, ?, ?, ?)");
        $stmtProf->bind_param("issssi", $newUserId, $idNumber, $firstName, $middleName, $lastName, $collegeId);
    } else {
        $stmtProf = $conn->prepare("INSERT INTO student (user_id, student_id, first_name, middle_name, last_name) VALUES (?, ?, ?, ?, ?)");
        $stmtProf->bind_param("issss", $newUserId, $idNumber, $firstName, $middleName, $lastName);
    }
$stmtProf->execute();

    // Commit changes
    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Account created successfully!"]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
