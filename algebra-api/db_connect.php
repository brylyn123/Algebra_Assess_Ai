<?php
// 1. Handle CORS and Preflight
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/env.php';

// 2. Database Configuration
$servername = getenv('DB_HOST') ?: '127.0.0.1';
$username = getenv('DB_USER');
$password = getenv('DB_PASSWORD') ?? '';
$dbname = getenv('DB_NAME') ?: 'algebraassess';
$port = (int)(getenv('DB_PORT') ?: 3306);

if ($username === null || $username === '') {
    $isProduction = !in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1', ''], true);
    if ($isProduction) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Database user not configured."]);
        exit();
    }
    $username = 'root';
}

// 3. Create connection with retry logic
$conn = null;
$lastError = '';
for ($attempt = 1; $attempt <= 3; $attempt++) {
    $conn = @new mysqli($servername, $username, $password, $dbname, $port);
    if ($conn->connect_error) {
        $lastError = $conn->connect_error;
        error_log("Database connection attempt {$attempt} failed: {$lastError}");
        $conn->close();
        $conn = null;
        if ($attempt < 3) {
            usleep(500000);
        }
        continue;
    }
    $conn->set_charset('utf8mb4');
    break;
}

// 4. Check connection
if ($conn === null || $conn->connect_error) {
    http_response_code(503);
    error_log("Database connection failed after 3 attempts: {$lastError}");
    echo json_encode(["status" => "error", "message" => "Unable to connect to the database. Please try again later."]);
    exit();
}
