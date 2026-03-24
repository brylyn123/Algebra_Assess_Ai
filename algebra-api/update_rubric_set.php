<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$teacher_id = isset($data['teacher_id']) ? intval($data['teacher_id']) : null;
$rubric_set_id = isset($data['rubric_set_id']) ? intval($data['rubric_set_id']) : null;
$rubric_name = trim($data['name'] ?? '');
$criteria = trim($data['criteria'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];
$ai_instructions = trim($data['ai_instructions'] ?? '');
$level_definitions = null;
if (is_array($data['level_definitions']) && count($data['level_definitions']) > 0) {
    $level_definitions = json_encode(array_values($data['level_definitions']));
}

if (!$teacher_id || !$rubric_set_id || !$rubric_name || !$criteria || count($items) === 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing required rubric information."]);
    exit;
}

try {
    $checkStmt = $conn->prepare("SELECT teacher_id FROM rubric_sets WHERE rubric_set_id = ? LIMIT 1");
    $checkStmt->bind_param("i", $rubric_set_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();

    if (!$result || $result->num_rows === 0) {
        throw new Exception("Rubric not found.");
    }

    $row = $result->fetch_assoc();
    if ((int)$row['teacher_id'] !== $teacher_id) {
        throw new Exception("Rubric does not belong to this teacher.");
    }

    $conn->begin_transaction();

    $updateStmt = $conn->prepare(
        "UPDATE rubric_sets
         SET rubric_name = ?, criteria = ?, ai_instructions = ?, level_definitions = ?
         WHERE rubric_set_id = ?"
    );
    $updateStmt->bind_param("ssssi", $rubric_name, $criteria, $ai_instructions, $level_definitions, $rubric_set_id);
    $updateStmt->execute();
    $updateStmt->close();

    $deleteItems = $conn->prepare("DELETE FROM rubric_set_items WHERE rubric_set_id = ?");
    $deleteItems->bind_param("i", $rubric_set_id);
    $deleteItems->execute();
    $deleteItems->close();

    $itemStmt = $conn->prepare("INSERT INTO rubric_set_items (rubric_set_id, description, points) VALUES (?, ?, ?)");
    foreach ($items as $item) {
        $description = trim($item['description'] ?? '');
        if ($description === '') {
            continue;
        }
        $points = floatval($item['points'] ?? 0);
        $itemStmt->bind_param("isd", $rubric_set_id, $description, $points);
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Rubric updated."]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
