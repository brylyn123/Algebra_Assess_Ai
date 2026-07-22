<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

function ensureArchivedColumn($conn) {
    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    $columnCheck = $conn->query("SHOW COLUMNS FROM {$subjectTable} LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE {$subjectTable} ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    ensureArchivedColumn($conn);
    ensureSubjectLookupColumns($conn);
    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    // Select subjects for this specific teacher
    $stmt = $conn->prepare(
        "SELECT
            s.*,
            COALESCE(sy.label, '') AS school_year,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            yl.year_level AS year
         FROM {$subjectTable} s
         LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
         WHERE s.teacher_user_id = ? AND s.archived = 0
         ORDER BY s.subject_id DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $subjects = $result->fetch_all(MYSQLI_ASSOC);
    echo json_encode(['status' => 'success', 'data' => $subjects]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to load subjects."]);
}
?>
