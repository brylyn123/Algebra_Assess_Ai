<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : null;

if (!$exercise_id) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Missing exercise_id."]);
    exit;
}

try {
    ensureAssessmentDueDate($conn);

    $checkStmt = $conn->prepare(
        "SELECT ep.exercise_id, ep.is_published
         FROM exercises_problem ep
         INNER JOIN subject s ON ep.subject_id = s.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?
         LIMIT 1"
    );
    $checkStmt->bind_param("ii", $exercise_id, $teacher_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $checkRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$checkRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Assessment not found or access denied."]);
        exit;
    }

    $itemStmt = $conn->prepare(
        "SELECT COUNT(*) AS cnt FROM exercise_items WHERE exercise_id = ?"
    );
    $itemStmt->bind_param("i", $exercise_id);
    $itemStmt->execute();
    $itemResult = $itemStmt->get_result();
    $itemRow = $itemResult->fetch_assoc();
    $itemStmt->close();

    if ((int)($itemRow['cnt'] ?? 0) === 0) {
        http_response_code(422);
        echo json_encode(["status" => "error", "message" => "Cannot publish an assessment with no questions. Add at least one question first."]);
        exit;
    }

    $publishStmt = $conn->prepare(
        "UPDATE exercises_problem SET is_published = 1 WHERE exercise_id = ?"
    );
    $publishStmt->bind_param("i", $exercise_id);
    $publishStmt->execute();
    $publishStmt->close();

    echo json_encode([
        "status" => "success",
        "message" => "Assessment published. Students can now see it.",
        "exercise_id" => $exercise_id,
    ]);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Unable to publish assessment."]);
}

$conn->close();
?>
