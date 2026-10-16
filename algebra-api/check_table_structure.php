<?php
require_once 'db_connect.php';

$tables = ['schema_migration_log', 'users', 'captured_solution', 'exercises_problem', 'exercise_items'];
foreach ($tables as $table) {
    $result = $conn->query("DESCRIBE `$table`");
    if ($result) {
        echo "=== $table ===\n";
        while ($row = $result->fetch_assoc()) {
            echo "  {$row['Field']} - {$row['Type']}\n";
        }
    } else {
        echo "=== $table === ERROR: " . $conn->error . "\n";
    }
    echo "\n";
}
$conn->close();