<?php
// 1. Handle CORS and Preflight
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/env.php';

// 2. Database Configuration
$servername = getenv('DB_HOST') ?: '127.0.0.1';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';
$dbname = getenv('DB_NAME') ?: 'algebraassess';
$port = (int)(getenv('DB_PORT') ?: 3306);

// 3. Create connection
$conn = new mysqli($servername, $username, $password, $dbname, $port);

// 4. Check connection
if ($conn->connect_error) {
    http_response_code(500);
    error_log("Database connection failed: " . $conn->connect_error);
    echo json_encode(["status" => "error", "message" => "Unable to connect to the database. Please try again later."]);
    exit();
}
