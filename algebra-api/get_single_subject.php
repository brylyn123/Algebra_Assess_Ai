<?php
require_once 'cors.php';
require_once 'schema_utils.php';
require_once 'db_connect.php';

$subjectId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($subjectId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "A valid subject ID is required."]);
    exit;
}

try {
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $stmt = $conn->prepare(
        "SELECT
            s.subject_id,
            s.subject_name,
            s.join_code AS enrollment_code,
            COALESCE(c.course_code, c.course_name) AS course,
            yl.year_level AS year,
            sec.section_name AS section,
            COALESCE(sem.semester_name, s.semester) AS semester
         FROM Subject s
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         WHERE s.subject_id = ?
         LIMIT 1"
    );
    $stmt->bind_param("i", $subjectId);
    $stmt->execute();
    $result = $stmt->get_result();
    $subject = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$subject) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Subject not found."]);
        exit;
    }

    echo json_encode($subject);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
