<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    ensureSubjectLookupColumns($conn);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $filters = [
        'school_years' => [],
        'years' => [],
        'sections' => [],
        'semesters' => []
    ];

    $queries = [
        'school_years' => "SELECT DISTINCT school_year FROM subject WHERE teacher_user_id = ? AND school_year <> '' ORDER BY school_year DESC",
        'years' => "SELECT DISTINCT yl.year_level AS value
                    FROM subject s
                    LEFT JOIN {$yearTable} yl ON yl.year_id = s.year_id
                    WHERE s.teacher_user_id = ?
                    HAVING value IS NOT NULL AND value <> ''
                    ORDER BY value",
        'sections' => "SELECT DISTINCT sec.section_name AS value
                       FROM subject s
                       LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
                       WHERE s.teacher_user_id = ?
                       HAVING value IS NOT NULL AND value <> ''
                       ORDER BY value",
        'semesters' => "SELECT DISTINCT semester FROM subject WHERE teacher_user_id = ? AND semester <> '' ORDER BY semester"
    ];

    foreach ($queries as $key => $query) {
        $stmt = $conn->prepare($query);
        $stmt->bind_param("i", $teacher_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result) {
            while ($row = $result->fetch_array(MYSQLI_NUM)) {
                $value = $row[0];
                if ($value !== null && $value !== '') {
                    $filters[$key][] = $value;
                }
            }
        }
        $stmt->close();
    }

    echo json_encode(array_merge(['status' => 'success'], $filters));
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
