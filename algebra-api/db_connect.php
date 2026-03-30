<?php
// 1. Handle CORS and Preflight
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

// If the browser is just "checking" the connection (OPTIONS), exit early with a 200 OK
if (PHP_SAPI !== 'cli' && isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
