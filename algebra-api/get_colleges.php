<?php
require_once 'cors.php';
require_once 'db_connection.php';

$sql = "SELECT * FROM Colleges";
$result = $conn->query($sql);

$colleges = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $colleges[] = $row;
    }
}

echo json_encode($colleges);
?>
