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
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.join_code,
            s.archived AS status,
            s.subject_name,
            CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(sy.label, s.school_year) AS school_year,
            yl.year_level AS year_level,
            CASE
                WHEN e.enrollment_id IS NOT NULL THEN 1
                ELSE 0
            END AS enrolled
         FROM Subject s
         LEFT JOIN Users t ON t.user_id = s.teacher_user_id AND t.role = 'teacher'
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
         LEFT JOIN Enrollment e ON e.$enrollmentCol = s.subject_id AND e.student_user_id = ?
         ORDER BY s.subject_name ASC"
    );
    $stmt->bind_param("i", $student_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $subjects = [];
    $enrolledSubjects = [];
    $availableSubjects = [];
    $archivedSubjects = [];
    while ($row = $result->fetch_assoc()) {
        $entry = [
            'subject_id' => (int)$row['subject_id'],
            'join_code' => $row['join_code'],
            'status' => (int)$row['status'],
            'archived' => (bool)$row['status'],
            'subject_name' => $row['subject_name'],
            'subject_code' => $row['join_code'],
            'teacher_name' => trim((string)$row['teacher_name']),
            'course' => $row['course'] ?? '',
            'section_name' => $row['section'],
            'semester' => $row['semester'],
            'school_year' => $row['school_year'],
            'year_level' => $row['year_level'],
            'enrolled' => (bool)$row['enrolled'],
        ];

        if ((bool)$row['enrolled'] && (bool)$row['status']) {
            $archivedSubjects[] = $entry;
        } elseif ((bool)$row['enrolled']) {
            $enrolledSubjects[] = $entry;
        } elseif (!(bool)$row['status']) {
            $availableSubjects[] = $entry;
        }
    }

    $stmt->close();
    echo json_encode([
        'status' => 'success',
        'enrolled_subjects' => $enrolledSubjects,
        'archived_subjects' => $archivedSubjects,
        'available_subjects' => $availableSubjects,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load subjects: ' . $e->getMessage()]);
}
