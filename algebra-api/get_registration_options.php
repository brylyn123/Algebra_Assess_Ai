<?php
require_once 'cors.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

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
        'colleges' => "SELECT college_id, college_name, is_active, created_at, updated_at
                       FROM {$collegeTable}
                       WHERE is_active = 1
                       ORDER BY college_name ASC",
        'courses' => "SELECT course_id, course_name, course_code, college_id, is_active, created_at, updated_at
                      FROM {$courseTable}
                      WHERE is_active = 1
                      ORDER BY course_name ASC",
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

    setCacheHeaders(300);
    echo json_encode($payload);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
