<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRubricItemMinPoints($conn);
ensureRubricTypeColumn($conn);

$data = json_decode(file_get_contents("php://input"), true);
$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$rubric_set_id = isset($data['rubric_set_id']) ? intval($data['rubric_set_id']) : null;
$rubric_name = trim($data['name'] ?? '');
$rubric_type = trim($data['rubric_type'] ?? 'general');
$criteria = trim($data['criteria'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];
$ai_instructions = trim($data['ai_instructions'] ?? '');
$level_definitions = null;
if (is_array($data['level_definitions']) && count($data['level_definitions']) > 0) {
    $level_definitions = json_encode(array_values($data['level_definitions']));
}

$allowed_types = ['procedural_algebra', 'problem_solving', 'general'];
if (!in_array($rubric_type, $allowed_types)) {
    $rubric_type = 'general';
}

if (!$teacher_id || !$rubric_set_id || !$rubric_name || !$criteria || count($items) === 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing required rubric information."]);
    exit;
}

try {
    $checkStmt = $conn->prepare("SELECT teacher_user_id FROM rubric_sets WHERE rubric_set_id = ? LIMIT 1");
    $checkStmt->bind_param("i", $rubric_set_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();

    if (!$result || $result->num_rows === 0) {
        throw new Exception("Rubric not found.");
    }

    $row = $result->fetch_assoc();
    if ((int)$row['teacher_user_id'] !== $teacher_id) {
        throw new Exception("Rubric does not belong to this teacher.");
    }

    $conn->begin_transaction();

    $updateStmt = $conn->prepare(
        "UPDATE rubric_sets
         SET rubric_name = ?, rubric_type = ?, criteria = ?, ai_instructions = ?, level_definitions = ?
         WHERE rubric_set_id = ?"
    );
    $updateStmt->bind_param("sssssi", $rubric_name, $rubric_type, $criteria, $ai_instructions, $level_definitions, $rubric_set_id);
    $updateStmt->execute();
    $updateStmt->close();

    $deleteItems = $conn->prepare("DELETE FROM rubric_set_items WHERE rubric_set_id = ?");
    $deleteItems->bind_param("i", $rubric_set_id);
    $deleteItems->execute();
    $deleteItems->close();

    $itemStmt = $conn->prepare("INSERT INTO rubric_set_items (rubric_set_id, description, points, min_points) VALUES (?, ?, ?, ?)");
    foreach ($items as $item) {
        $description = trim($item['description'] ?? '');
        if ($description === '') {
            continue;
        }
        $points = floatval($item['points'] ?? 0);
        $minPoints = floatval($item['min_points'] ?? 0);
        $itemStmt->bind_param("isdd", $rubric_set_id, $description, $points, $minPoints);
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Rubric updated."]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to update rubric."]);
}

$conn->close();
