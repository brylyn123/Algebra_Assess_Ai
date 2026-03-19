<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

$teacher_id = $data['teacher_id'] ?? null;
$subject_id = $data['subject_id'] ?? null;
$title = trim($data['title'] ?? '');
$topic = trim($data['topic'] ?? '');
$description = trim($data['description'] ?? '');
$items = is_array($data['items']) ? $data['items'] : [];

if (!$teacher_id || !$subject_id || !$title) {
    echo json_encode(["status" => "error", "message" => "Missing required fields for assessment creation."]);
    exit;
}

if (count($items) === 0) {
    echo json_encode(["status" => "error", "message" => "At least one assessment item is required."]);
    exit;
}

try {
    // ensure the subject belongs to teacher
    $checkStmt = $conn->prepare("SELECT teacher_id FROM subject WHERE subject_id = ? LIMIT 1");
    $checkStmt->bind_param("i", $subject_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    if (!$result || $result->num_rows === 0) {
        throw new Exception("Subject not found.");
    }
    $row = $result->fetch_assoc();
    $checkStmt->close();
    if ((int)$row['teacher_id'] !== (int)$teacher_id) {
        throw new Exception("Subject does not belong to this teacher.");
    }

    $conn->begin_transaction();

    $problemStmt = $conn->prepare(
        "INSERT INTO exercises_problem (subject_id, title, description, topic, date_created)
         VALUES (?, ?, ?, ?, NOW())"
    );
    $problemStmt->bind_param("isss", $subject_id, $title, $description, $topic);
    $problemStmt->execute();
    $excerciseId = $conn->insert_id;
    $problemStmt->close();

    $itemStmt = $conn->prepare(
        "INSERT INTO exercises_items (exercise_id, item_no, score_per_item, max_score_per_item, question_type, question_content, options, correct_answer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $rubricStmt = $conn->prepare(
        "INSERT INTO rubrics (item_id, criteria_name, points, description)
         VALUES (?, ?, ?, ?)"
    );
    foreach ($items as $item) {
        $itemNo = $item['item_no'] ?? 0;
        $scorePerItem = $item['score_per_item'] ?? 0;
        $maxScore = $item['max_score_per_item'] ?? 0;
        $questionType = $item['question_type'] ?? 'handwritten_algebra';
        $content = $item['question_content'] ?? '';
        $option = $item['options'] ?? '';
        $correctAnswer = $item['correct_answer'] ?? '';
        $itemStmt->bind_param(
            "iiddssss",
            $excerciseId,
            $itemNo,
            $scorePerItem,
            $maxScore,
            $questionType,
            $content,
            $option,
            $correctAnswer
        );
        $itemStmt->execute();
        $itemId = $conn->insert_id;
        $rubrics = is_array($item['rubrics'] ?? []) ? $item['rubrics'] : [];
        foreach ($rubrics as $rubric) {
            $criteria = trim($rubric['criteria_name'] ?? '');
            if ($criteria === '') {
                continue;
            }
            $points = floatval($rubric['points'] ?? 0);
            $description = trim($rubric['description'] ?? '');
            $rubricStmt->bind_param("isds", $itemId, $criteria, $points, $description);
            $rubricStmt->execute();
        }
    }
    $itemStmt->close();
    $rubricStmt->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Assessment created.", "exercise_id" => $excerciseId]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
