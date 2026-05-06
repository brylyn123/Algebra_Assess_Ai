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
    ensureSchoolYearSchema($conn);
    ensureSemesterSchema($conn);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $filters = [
        'school_years' => [],
        'years' => [],
        'sections' => [],
        'semesters' => []
    ];

    $queries = [
        'school_years' => "SELECT DISTINCT label AS value
                           FROM school_year
                           WHERE label IS NOT NULL AND label <> ''
                           ORDER BY value DESC",
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
        'semesters' => "SELECT DISTINCT COALESCE(sem.semester_name, s.semester) AS value
                        FROM subject s
                        LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
                        WHERE s.teacher_user_id = ?
                        HAVING value IS NOT NULL AND value <> ''
                        ORDER BY value"
    ];

    foreach ($queries as $key => $query) {
        $stmt = $conn->prepare($query);
        if (str_contains($query, '?')) {
            $stmt->bind_param("i", $teacher_id);
        }
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
