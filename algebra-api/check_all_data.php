<?php
require_once 'algebra-api/db_connect.php';

$r = $conn->query("SELECT * FROM Exercises_Problem");
echo "=== All Exercises ===\n";
while ($row = $r->fetch_assoc()) {
    echo json_encode($row) . PHP_EOL;
}

$r2 = $conn->query("SELECT * FROM Subject");
echo "\n=== All Subjects ===\n";
while ($row = $r2->fetch_assoc()) {
    echo json_encode($row) . PHP_EOL;
}

$r3 = $conn->query("SELECT * FROM assessment_subjects");
echo "\n=== Assessment Subjects ===\n";
while ($row = $r3->fetch_assoc()) {
    echo json_encode($row) . PHP_EOL;
}

$r4 = $conn->query("SELECT * FROM Users WHERE role_id = 2");
echo "\n=== Teachers ===\n";
while ($row = $r4->fetch_assoc()) {
    echo json_encode($row) . PHP_EOL;
}

$conn->close();