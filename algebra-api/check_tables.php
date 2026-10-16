<?php
require_once 'db_connect.php';

$result = $conn->query("SHOW TABLES");
if ($result) {
    echo "=== Tables in algebraassess ===\n";
    while ($row = $result->fetch_row()) {
        echo $row[0] . "\n";
    }
} else {
    echo "Error: " . $conn->error;
}
$conn->close();