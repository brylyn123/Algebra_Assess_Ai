<?php
// 1. Handle CORS and Preflight
require_once __DIR__ . '/cors.php';

// 2. Database Configuration
$servername = "localhost";
$username = "root"; 
$password = ""; 
$dbname = "algebraassess"; 
$port = 3306; 

// 3. Create connection
$conn = new mysqli($servername, $username, $password, $dbname, $port);

// 4. Check connection
if ($conn->connect_error) {
    http_response_code(500); // Set a proper error code
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $conn->connect_error]);
    exit();
}
