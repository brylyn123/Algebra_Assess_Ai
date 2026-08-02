<?php
require_once 'cors.php';
require_once 'schema_utils.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.teacher_user_id AS teacher_id,
            s.teacher_user_id,
            s.subject_name,
            s.course_id,
            s.section_id,
            s.year_id,
            COALESCE(sy.label, '') AS school_year,
            COALESCE(sem.semester_name, s.semester) AS semester,
            s.join_code,
            s.archived,
            COALESCE(c.course_code, c.course_name) AS course,
            yl.year_level AS year,
            sec.section_name AS section
         FROM Subject s
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
         WHERE s.teacher_user_id = ? AND s.archived = 1
         ORDER BY s.subject_id DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $archived = $result->fetch_all(MYSQLI_ASSOC);
    setCacheHeaders(60);
    echo json_encode(['status' => 'success', 'data' => $archived]);
    $stmt->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to load archived subjects."]);
}

$conn->close();
?>
