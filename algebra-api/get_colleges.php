<?php
require_once 'cors.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

ensureRegistrationLookupData($conn);

$collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
$sql = "
    SELECT college_id, college_name, is_active, created_at, updated_at
    FROM {$collegeTable}
    WHERE is_active = 1
    ORDER BY college_name ASC
";
$result = $conn->query($sql);

$colleges = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $colleges[] = $row;
    }
}

setCacheHeaders(60);
echo json_encode(['status' => 'success', 'data' => $colleges]);
?>
