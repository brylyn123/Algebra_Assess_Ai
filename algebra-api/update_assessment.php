<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : null;

$subject_ids = [];
if (!empty($data['subject_ids']) && is_array($data['subject_ids'])) {
    $subject_ids = array_map('intval', $data['subject_ids']);
    $subject_ids = array_filter($subject_ids, fn($id) => $id > 0);
    $subject_ids = array_values(array_unique($subject_ids));
}
if (empty($subject_ids) && !empty($data['subject_id'])) {
    $subject_ids = [(int)$data['subject_id']];
}
$subject_id = $subject_ids[0] ?? null;

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

if (!$exercise_id || empty($subject_ids) || $title === '') {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Missing exercise_id, at least one subject, or title."]);
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
    // Verify the assessment exists and belongs to this teacher
    $checkStmt = $conn->prepare(
        "SELECT exercise_id, subject_id FROM exercises_problem WHERE exercise_id = ? LIMIT 1"
    );
    $checkStmt->bind_param("i", $exercise_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $checkRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$checkRow) {
        throw new Exception("Assessment not found.");
    }

    // Verify the primary subject belongs to this teacher
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

    // Validate all subject_ids belong to this teacher
    $validSubjectIds = [];
    foreach ($subject_ids as $sid) {
        $sStmt = $conn->prepare(
            "SELECT subject_id, teacher_user_id FROM subject WHERE subject_id = ? LIMIT 1"
        );
        $sStmt->bind_param("i", $sid);
        $sStmt->execute();
        $sResult = $sStmt->get_result();
        $sRow = $sResult ? $sResult->fetch_assoc() : null;
        $sStmt->close();
        if ($sRow && (int)$sRow['teacher_user_id'] === $teacher_id) {
            $validSubjectIds[] = $sid;
        }
    }
    $subject_id = $validSubjectIds[0] ?? $subject_id;

    ensureAssessmentRubricColumn($conn);
    ensureAssessmentDueDate($conn);

    if ($rubric_set_id) {
        $rubricStmt = $conn->prepare(
            "SELECT rubric_set_id FROM rubric_sets WHERE rubric_set_id = ? AND teacher_user_id = ? LIMIT 1"
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

    // Update exercises_problem
    $updateStmt = $conn->prepare(
        "UPDATE exercises_problem
         SET subject_id = ?, rubric_set_id = ?, title = ?, description = ?, topic = ?, difficulty = ?, due_date = ?
         WHERE exercise_id = ?"
    );
    $dueDateParam = $due_date !== null ? $due_date : null;
    $updateStmt->bind_param("iisssssi", $subject_id, $rubric_set_id, $title, $description, $topic, $difficulty, $dueDateParam, $exercise_id);
    $updateStmt->execute();
    $updateStmt->close();

    // Delete old items
    $deleteItems = $conn->prepare("DELETE FROM exercise_items WHERE exercise_id = ?");
    $deleteItems->bind_param("i", $exercise_id);
    $deleteItems->execute();
    $deleteItems->close();

    // Insert new items
    $itemStmt = $conn->prepare(
        "INSERT INTO exercise_items (exercise_id, item_no, question_type, question_content, model_solution, max_score)
         VALUES (?, ?, ?, ?, ?, ?)"
    );

    foreach ($items as $item) {
        $itemNo = isset($item['item_no']) ? intval($item['item_no']) : 1;
        $questionType = trim($item['question_type'] ?? 'handwritten_algebra');
        $content = trim($item['question_content'] ?? '');
        $modelSolution = trim($item['model_solution'] ?? '');
        $maxScore = isset($item['max_score']) ? (float)$item['max_score'] : 1.0;

        if ($questionType !== 'handwritten_algebra') {
            $questionType = 'handwritten_algebra';
        }
        if ($content === '') {
            throw new Exception('Each item must include question_content.');
        }

        $modelSolutionValue = $modelSolution === '' ? null : $modelSolution;
        $itemStmt->bind_param("iisssd", $exercise_id, $itemNo, $questionType, $content, $modelSolutionValue, $maxScore);
        $itemStmt->execute();
    }
    $itemStmt->close();

    // Update assessment_subjects: delete old, insert new
    $deleteAS = $conn->prepare("DELETE FROM assessment_subjects WHERE assessment_id = ?");
    $deleteAS->bind_param("i", $exercise_id);
    $deleteAS->execute();
    $deleteAS->close();

    if (!empty($validSubjectIds)) {
        $asStmt = $conn->prepare(
            "INSERT INTO assessment_subjects (assessment_id, subject_id) VALUES (?, ?)"
        );
        foreach ($validSubjectIds as $sid) {
            $asStmt->bind_param("ii", $exercise_id, $sid);
            $asStmt->execute();
        }
        $asStmt->close();
    }

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Assessment updated.",
        "exercise_id" => $exercise_id,
    ]);
} catch (Exception $e) {
    if ($startedTransaction || $conn->in_transaction) {
        $conn->rollback();
    }
    echo json_encode(["status" => "error", "message" => "Unable to update assessment."]);
}

$conn->close();
?>
