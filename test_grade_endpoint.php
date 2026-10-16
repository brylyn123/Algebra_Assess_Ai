<?php
require 'algebra-api/ai_client.php';
require 'algebra-api/db_connect.php';

$conn = $conn ?? null;
if (!$conn) {
    require 'algebra-api/db_connect.php';
    $conn = $conn;
}

// Test the grading logic
$solution_id = 29;
$teacher_id = 1; // assuming teacher_id 1 exists

// Simulate the grading request by calling the internal function
$data = ['solution_id' => $solution_id];

// Include and run the grading
$_POST = ['solution_id' => $solution_id];
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['CONTENT_TYPE'] = 'application/json';
$_SERVER['HTTP_X_CSRF_TOKEN'] = 'test';

// We need to test the actual endpoint
echo "Testing grading endpoint...\n";

// Let's trace through what happens in generate_submission_grade
require 'algebra-api/generate_submission_grade.php';