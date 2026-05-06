<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_connect.php';
require_once 'schema_utils.php';

function ensureArchivedColumn($conn) {
    $columnCheck = $conn->query("SHOW COLUMNS FROM subject LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE subject ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "No teacher ID provided"]);
    exit;
}

try {
    ensureArchivedColumn($conn);
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    // Select subjects for this specific teacher
    $stmt = $conn->prepare(
        "SELECT
            s.*,
            COALESCE(sy.label, s.school_year) AS school_year,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            yl.year_level AS year
         FROM subject s
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
    echo json_encode($subjects);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
