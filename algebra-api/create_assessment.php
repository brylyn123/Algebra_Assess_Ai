<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$subject_id = isset($data['subject_id']) ? intval($data['subject_id']) : null;
$rubric_set_id = isset($data['rubric_set_id']) ? intval($data['rubric_set_id']) : null;
$title = trim($data['title'] ?? '');
$description = trim($data['description'] ?? '');
$topic = trim($data['topic'] ?? '');
$difficulty = trim($data['difficulty'] ?? 'Medium');
$due_date = !empty($data['due_date']) ? trim($data['due_date']) : null;
$items = is_array($data['items']) ? $data['items'] : [];
$startedTransaction = false;

$allowedDifficulties = ['Easy', 'Medium', 'Hard'];
if (!in_array($difficulty, $allowedDifficulties, true)) {
    $difficulty = 'Medium';
}

if (!$subject_id || $title === '') {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Assessment needs a subject and a title."]);
    exit;
}

if (mb_strlen($title) > 255) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Title must be under 255 characters."]);
    exit;
}

if (mb_strlen($description) > 2000) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Description must be under 2000 characters."]);
    exit;
}

if (mb_strlen($topic) > 255) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Topic must be under 255 characters."]);
    exit;
}

if (count($items) === 0) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Provide at least one item for the assessment."]);
    exit;
}

try {
    $subjectStmt = $conn->prepare(
        "SELECT subject_id, teacher_user_id FROM subject WHERE subject_id = ? LIMIT 1"
    );
    $subjectStmt->bind_param("i", $subject_id);
    $subjectStmt->execute();
    $subjectResult = $subjectStmt->get_result();
    $subjectRow = $subjectResult ? $subjectResult->fetch_assoc() : null;
    $subjectStmt->close();

    if (!$subjectRow) {
        throw new Exception("Subject not found.");
    }

    if ((int)$subjectRow['teacher_user_id'] !== $teacher_id) {
        throw new Exception("Teacher is not assigned to this subject.");
    }

    ensureAssessmentRubricColumn($conn);
    ensureAssessmentDueDate($conn);

    if ($rubric_set_id) {
        $rubricStmt = $conn->prepare(
            "SELECT rubric_set_id
             FROM rubric_sets
             WHERE rubric_set_id = ? AND teacher_user_id = ?
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
    } else {
        $rubric_set_id = null;
    }

    $conn->begin_transaction();
    $startedTransaction = true;

    $exerciseStmt = $conn->prepare(
        "INSERT INTO exercises_problem (subject_id, rubric_set_id, title, description, topic, difficulty, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $dueDateParam = $due_date !== null ? $due_date : null;
    $exerciseStmt->bind_param("iisssss", $subject_id, $rubric_set_id, $title, $description, $topic, $difficulty, $dueDateParam);
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

        if ($maxScore <= 0 || $maxScore > 100) {
            throw new Exception('Max score per item must be between 0 and 100.');
        }

        if ($content === '') {
            throw new Exception('Each item must include question_content.');
        }

        if (mb_strlen($content) > 5000) {
            throw new Exception('Question content must be under 5000 characters.');
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
    echo json_encode(["status" => "error", "message" => "Unable to create assessment."]);
}

$conn->close();
?>
