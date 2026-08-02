<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

ensureRegistrationLookupData($conn);

$authUser = requireAuthenticatedUser();
$authRole = strtolower((string)($authUser['role'] ?? ''));
if ($authRole !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'status' => 'error',
        'message' => 'Only admin users can view the catalog.',
    ]);
    exit();
}

try {
    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);

    $payload = [
        'status' => 'success',
        'colleges' => [],
        'courses' => [],
    ];

    $queries = [
        'colleges' => "SELECT college_id, college_name, is_active, created_at, updated_at
                       FROM {$collegeTable}
                       ORDER BY college_name ASC",
        'courses' => "SELECT course_id, course_name, course_code, college_id, is_active, created_at, updated_at
                      FROM {$courseTable}
                      ORDER BY course_name ASC",
    ];

    foreach ($queries as $key => $query) {
        $result = $conn->query($query);
        if (!$result) {
            throw new Exception("Unable to load {$key}: " . $conn->error);
        }

        while ($row = $result->fetch_assoc()) {
            $payload[$key][] = $row;
        }
        $result->free();
    }

    setCacheHeaders(60);
    echo json_encode($payload);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);
}
