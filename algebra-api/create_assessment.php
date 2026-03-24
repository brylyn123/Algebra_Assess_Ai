<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

$teacher_id = isset($data['teacher_id']) ? intval($data['teacher_id']) : null;
$subject_id = isset($data['subject_id']) ? intval($data['subject_id']) : null;
$title = trim($data['title'] ?? '');
$description = trim($data['description'] ?? '');
$topic = trim($data['topic'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];
$startedTransaction = false;

if (!$subject_id || $title === '') {
    echo json_encode(["status" => "error", "message" => "Assessment needs a subject and a title."]);
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


    $conn->begin_transaction();
    $startedTransaction = true;

    $exerciseStmt = $conn->prepare(
        "INSERT INTO exercises_problem (subject_id, title, description, topic) VALUES (?, ?, ?, ?)"
    );
    $exerciseStmt->bind_param("isss", $subject_id, $title, $description, $topic);
    $exerciseStmt->execute();
    $exerciseId = $conn->insert_id;
    $exerciseStmt->close();

    $itemStmt = $conn->prepare(
        "INSERT INTO exercise_items (exercise_id, item_no, question_content, correct_answer, model_solution, max_score)
         VALUES (?, ?, ?, ?, ?, ?)"
    );

    foreach ($items as $item) {
        $itemNo = isset($item['item_no']) ? intval($item['item_no']) : 1;
        $content = trim($item['question_content'] ?? '');
        $correctAnswer = trim($item['correct_answer'] ?? '');
        $modelSolution = trim($item['model_solution'] ?? '');
        $maxScore = isset($item['max_score']) ? (float)$item['max_score'] : 1.0;

        if ($content === '') {
            throw new Exception('Each item must include question_content.');
        }

        $itemStmt->bind_param(
            "iisssd",
            $exerciseId,
            $itemNo,
            $content,
            $correctAnswer === '' ? null : $correctAnswer,
            $modelSolution === '' ? null : $modelSolution,
            $maxScore
        );
        $itemStmt->execute();
    }
    $itemStmt->close();

    $conn->commit();

    echo json_encode(["status" => "success", "message" => "Assessment saved.", "exercise_id" => $exerciseId]);
} catch (Exception $e) {
    if ($startedTransaction || $conn->in_transaction) {
        $conn->rollback();
    }
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
