<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);
$student_id = isset($data['student_id']) ? intval($data['student_id']) : null;
$join_code = isset($data['join_code']) ? trim($data['join_code']) : '';

if (!$student_id || $join_code === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student ID and join code are required.']);
    exit();
}

try {
    $subjectStmt = $conn->prepare(
        "SELECT subject_id FROM Subject WHERE join_code = ? AND archived = 0 LIMIT 1"
    );
    $subjectStmt->bind_param("s", $join_code);
    $subjectStmt->execute();
    $subjectResult = $subjectStmt->get_result();
    $subject = $subjectResult ? $subjectResult->fetch_assoc() : null;
    $subjectStmt->close();

    if (!$subject) {
        throw new Exception('No active subject matches that code.');
    }

    $subject_id = (int)$subject['subject_id'];

    $enrollmentCol = getEnrollmentSubjectColumn($conn);

    $checkStmt = $conn->prepare(
        "SELECT enrollment_id FROM Enrollment WHERE student_id = ? AND $enrollmentCol = ? LIMIT 1"
    );
    $checkStmt->bind_param("ii", $student_id, $subject_id);
    $checkStmt->execute();
    $existing = $checkStmt->get_result();
    $already = $existing && $existing->num_rows > 0;
    $checkStmt->close();

    if ($already) {
        echo json_encode(['status' => 'success', 'message' => 'You are already enrolled in this subject.']);
        exit();
    }

    $insertStmt = $conn->prepare(
        "INSERT INTO Enrollment (student_id, $enrollmentCol) VALUES (?, ?)"
    );
    $insertStmt->bind_param("ii", $student_id, $subject_id);
    $insertStmt->execute();
    $insertStmt->close();

    echo json_encode(['status' => 'success', 'message' => 'Enrollment complete!']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to enroll: ' . $e->getMessage()]);
}
