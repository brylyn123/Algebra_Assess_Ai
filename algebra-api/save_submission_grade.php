<?php
require_once 'db_connection.php';

$data = json_decode(file_get_contents("php://input"), true);

$teacher_id = isset($data['teacher_id']) ? intval($data['teacher_id']) : null;
$solution_id = isset($data['solution_id']) ? intval($data['solution_id']) : null;
$score = isset($data['total_score_earned']) ? (float)$data['total_score_earned'] : null;
$teacher_feedback = trim((string)($data['teacher_feedback'] ?? ''));

if (!$teacher_id || !$solution_id || $score === null) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Teacher, submission, and score are required.']);
    exit();
}

try {
    $ownershipStmt = $conn->prepare(
        "SELECT
            cs.solution_id,
            ep.exercise_id,
            subj.subject_id,
            subj.teacher_id
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         WHERE cs.solution_id = ? AND subj.teacher_id = ?
         LIMIT 1"
    );
    $ownershipStmt->bind_param("ii", $solution_id, $teacher_id);
    $ownershipStmt->execute();
    $ownershipResult = $ownershipStmt->get_result();
    $submission = $ownershipResult ? $ownershipResult->fetch_assoc() : null;
    $ownershipStmt->close();

    if (!$submission) {
      http_response_code(404);
      echo json_encode(['status' => 'error', 'message' => 'Submission not found for this teacher.']);
      exit();
    }

    $existingStmt = $conn->prepare("SELECT score_id FROM Scores WHERE solution_id = ? LIMIT 1");
    $existingStmt->bind_param("i", $solution_id);
    $existingStmt->execute();
    $existingResult = $existingStmt->get_result();
    $existingScore = $existingResult ? $existingResult->fetch_assoc() : null;
    $existingStmt->close();

    if ($existingScore) {
        $updateStmt = $conn->prepare(
            "UPDATE Scores
             SET total_score_earned = ?, teacher_feedback = ?, date_scored = CURRENT_TIMESTAMP
             WHERE score_id = ?"
        );
        $scoreId = (int)$existingScore['score_id'];
        $updateStmt->bind_param("dsi", $score, $teacher_feedback, $scoreId);
        $updateStmt->execute();
        $updateStmt->close();
    } else {
        $insertStmt = $conn->prepare(
            "INSERT INTO Scores (solution_id, total_score_earned, teacher_feedback)
             VALUES (?, ?, ?)"
        );
        $insertStmt->bind_param("ids", $solution_id, $score, $teacher_feedback);
        $insertStmt->execute();
        $scoreId = $conn->insert_id;
        $insertStmt->close();
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Grade saved successfully.',
        'score_id' => (int)$scoreId,
        'solution_id' => $solution_id,
        'score' => round($score, 2),
        'teacher_feedback' => $teacher_feedback,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to save grade: ' . $e->getMessage()]);
}

$conn->close();
?>
