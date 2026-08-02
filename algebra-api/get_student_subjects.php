<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('student');
$student_id = (int)$authUser['user_id'];

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
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
            COALESCE(sy.label, '') AS school_year,
            yl.year_level AS year_level,
            CASE
                WHEN e.enrollment_id IS NOT NULL THEN 1
                ELSE 0
            END AS enrolled
         FROM Subject s
         LEFT JOIN {$userTable} t ON t.user_id = s.teacher_user_id
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
    setCacheHeaders(60);
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
