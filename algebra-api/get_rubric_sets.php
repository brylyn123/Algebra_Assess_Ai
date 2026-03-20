<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;

if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    $stmt = $conn->prepare(
        "SELECT rs.rubric_set_id, rs.rubric_name, rs.criteria, rs.created_at,
                rs.ai_instructions, rs.level_definitions,
                rsi.description, rsi.points, rsi.rubric_item_id
         FROM rubric_sets rs
         LEFT JOIN rubric_set_items rsi ON rs.rubric_set_id = rsi.rubric_set_id
         WHERE rs.teacher_id = ?
         ORDER BY rs.created_at DESC, rsi.rubric_item_id ASC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $grouped = [];
    while ($row = $result->fetch_assoc()) {
        $setId = (int)$row["rubric_set_id"];
        if (!isset($grouped[$setId])) {
            $levelDefinitions = [];
            if (!empty($row["level_definitions"])) {
                $decoded = json_decode($row["level_definitions"], true);
                if (is_array($decoded)) {
                    $levelDefinitions = $decoded;
                }
            }
            $grouped[$setId] = [
                "rubric_set_id" => $setId,
                "rubric_name" => $row["rubric_name"],
                "criteria" => $row["criteria"],
                "created_at" => $row["created_at"],
                "ai_instructions" => $row["ai_instructions"] ?? '',
                "level_definitions" => $levelDefinitions,
                "items" => [],
            ];
        }

        if (!is_null($row["description"])) {
            $grouped[$setId]["items"][] = [
                "description" => $row["description"],
                "points" => floatval($row["points"]),
            ];
        }
    }

    $stmt->close();
    echo json_encode(["status" => "success", "rubrics" => array_values($grouped)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
