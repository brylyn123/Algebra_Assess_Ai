<?php
include 'db_connection.php'; // Your DB config

$subject_id = $_GET['id'];

$sql = "SELECT * FROM subjects WHERE id = '$subject_id'";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    echo json_encode($result->fetch_assoc());
} else {
    echo json_encode(["error" => "Subject not found"]);
}
?>