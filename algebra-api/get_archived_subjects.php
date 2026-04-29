<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.teacher_user_id AS teacher_id,
            s.teacher_user_id,
            s.subject_name,
            s.course_id,
            s.section_id,
            s.year_id,
            s.school_year,
            s.semester,
            s.join_code,
            s.archived,
            COALESCE(c.course_code, c.course_name) AS course,
            yl.year_level AS year,
            sec.section_name AS section
         FROM Subject s
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         WHERE s.teacher_user_id = ? AND s.archived = 1
         ORDER BY s.subject_id DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $archived = $result->fetch_all(MYSQLI_ASSOC);
    echo json_encode($archived);
    $stmt->close();
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
