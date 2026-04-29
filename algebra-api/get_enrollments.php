<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

require_once 'db_connection.php';
require_once 'schema_utils.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Teacher ID is required.']);
    exit;
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.subject_name,
            s.join_code,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            s.semester,
            s.school_year,
            e.enrollment_id,
            st.institutional_id AS student_id,
            e.student_user_id,
            e.enrollment_status,
            e.date_enrolled,
            CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name
         FROM Enrollment e
         JOIN Subject s ON s.subject_id = e.{$enrollmentCol}
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         JOIN Users st ON st.user_id = e.student_user_id AND st.role = 'student'
         WHERE s.teacher_user_id = ?
         ORDER BY s.subject_name ASC, e.date_enrolled DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $grouped = [];
    while ($row = $result->fetch_assoc()) {
        $subjectId = (int)$row['subject_id'];
        if (!isset($grouped[$subjectId])) {
            $grouped[$subjectId] = [
                'subject_id' => $subjectId,
                'subject_name' => $row['subject_name'] ?? '',
                'join_code' => $row['join_code'] ?? '',
                'course' => $row['course'] ?? '',
                'section' => $row['section'] ?? '',
                'semester' => $row['semester'] ?? '',
                'school_year' => $row['school_year'] ?? '',
                'students' => [],
            ];
        }

        $grouped[$subjectId]['students'][] = [
            'enrollment_id' => (int)$row['enrollment_id'],
            'student_id' => $row['student_id'],
            'student_user_id' => isset($row['student_user_id']) ? (int)$row['student_user_id'] : null,
            'student_name' => trim((string)$row['student_name'] ?? ''),
            'enrollment_status' => $row['enrollment_status'] ?? 'enrolled',
            'date_enrolled' => $row['date_enrolled'],
        ];
    }

    $stmt->close();
    echo json_encode([
        'status' => 'success',
        'enrollments' => array_values($grouped),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load enrollments: ' . $e->getMessage()]);
}
