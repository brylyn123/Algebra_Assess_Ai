<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'auth.php';

$data = json_decode(file_get_contents("php://input"), true);
$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];
$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : null;

if (!$teacher_id || !$exercise_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Teacher ID and exercise ID are required."]);
    exit;
}

try {
    $checkStmt = $conn->prepare(
        "SELECT ep.exercise_id
         FROM exercises_problem ep
         INNER JOIN subject s ON ep.subject_id = s.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?"
    );
    $checkStmt->bind_param("ii", $exercise_id, $teacher_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();

    if (!$result || $result->num_rows === 0) {
        throw new Exception("Assessment not found for this teacher.");
    }

    $conn->begin_transaction();

    $itemScoreStmt = $conn->prepare(
        "DELETE iscore
         FROM Item_Scores iscore
         INNER JOIN Captured_Solution cs ON cs.solution_id = iscore.solution_id
         WHERE cs.exercise_id = ?"
    );
    $itemScoreStmt->bind_param("i", $exercise_id);
    $itemScoreStmt->execute();
    $itemScoreStmt->close();

    $scoreStmt = $conn->prepare(
        "DELETE sc
         FROM Scores sc
         INNER JOIN Captured_Solution cs ON sc.solution_id = cs.solution_id
         WHERE cs.exercise_id = ?"
    );
    $scoreStmt->bind_param("i", $exercise_id);
    $scoreStmt->execute();
    $scoreStmt->close();

    $solutionStmt = $conn->prepare("DELETE FROM Captured_Solution WHERE exercise_id = ?");
    $solutionStmt->bind_param("i", $exercise_id);
    $solutionStmt->execute();
    $solutionStmt->close();

    $itemStmt = $conn->prepare("DELETE FROM exercise_items WHERE exercise_id = ?");
    $itemStmt->bind_param("i", $exercise_id);
    $itemStmt->execute();
    $itemStmt->close();

    $exerciseStmt = $conn->prepare("DELETE FROM exercises_problem WHERE exercise_id = ?");
    $exerciseStmt->bind_param("i", $exercise_id);
    $exerciseStmt->execute();
    $exerciseStmt->close();

    $conn->commit();

    echo json_encode(["status" => "success", "message" => "Assessment deleted."]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
