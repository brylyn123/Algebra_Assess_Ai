<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRubricItemMinPoints($conn);

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$rubric_name = trim($data['name'] ?? '');
$criteria = trim($data['criteria'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];
$ai_instructions = trim($data['ai_instructions'] ?? '');
$level_definitions = null;
if (is_array($data['level_definitions']) && count($data['level_definitions']) > 0) {
    $level_definitions = json_encode(array_values($data['level_definitions']));
}

if (!$rubric_name || !$criteria) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Missing required rubric information."]);
    exit;
}

if (mb_strlen($rubric_name) > 255) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Rubric name must be under 255 characters."]);
    exit;
}

if (mb_strlen($criteria) > 5000) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Criteria must be under 5000 characters."]);
    exit;
}

if (mb_strlen($ai_instructions) > 5000) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "AI instructions must be under 5000 characters."]);
    exit;
}

if (count($items) === 0) {
    http_response_code(422);
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
        "INSERT INTO rubric_set_items (rubric_set_id, description, points, min_points)
         VALUES (?, ?, ?, ?)"
    );
    foreach ($items as $item) {
        $description = trim($item['description'] ?? '');
        if ($description === '') {
            continue;
        }
        $points = floatval($item['points'] ?? 0);
        $minPoints = floatval($item['min_points'] ?? 0);
        $itemStmt->bind_param("isdd", $rubricSetId, $description, $points, $minPoints);
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Rubric saved.", "rubric_set_id" => $rubricSetId]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to save rubric."]);
}

$conn->close();
?>
