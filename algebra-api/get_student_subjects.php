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

$student_id = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;
if (!$student_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student ID is required.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.join_code,
            s.archived AS status,
            s.subject_name,
            CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
            s.course,
            s.section,
            s.semester,
            s.school_year,
            s.year,
            CASE
                WHEN e.enrollment_id IS NOT NULL THEN 1
                ELSE 0
            END AS enrolled
         FROM Subject s
         LEFT JOIN Teacher t ON t.teacher_id = s.teacher_id
         LEFT JOIN Enrollment e ON e.$enrollmentCol = s.subject_id AND e.student_id = ?
         WHERE s.archived = 0
         ORDER BY s.subject_name ASC"
    );
    $stmt->bind_param("i", $student_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $subjects = [];
    $enrolledSubjects = [];
    $availableSubjects = [];
    while ($row = $result->fetch_assoc()) {
        $entry = [
            'subject_id' => (int)$row['subject_id'],
            'join_code' => $row['join_code'],
            'status' => $row['status'],
            'subject_name' => $row['subject_name'],
            'subject_code' => $row['join_code'],
            'teacher_name' => trim((string)$row['teacher_name']),
            'course' => $row['course'] ?? '',
            'section_name' => $row['section'],
            'semester' => $row['semester'],
            'school_year' => $row['school_year'],
            'year_level' => $row['year'],
            'enrolled' => (bool)$row['enrolled'],
        ];

        if ((bool)$row['enrolled']) {
            $enrolledSubjects[] = $entry;
        } else {
            $availableSubjects[] = $entry;
        }
    }

    $stmt->close();
    echo json_encode([
        'status' => 'success',
        'enrolled_subjects' => $enrolledSubjects,
        'available_subjects' => $availableSubjects,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load subjects: ' . $e->getMessage()]);
}
