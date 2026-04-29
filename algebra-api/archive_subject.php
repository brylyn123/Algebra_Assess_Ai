<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

function ensureArchivedColumn($conn) {
    $columnCheck = $conn->query("SHOW COLUMNS FROM subject LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE subject ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

$data = json_decode(file_get_contents("php://input"), true);

$subject_id = $data['subject_id'] ?? null;
$teacher_id = $data['teacher_id'] ?? null;

if (!$subject_id || !$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Subject ID and teacher ID are required."]);
    exit;
}

try {
    ensureArchivedColumn($conn);
    $updateStmt = $conn->prepare(
         "UPDATE subject
         SET archived = 1
         WHERE subject_id = ? AND teacher_user_id = ? AND archived = 0"
    );
    $updateStmt->bind_param("ii", $subject_id, $teacher_id);
    $updateStmt->execute();
    $affectedRows = $updateStmt->affected_rows;
    $updateStmt->close();

    if ($affectedRows === 0) {
        echo json_encode(["status" => "error", "message" => "No active matching subject found."]);
    } else {
        echo json_encode(["status" => "success", "message" => "Subject archived."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Server error: " . $e->getMessage()]);
}

$conn->close();
?>
