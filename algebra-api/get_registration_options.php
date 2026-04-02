<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once 'db_connect.php';
require_once 'schema_utils.php';

try {
    ensureRegistrationLookupData($conn);

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);

    $payload = [
        'status' => 'success',
        'colleges' => [],
        'courses' => [],
        'years' => [],
        'sections' => [],
    ];

    $queries = [
        'colleges' => "SELECT MIN(college_id) AS college_id, college_name
                       FROM {$collegeTable}
                       WHERE college_name IN ('College of Teacher Education', 'College of Sciences')
                       GROUP BY college_name
                       ORDER BY FIELD(college_name, 'College of Teacher Education', 'College of Sciences')",
        'courses' => "SELECT course_id, course_name, course_code, college_id FROM {$courseTable} ORDER BY course_name ASC",
        'years' => "SELECT year_id, year_level FROM {$yearTable} ORDER BY year_level ASC",
        'sections' => "SELECT section_id, section_name FROM {$sectionTable} ORDER BY section_name ASC",
    ];

    foreach ($queries as $key => $query) {
        $result = $conn->query($query);
        if (!$result) {
            throw new Exception("Unable to load $key: " . $conn->error);
        }

        while ($row = $result->fetch_assoc()) {
            $payload[$key][] = $row;
        }
        $result->free();
    }

    echo json_encode($payload);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
