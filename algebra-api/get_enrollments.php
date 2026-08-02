<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.subject_name,
            s.join_code,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(sy.label, '') AS school_year,
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
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
         JOIN {$userTable} st ON st.user_id = e.student_user_id
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
    setCacheHeaders(60);
    echo json_encode([
        'status' => 'success',
        'enrollments' => array_values($grouped),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load enrollments.']);
}
