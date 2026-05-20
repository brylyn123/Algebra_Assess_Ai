<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$teacher_id = isset($data['teacher_id']) ? intval($data['teacher_id']) : null;
$rubric_name = trim($data['name'] ?? '');
$criteria = trim($data['criteria'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];
$ai_instructions = trim($data['ai_instructions'] ?? '');
$level_definitions = null;
if (is_array($data['level_definitions']) && count($data['level_definitions']) > 0) {
    $level_definitions = json_encode(array_values($data['level_definitions']));
}

if (!$teacher_id || !$rubric_name || !$criteria) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing required rubric information."]);
    exit;
}

if (count($items) === 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Please provide at least one rubric item."]);
    exit;
}

try {
    if (!userHasRole($conn, $teacher_id, 'teacher')) {
        throw new Exception("Teacher not found.");
    }

    $conn->begin_transaction();

    $setStmt = $conn->prepare(
        "INSERT INTO rubric_sets (teacher_user_id, rubric_name, criteria, ai_instructions, level_definitions)
         VALUES (?, ?, ?, ?, ?)"
    );
    $setStmt->bind_param(
        "issss",
        $teacher_id,
        $rubric_name,
        $criteria,
        $ai_instructions,
        $level_definitions
    );
    $setStmt->execute();
    $rubricSetId = $conn->insert_id;
    $setStmt->close();

    $itemStmt = $conn->prepare(
        "INSERT INTO rubric_set_items (rubric_set_id, description, points)
         VALUES (?, ?, ?)"
    );
    foreach ($items as $item) {
        $description = trim($item['description'] ?? '');
        if ($description === '') {
            continue;
        }
        $points = floatval($item['points'] ?? 0);
        $itemStmt->bind_param("isd", $rubricSetId, $description, $points);
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Rubric saved.", "rubric_set_id" => $rubricSetId]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
