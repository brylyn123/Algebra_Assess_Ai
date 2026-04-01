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
require_once 'schema_utils.php';

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
$courseId   = isset($data['courseId']) ? intval($data['courseId']) : 0;
$sectionId  = isset($data['sectionId']) ? intval($data['sectionId']) : 0;
$yearId     = isset($data['yearId']) ? intval($data['yearId']) : 0;

// 4. Start Database Transaction
$conn->begin_transaction();

try {
    if ($role === 'student') {
        ensureStudentProfileColumns($conn);
    }

    ensureRegistrationLookupData($conn);

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

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
    $collegeId = getOrCreateCollegeId($conn, $college);

    if ($role === 'teacher') {
        if ($collegeId === null) {
            throw new Exception("Please provide a college.");
        }
        $stmtProf = $conn->prepare("INSERT INTO Teacher (user_id, teacher_id, first_name, middle_name, last_name, email, college_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmtProf->bind_param("isssssi", $newUserId, $idNumber, $firstName, $middleName, $lastName, $email, $collegeId);
    } else {
        if ($collegeId === null) {
            throw new Exception("Please provide a college.");
        }
        if ($courseId <= 0 || $sectionId <= 0 || $yearId <= 0) {
            throw new Exception("Please choose a college, course, section, and year level.");
        }

        $courseStmt = $conn->prepare("SELECT course_id FROM {$courseTable} WHERE course_id = ? LIMIT 1");
        $courseStmt->bind_param("i", $courseId);
        $courseStmt->execute();
        $courseResult = $courseStmt->get_result();
        $courseRow = $courseResult ? $courseResult->fetch_assoc() : null;
        if (!$courseRow) {
            $courseStmt->close();
            throw new Exception("Selected course was not found.");
        }
        $courseStmt->close();

        $courseCollegeStmt = $conn->prepare("SELECT college_id FROM {$courseTable} WHERE course_id = ? LIMIT 1");
        $courseCollegeStmt->bind_param("i", $courseId);
        $courseCollegeStmt->execute();
        $courseCollegeResult = $courseCollegeStmt->get_result();
        $courseCollegeRow = $courseCollegeResult ? $courseCollegeResult->fetch_assoc() : null;
        $courseCollegeStmt->close();

        $courseCollegeId = $courseCollegeRow && $courseCollegeRow['college_id'] !== null
            ? (int)$courseCollegeRow['college_id']
            : null;

        if ($courseCollegeId === null) {
            $updateCourseCollegeStmt = $conn->prepare("UPDATE {$courseTable} SET college_id = ? WHERE course_id = ? AND college_id IS NULL");
            $updateCourseCollegeStmt->bind_param("ii", $collegeId, $courseId);
            $updateCourseCollegeStmt->execute();
            $updateCourseCollegeStmt->close();
        } elseif ($courseCollegeId !== $collegeId) {
            throw new Exception("Selected course does not belong to the chosen college.");
        }

        $sectionStmt = $conn->prepare("SELECT section_id FROM {$sectionTable} WHERE section_id = ? LIMIT 1");
        $sectionStmt->bind_param("i", $sectionId);
        $sectionStmt->execute();
        $sectionResult = $sectionStmt->get_result();
        if (!$sectionResult || $sectionResult->num_rows === 0) {
            $sectionStmt->close();
            throw new Exception("Selected section was not found.");
        }
        $sectionStmt->close();

        $yearStmt = $conn->prepare("SELECT year_id FROM {$yearTable} WHERE year_id = ? LIMIT 1");
        $yearStmt->bind_param("i", $yearId);
        $yearStmt->execute();
        $yearResult = $yearStmt->get_result();
        if (!$yearResult || $yearResult->num_rows === 0) {
            $yearStmt->close();
            throw new Exception("Selected year level was not found.");
        }
        $yearStmt->close();

        $stmtProf = $conn->prepare(
            "INSERT INTO Student (
                user_id,
                student_id,
                first_name,
                middle_name,
                last_name,
                email,
                college_id,
                course_id,
                section_id,
                year_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtProf->bind_param(
            "isssssiiii",
            $newUserId,
            $idNumber,
            $firstName,
            $middleName,
            $lastName,
            $email,
            $collegeId,
            $courseId,
            $sectionId,
            $yearId
        );
    }
$stmtProf->execute();

    // Commit changes
    $conn->commit();
    echo json_encode([
        "status" => "success",
        "message" => "Account created successfully!",
        "user_id" => $newUserId,
        "role" => $role,
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
