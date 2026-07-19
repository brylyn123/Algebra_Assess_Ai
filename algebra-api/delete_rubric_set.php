<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'auth.php';

$data = json_decode(file_get_contents("php://input"), true);
$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];
$rubric_set_id = isset($data['rubric_set_id']) ? intval($data['rubric_set_id']) : null;

if (!$teacher_id || !$rubric_set_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Teacher ID and rubric set ID are required."]);
    exit;
}

try {
    $checkStmt = $conn->prepare("SELECT teacher_user_id FROM rubric_sets WHERE rubric_set_id = ? LIMIT 1");
    $checkStmt->bind_param("i", $rubric_set_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();

    if (!$result || $result->num_rows === 0) {
        throw new Exception("Rubric not found.");
    }

    $row = $result->fetch_assoc();
    if ((int)$row['teacher_user_id'] !== $teacher_id) {
        throw new Exception("Rubric does not belong to this teacher.");
    }

    $conn->begin_transaction();

    $deleteItems = $conn->prepare("DELETE FROM rubric_set_items WHERE rubric_set_id = ?");
    $deleteItems->bind_param("i", $rubric_set_id);
    $deleteItems->execute();
    $deleteItems->close();

    $deleteSet = $conn->prepare("DELETE FROM rubric_sets WHERE rubric_set_id = ?");
    $deleteSet->bind_param("i", $rubric_set_id);
    $deleteSet->execute();
    $deleteSet->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Rubric deleted."]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
