<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

ensureRubricItemMinPoints($conn);
ensureRubricTypeColumn($conn);

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    $stmt = $conn->prepare(
        "SELECT
            rs.rubric_set_id,
            rs.rubric_name,
            rs.rubric_type,
            rs.criteria,
            rs.ai_instructions,
            rs.level_definitions,
            rs.created_at,
            rsi.description,
            rsi.points,
            rsi.min_points,
            rsi.rubric_item_id
         FROM rubric_sets rs
         LEFT JOIN rubric_set_items rsi ON rs.rubric_set_id = rsi.rubric_set_id
         WHERE rs.teacher_user_id = ? OR rs.teacher_user_id = 0
         ORDER BY rs.teacher_user_id ASC, rs.created_at DESC, rsi.rubric_item_id ASC"
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
                "rubric_type" => $row["rubric_type"] ?? 'general',
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
                "min_points" => (float)($row["min_points"] ?? 0),
            ];
        }
    }

    $stmt->close();

    $defaults = [
        [
            "rubric_set_id" => -1,
            "rubric_name" => "Procedural Algebra (Items 1-4)",
            "rubric_type" => "procedural_algebra",
            "criteria" => "Applicable to Items 1-4: Procedural Algebra Items. Review the student's complete handwritten solution. For each criterion, select the level that best describes the student's demonstrated work and assign the corresponding points. The criterion scores are added to obtain a maximum of 5 points per item.",
            "ai_instructions" => "Grade items 1-4 using this procedural algebra rubric. Focus on algebraic process, accuracy of computation, and final answer. Award points based on the rubric levels: Full Credit, Partial Credit, Minimal Credit, or No Credit for each criterion.",
            "level_definitions" => [
                ["label" => "Full Credit", "points" => 5],
                ["label" => "Partial Credit", "points" => 3],
                ["label" => "Minimal Credit", "points" => 1],
                ["label" => "No Credit", "points" => 0],
            ],
            "created_at" => null,
            "items" => [
                ["description" => "Algebraic Process / Logical Steps", "points" => 3.0, "min_points" => 0.75],
                ["description" => "Accuracy of Computation / Algebraic Operations", "points" => 1.0, "min_points" => 0.25],
                ["description" => "Final Answer", "points" => 1.0, "min_points" => 0.25],
            ],
            "is_default" => true,
        ],
        [
            "rubric_set_id" => -2,
            "rubric_name" => "Problem-Solving (Items 5-6)",
            "rubric_type" => "problem_solving",
            "criteria" => "Applicable to Items 5-6: Problem-Solving Items. Review the student's complete handwritten solution. For each criterion, select the level that best describes the student's demonstrated work and assign the corresponding points. The criterion scores are added to obtain a maximum of 5 points per item.",
            "ai_instructions" => "Grade items 5-6 using this problem-solving rubric. Focus on understanding of the problem, method selection, solution process, and final answer. Award points based on the rubric levels: Full Credit, Partial Credit, Minimal Credit, or No Credit for each criterion.",
            "level_definitions" => [
                ["label" => "Full Credit", "points" => 5],
                ["label" => "Partial Credit", "points" => 3],
                ["label" => "Minimal Credit", "points" => 1],
                ["label" => "No Credit", "points" => 0],
            ],
            "created_at" => null,
            "items" => [
                ["description" => "Understanding of the Problem", "points" => 1.0, "min_points" => 0.25],
                ["description" => "Algebraic Method / Mathematical Model", "points" => 1.0, "min_points" => 0.25],
                ["description" => "Solution Process, Computation and Completeness", "points" => 2.0, "min_points" => 0.5],
                ["description" => "Final Answer", "points" => 1.0, "min_points" => 0.25],
            ],
            "is_default" => true,
        ],
    ];

    setCacheHeaders(60);
    echo json_encode(["status" => "success", "rubrics" => array_merge($defaults, array_values($grouped))]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to load rubrics."]);
}

$conn->close();
?>
