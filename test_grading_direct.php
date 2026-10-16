<?php
require 'algebra-api/ai_client.php';
require 'algebra-api/db_connect.php';
require 'algebra-api/schema_utils.php';

$conn = $conn ?? null;

// Get the submission data manually
$solution_id = 29;
$teacher_id = 11;

$userTable = resolveExistingTableName($conn, ['Users', 'users']);
$submissionStmt = $conn->prepare(
    "SELECT
        cs.solution_id,
        cs.file_path,
        cs.ocr_text,
        cs.ai_raw_json,
        ep.exercise_id,
        ep.rubric_set_id,
        ep.title AS assessment_title,
        rs.rubric_name,
        rs.criteria AS rubric_criteria,
        rs.ai_instructions AS rubric_ai_instructions,
        CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name
     FROM Captured_Solution cs
     INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
     INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
     LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
     LEFT JOIN {$userTable} st ON st.user_id = cs.student_user_id
     WHERE cs.solution_id = ? AND subj.teacher_user_id = ?
     LIMIT 1"
);
$submissionStmt->bind_param('ii', $solution_id, $teacher_id);
$submissionStmt->execute();
$submissionResult = $submissionStmt->get_result();
$submission = $submissionResult ? $submissionResult->fetch_assoc() : null;
$submissionStmt->close();

if (!$submission) {
    throw new Exception('Submission not found for this teacher.');
}

echo "Submission found: " . $submission['solution_id'] . "\n";

// Get items
$itemStmt = $conn->prepare(
    "SELECT item_id, item_no, question_content, max_score, rubric_set_id, effort_minimum_guarantee
     FROM exercise_items
     WHERE exercise_id = ?
     ORDER BY item_no ASC"
);
$exerciseId = (int)$submission['exercise_id'];
$itemStmt->bind_param('i', $exerciseId);
$itemStmt->execute();
$itemResult = $itemStmt->get_result();

$items = [];
while ($itemRow = $itemResult->fetch_assoc()) {
    $items[] = [
        'item_id' => (int)$itemRow['item_id'],
        'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
        'question_content' => $itemRow['question_content'],
        'max_score' => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 0.0,
        'rubric_set_id' => isset($itemRow['rubric_set_id']) ? (int)$itemRow['rubric_set_id'] : null,
        'effort_minimum_guarantee' => isset($itemRow['effort_minimum_guarantee']) ? (float)$itemRow['effort_minimum_guarantee'] : 0.0,
    ];
}
$itemStmt->close();

echo "Items: " . count($items) . "\n";
foreach ($items as $item) {
    echo "Item {$item['item_no']}: rubric_set_id = " . ($item['rubric_set_id'] ?? 'NULL') . "\n";
}

// Fetch per-item rubric details
$assessmentRubricId = isset($submission['rubric_set_id']) ? (int)$submission['rubric_set_id'] : 0;
$rubricCache = [];

$getDefaultRubric = function($id) {
    $defaults = [
        -1 => [
            "rubric_set_id" => -1,
            "rubric_name" => "Procedural Algebra",
            "rubric_type" => "procedural_algebra",
            "criteria" => "Review the student's complete handwritten solution. For each criterion, select the level that best describes the student's demonstrated work and assign the corresponding points. The criterion scores are added to obtain a maximum of 5 points per item.",
            "ai_instructions" => " Focus on algebraic process, accuracy of computation, and final answer. Award points based on the rubric levels: Full Credit, Partial Credit, Minimal Credit, or No Credit for each criterion.",
            "level_definitions" => [
                ["label" => "Full Credit", "points" => 5],
                ["label" => "Partial Credit", "points" => 3],
                ["label" => "Minimal Credit", "points" => 1],
                ["label" => "No Credit", "points" => 0],
            ],
            "items" => [
                ["description" => "Algebraic Process / Logical Steps", "points" => 60, "min_points" => 15],
                ["description" => "Accuracy of Computation / Algebraic Operations", "points" => 20, "min_points" => 5],
                ["description" => "Final Answer", "points" => 20, "min_points" => 5],
            ],
        ],
        -2 => [
            "rubric_set_id" => -2,
            "rubric_name" => "Problem-Solving",
            "rubric_type" => "problem_solving",
            "criteria" => "Review the student's complete handwritten solution. For each criterion, select the level that best describes the student's demonstrated work and assign the corresponding points. The criterion scores are added to obtain a maximum of 5 points per item.",
            "ai_instructions" => " Focus on understanding of the problem, method selection, solution process, and final answer. Award points based on the rubric levels: Full Credit, Partial Credit, Minimal Credit, or No Credit for each criterion.",
            "level_definitions" => [
                ["label" => "Full Credit", "points" => 5],
                ["label" => "Partial Credit", "points" => 3],
                ["label" => "Minimal Credit", "points" => 1],
                ["label" => "No Credit", "points" => 0],
            ],
            "items" => [
                ["description" => "Understanding of the Problem", "points" => 20, "min_points" => 5],
                ["description" => "Algebraic Method / Mathematical Model", "points" => 20, "min_points" => 5],
                ["description" => "Solution Process, Computation and Completeness", "points" => 40, "min_points" => 10],
                ["description" => "Final Answer", "points" => 20, "min_points" => 5],
            ],
        ],
    ];
    return $defaults[$id] ?? null;
};

foreach ($items as &$item) {
    $itemRubricId = $item['rubric_set_id'] ?? null;
    $effectiveRubricId = $itemRubricId !== null && $itemRubricId !== 0 ? $itemRubricId : ($assessmentRubricId !== 0 ? $assessmentRubricId : 0);

    if ($effectiveRubricId !== 0) {
        if (!isset($rubricCache[$effectiveRubricId])) {
            if ($effectiveRubricId < 0) {
                $defaultRubric = $getDefaultRubric($effectiveRubricId);
                if ($defaultRubric) {
                    $rubricCache[$effectiveRubricId] = [
                        'rubric_set_id' => $defaultRubric['rubric_set_id'],
                        'rubric_name' => $defaultRubric['rubric_name'],
                        'rubric_criteria' => $defaultRubric['criteria'],
                        'rubric_ai_instructions' => $defaultRubric['ai_instructions'],
                        'level_definitions' => $defaultRubric['level_definitions'],
                        'rubric_items' => $defaultRubric['items'],
                    ];
                }
            } else {
                $rStmt = $conn->prepare(
                    "SELECT rs.rubric_name, rs.criteria AS rubric_criteria, rs.ai_instructions AS rubric_ai_instructions
                     FROM rubric_sets rs WHERE rs.rubric_set_id = ? LIMIT 1"
                );
                $rStmt->bind_param('i', $effectiveRubricId);
                $rStmt->execute();
                $rRow = $rStmt->get_result()->fetch_assoc();
                $rStmt->close();

                $riStmt = $conn->prepare(
                    "SELECT description, points, min_points FROM rubric_set_items WHERE rubric_set_id = ? ORDER BY rubric_item_id ASC"
                );
                $riStmt->bind_param('i', $effectiveRubricId);
                $riStmt->execute();
                $riResult = $riStmt->get_result();
                $riItems = [];
                while ($ri = $riResult->fetch_assoc()) {
                    $riItems[] = [
                        'description' => $ri['description'],
                        'points' => (float)$ri['points'],
                        'min_points' => (float)($ri['min_points'] ?? 0),
                    ];
                }
                $riStmt->close();

                $rubricCache[$effectiveRubricId] = [
                    'rubric_set_id' => $effectiveRubricId,
                    'rubric_name' => $rRow['rubric_name'] ?? null,
                    'rubric_criteria' => $rRow['rubric_criteria'] ?? '',
                    'rubric_ai_instructions' => $rRow['rubric_ai_instructions'] ?? '',
                    'rubric_items' => $riItems,
                ];
            }
        }
        if (isset($rubricCache[$effectiveRubricId])) {
            $item['rubric'] = $rubricCache[$effectiveRubricId];
        } else {
            $item['rubric'] = null;
        }
    } else {
        $item['rubric'] = null;
    }
}
unset($item);

echo "Rubrics attached to items:\n";
foreach ($items as $item) {
    $rubric = $item['rubric'] ?? null;
    echo "Item {$item['item_no']}: rubric = " . ($rubric ? $rubric['rubric_name'] . ' (items: ' . count($rubric['rubric_items'] ?? []) . ')' : 'NULL') . "\n";
}

// Test grading
$submission['items'] = $items;
$submission['assessment_title'] = $submission['assessment_title'] ?? 'Quiz 14';
$submission['student_name'] = $submission['student_name'] ?? 'Test Student';
$submission['ocr_text'] = $submission['ocr_text'] ?? '';
$submission['effort_minimum_guarantee'] = 0.0;

echo "\nTesting generateDeepSeekGrade...\n";
try {
    $aiGeneration = generateDeepSeekGrade($submission);
    echo "SUCCESS!\n";
    print_r($aiGeneration);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}