<?php
// 1. CORS Headers - MUST BE AT THE VERY TOP
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

// 2. Handle the "Preflight" OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';

// 3. Get the JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "No data provided."]);
    exit();
}

$action = $data['action'] ?? '';
$id = intval($data['id'] ?? 0);
$name = trim($data['name'] ?? '');
$type = $data['type'] ?? ''; // 'college' or 'course'

if (!in_array($type, ['college', 'course'])) {
    echo json_encode(["status" => "error", "message" => "Invalid type provided."]);
    exit();
}

try {
    if ($action === 'update') {
        if ($id <= 0 || empty($name)) {
            throw new Exception("Invalid ID or name.");
        }

        $table = $type === 'college' ? 'colleges' : 'courses';
        $stmt = $conn->prepare("UPDATE {$table} SET name = ? WHERE id = ?");
        $stmt->bind_param("si", $name, $id);
        $stmt->execute();

        echo json_encode(["status" => "success", "message" => ucfirst($type) . " updated successfully."]);
    } else {
        throw new Exception("Invalid action.");
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}