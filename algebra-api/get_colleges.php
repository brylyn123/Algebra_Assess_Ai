<?php
require_once 'cors.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';

$collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
$sql = "SELECT * FROM {$collegeTable}";
$result = $conn->query($sql);

$colleges = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $colleges[] = $row;
    }
}

echo json_encode($colleges);
?>
