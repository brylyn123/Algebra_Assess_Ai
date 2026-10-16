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
$publish_at = !empty($data['publish_at']) ? trim($data['publish_at']) : null;
$submit_mode = trim($data['submit_mode'] ?? 'student');
$items = is_array($data['items']) ? $data['items'] : [];
$startedTransaction = false;

if (isset($data['grading_criteria']) && !is_array($data['grading_criteria'])) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "grading_criteria must be an array."]);
    exit;
}
if (isset($data['custom_grading_criteria']) && !is_array($data['custom_grading_criteria'])) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "custom_grading_criteria must be an array."]);
    exit;
}
$gradingCriteria = normalizeGradingCriteriaPayload($data['grading_criteria'] ?? []);
$customGradingCriteria = normalizeGradingCriteriaPayload($data['custom_grading_criteria'] ?? []);

$allowedDifficulties = ['Easy', 'Medium', 'Hard'];
if (!in_array($difficulty, $allowedDifficulties, true)) {
    $difficulty = 'Medium';
}

if (!in_array($submit_mode, ['student', 'teacher'], true)) {
    $submit_mode = 'student';
}

if ($publish_at !== null && strtotime($publish_at) === false) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Publish date is invalid."]);
    exit;
}

$publishTimestamp = $publish_at !== null ? strtotime($publish_at) : false;
$dueTimestamp = $due_date !== null ? strtotime($due_date) : false;
if ($publishTimestamp !== false && $publishTimestamp > time()
    && $dueTimestamp !== false && $dueTimestamp <= $publishTimestamp) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Due date must be later than the publish date."]);
    exit;
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
    ensureAssessmentDueDate($conn);
    ensureAssessmentPublishSchedule($conn);
    ensureAssessmentSubmitMode($conn);
    ensureAssessmentGradingCriteriaColumns($conn);

    // Verify the assessment exists and belongs to this teacher
    $checkStmt = $conn->prepare(
        "SELECT exercise_id, subject_id, is_published, publish_notified FROM exercises_problem WHERE exercise_id = ? LIMIT 1"
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
    ensureItemRubricColumn($conn);

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

    // Collect per-item rubric IDs and validate them
    $itemRubricIds = [];
    foreach ($items as $item) {
        $itemRubricId = isset($item['rubric_set_id']) ? intval($item['rubric_set_id']) : null;
        if ($itemRubricId > 0) {
            $vrStmt = $conn->prepare("SELECT rubric_set_id FROM rubric_sets WHERE rubric_set_id = ? AND teacher_user_id = ? LIMIT 1");
            $vrStmt->bind_param("ii", $itemRubricId, $teacher_id);
            $vrStmt->execute();
            $vrResult = $vrStmt->get_result();
            $vrRow = $vrResult ? $vrResult->fetch_assoc() : null;
            $vrStmt->close();
            $itemRubricIds[] = $vrRow ? $itemRubricId : null;
        } else {
            $itemRubricIds[] = null;
        }
    }

    $conn->begin_transaction();
    $startedTransaction = true;

    // Update exercises_problem. Students that were already notified keep a live
    // assessment live: their schedule is cleared instead of re-applied.
    $isLive = (int)($checkRow['publish_notified'] ?? 0) === 1;
    $publishAtParam = ($publish_at !== null && !$isLive) ? $publish_at : null;

    $updateStmt = $conn->prepare(
        "UPDATE exercises_problem
         SET subject_id = ?, rubric_set_id = ?, title = ?, description = ?, topic = ?, difficulty = ?, due_date = ?, publish_at = ?, submit_mode = ?, grading_criteria = ?, custom_grading_criteria = ?
         WHERE exercise_id = ?"
    );
    $dueDateParam = $due_date !== null ? $due_date : null;
    $gradingCriteriaJson = json_encode($gradingCriteria, JSON_UNESCAPED_UNICODE);
    $customGradingCriteriaJson = json_encode($customGradingCriteria, JSON_UNESCAPED_UNICODE);
    $updateStmt->bind_param("iisssssssssi", $subject_id, $rubric_set_id, $title, $description, $topic, $difficulty, $dueDateParam, $publishAtParam, $submit_mode, $gradingCriteriaJson, $customGradingCriteriaJson, $exercise_id);
    $updateStmt->execute();
    $updateStmt->close();

    // Delete old items
    $deleteItems = $conn->prepare("DELETE FROM exercise_items WHERE exercise_id = ?");
    $deleteItems->bind_param("i", $exercise_id);
    $deleteItems->execute();
    $deleteItems->close();

    // Insert new items
    $itemStmt = $conn->prepare(
        "INSERT INTO exercise_items (exercise_id, rubric_set_id, item_no, question_type, question_content, max_score, effort_minimum_guarantee)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    foreach ($items as $idx => $item) {
        $itemNo = isset($item['item_no']) ? intval($item['item_no']) : 1;
        $questionType = trim($item['question_type'] ?? 'handwritten_algebra');
        $content = trim($item['question_content'] ?? '');
        $maxScore = isset($item['max_score']) ? (float)$item['max_score'] : 1.0;
        $itemRubricId = $itemRubricIds[$idx] ?? null;
        $itemEffortMin = isset($item['effort_minimum_guarantee']) ? max(0, floatval($item['effort_minimum_guarantee'])) : 0.0;

        if ($questionType !== 'handwritten_algebra') {
            $questionType = 'handwritten_algebra';
        }
        if ($content === '') {
            throw new Exception('Each item must include question_content.');
        }

        $itemStmt->bind_param("iiissdd", $exercise_id, $itemRubricId, $itemNo, $questionType, $content, $maxScore, $itemEffortMin);
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
