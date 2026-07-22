<?php
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$solution_id = isset($data['solution_id']) ? intval($data['solution_id']) : null;

if (!$solution_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Submission is required.']);
    exit();
}

try {
    ensureScoreReturnColumn($conn);

    $stmt = $conn->prepare(
        "UPDATE Scores sc
         INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         SET sc.returned_at = COALESCE(sc.returned_at, CURRENT_TIMESTAMP)
         WHERE sc.solution_id = ?
           AND subj.teacher_user_id = ?"
    );
    $stmt->bind_param('ii', $solution_id, $teacher_id);
    $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    if ($affectedRows <= 0) {
        $checkStmt = $conn->prepare(
            "SELECT sc.score_id
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
             WHERE sc.solution_id = ?
               AND subj.teacher_user_id = ?
             LIMIT 1"
        );
        $checkStmt->bind_param('ii', $solution_id, $teacher_id);
        $checkStmt->execute();
        $existing = $checkStmt->get_result()->fetch_assoc();
        $checkStmt->close();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Saved score not found for this submission.']);
            exit();
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Result returned successfully.',
        'solution_id' => $solution_id,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to return result: ' . $e->getMessage()]);
}

$conn->close();
?>
