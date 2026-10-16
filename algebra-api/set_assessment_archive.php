<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$exerciseIds = [];
if (!empty($data['exercise_ids']) && is_array($data['exercise_ids'])) {
    $exerciseIds = array_map('intval', $data['exercise_ids']);
    $exerciseIds = array_values(array_unique(array_filter($exerciseIds, fn($id) => $id > 0)));
}
$archived = empty($data['archived']) ? 0 : 1;

if (empty($exerciseIds)) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "At least one assessment ID is required."]);
    exit;
}

try {
    ensureAssessmentArchiveColumns($conn);

    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    $placeholders = implode(',', array_fill(0, count($exerciseIds), '?'));
    $types = 'ii' . str_repeat('i', count($exerciseIds));

    $stmt = $conn->prepare(
        "UPDATE exercises_problem ep
         INNER JOIN {$subjectTable} s ON s.subject_id = ep.subject_id
         SET ep.archived = ?
         WHERE s.teacher_user_id = ?
           AND ep.exercise_id IN ({$placeholders})"
    );
    $stmt->bind_param($types, $archived, $teacher_id, ...$exerciseIds);
    $stmt->execute();
    $updatedRows = $stmt->affected_rows;
    $stmt->close();

    echo json_encode([
        "status" => "success",
        "archived" => $archived,
        "requested" => count($exerciseIds),
        "updated" => $updatedRows,
        "message" => $archived === 1 ? "Assessment archived." : "Assessment restored.",
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to update the assessment archive state."]);
}

$conn->close();
?>
