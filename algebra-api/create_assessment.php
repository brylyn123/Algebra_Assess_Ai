<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$teacher_id = isset($data['teacher_id']) ? intval($data['teacher_id']) : null;
$subject_id = isset($data['subject_id']) ? intval($data['subject_id']) : null;
$rubric_set_id = isset($data['rubric_set_id']) ? intval($data['rubric_set_id']) : null;
$title = trim($data['title'] ?? '');
$description = trim($data['description'] ?? '');
$topic = trim($data['topic'] ?? '');
$difficulty = trim($data['difficulty'] ?? 'Medium');
$items = is_array($data['items']) ? $data['items'] : [];
$startedTransaction = false;

$allowedDifficulties = ['Easy', 'Medium', 'Hard'];
if (!in_array($difficulty, $allowedDifficulties, true)) {
    $difficulty = 'Medium';
}

if (!$subject_id || $title === '') {
    echo json_encode(["status" => "error", "message" => "Assessment needs a subject and a title."]);
    exit;
}

if (!$rubric_set_id) {
    echo json_encode(["status" => "error", "message" => "Select a rubric for this assessment."]);
    exit;
}

if (count($items) === 0) {
    echo json_encode(["status" => "error", "message" => "Provide at least one item for the assessment."]);
    exit;
}

try {
    $subjectStmt = $conn->prepare(
        "SELECT subject_id, teacher_id FROM subject WHERE subject_id = ? LIMIT 1"
    );
    $subjectStmt->bind_param("i", $subject_id);
    $subjectStmt->execute();
    $subjectResult = $subjectStmt->get_result();
    $subjectRow = $subjectResult ? $subjectResult->fetch_assoc() : null;
    $subjectStmt->close();

    if (!$subjectRow) {
        throw new Exception("Subject not found.");
    }

    if ($teacher_id && (int)$subjectRow['teacher_id'] !== $teacher_id) {
        throw new Exception("Teacher is not assigned to this subject.");
    }

    ensureAssessmentRubricColumn($conn);

    $rubricStmt = $conn->prepare(
        "SELECT rubric_set_id
         FROM rubric_sets
         WHERE rubric_set_id = ? AND teacher_id = ?
         LIMIT 1"
    );
    $rubricStmt->bind_param("ii", $rubric_set_id, $teacher_id);
    $rubricStmt->execute();
    $rubricResult = $rubricStmt->get_result();
    $rubricRow = $rubricResult ? $rubricResult->fetch_assoc() : null;
    $rubricStmt->close();

    if (!$rubricRow) {
        throw new Exception("Rubric not found or does not belong to this teacher.");
    }

    $conn->begin_transaction();
    $startedTransaction = true;

    $exerciseStmt = $conn->prepare(
        "INSERT INTO exercises_problem (subject_id, rubric_set_id, title, description, topic, difficulty)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $exerciseStmt->bind_param("iissss", $subject_id, $rubric_set_id, $title, $description, $topic, $difficulty);
    $exerciseStmt->execute();
    $exerciseId = $conn->insert_id;
    $exerciseStmt->close();

    $itemStmt = $conn->prepare(
        "INSERT INTO exercise_items (
            exercise_id,
            item_no,
            question_type,
            question_content,
            model_solution,
            max_score
         ) VALUES (?, ?, ?, ?, ?, ?)"
    );

    foreach ($items as $item) {
        $itemNo = isset($item['item_no']) ? intval($item['item_no']) : 1;
        $questionType = trim($item['question_type'] ?? 'handwritten_algebra');
        $content = trim($item['question_content'] ?? '');
        $modelSolution = trim($item['model_solution'] ?? '');
        $maxScore = isset($item['max_score'])
            ? (float)$item['max_score']
            : (isset($item['max_score_per_item']) ? (float)$item['max_score_per_item'] : 1.0);

        if ($questionType !== 'handwritten_algebra') {
            $questionType = 'handwritten_algebra';
        }

        if ($content === '') {
            throw new Exception('Each item must include question_content.');
        }

        $modelSolutionValue = $modelSolution === '' ? null : $modelSolution;

        $itemStmt->bind_param(
            "iisssd",
            $exerciseId,
            $itemNo,
            $questionType,
            $content,
            $modelSolutionValue,
            $maxScore
        );
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Assessment saved.",
        "exercise_id" => $exerciseId,
        "rubric_set_id" => $rubric_set_id,
    ]);
} catch (Exception $e) {
    if ($startedTransaction || $conn->in_transaction) {
        $conn->rollback();
    }
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
