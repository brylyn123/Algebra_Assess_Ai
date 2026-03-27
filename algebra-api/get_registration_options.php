<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once 'db_connect.php';
require_once 'schema_utils.php';

try {
    ensureRegistrationLookupData($conn);

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);

    $payload = [
        'status' => 'success',
        'courses' => [],
        'years' => [],
        'sections' => [],
    ];

    $queries = [
        'courses' => "SELECT course_id, course_name, course_code FROM {$courseTable} ORDER BY course_name ASC",
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
