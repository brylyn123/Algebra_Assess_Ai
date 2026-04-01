<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'CLI';

if ($requestMethod === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';
require_once 'schema_utils.php';

try {
    $conn->begin_transaction();

    $summary = backfillStudentCollegeIds($conn);

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'Student college backfill completed.',
        'updated_course_links' => $summary['updated_course_links'],
        'updated_from_course' => $summary['updated_from_course'],
        'remaining_null' => $summary['remaining_null'],
    ]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to backfill student colleges: ' . $e->getMessage(),
    ]);
}

$conn->close();
?>
