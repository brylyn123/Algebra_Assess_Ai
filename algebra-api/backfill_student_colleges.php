<?php
require_once 'cors.php';
require_once 'auth.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'CLI';

if ($requestMethod === 'OPTIONS') {
    http_response_code(204);
    exit();
}

$authUser = requireAuthenticatedUser('admin');
validateCsrfToken();

require_once 'db_connect.php';
require_once 'schema_utils.php';

try {
    $conn->begin_transaction();

    $summary = backfillStudentCollegeIds($conn);

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'Student college backfill completed.',
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
