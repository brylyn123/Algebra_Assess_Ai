<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    $stmt = $conn->prepare(
        "SELECT
            rs.rubric_set_id,
            rs.rubric_name,
            rs.criteria,
            rs.ai_instructions,
            rs.level_definitions,
            rs.created_at,
            rsi.description,
            rsi.points,
            rsi.rubric_item_id
         FROM rubric_sets rs
         LEFT JOIN rubric_set_items rsi ON rs.rubric_set_id = rsi.rubric_set_id
         WHERE rs.teacher_user_id = ?
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
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $levelDefinitions = $decoded;
                }
            }

            $grouped[$setId] = [
                "rubric_set_id" => $setId,
                "rubric_name" => $row["rubric_name"],
                "criteria" => $row["criteria"] ?? '',
                "ai_instructions" => $row["ai_instructions"] ?? '',
                "level_definitions" => $levelDefinitions,
                "created_at" => $row["created_at"],
                "items" => [],
            ];
        }

        if (!is_null($row["description"])) {
            $grouped[$setId]["items"][] = [
                "description" => $row["description"],
                "points" => (float)$row["points"],
            ];
        }
    }

    $stmt->close();
    setCacheHeaders(60);
    echo json_encode(["status" => "success", "rubrics" => array_values($grouped)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
