<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'notifications_helper.php';

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

    // Notify the student that their grade was returned
    try {
        $infoStmt = $conn->prepare(
            "SELECT cs.student_user_id, u.email, ep.exercise_id, ep.title AS exercise_title, s.subject_name,
                    sc.total_score_earned, sc.max_score_possible
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject s ON s.subject_id = ep.subject_id
             INNER JOIN Users u ON u.user_id = cs.student_user_id
             WHERE sc.solution_id = ? LIMIT 1"
        );
        $infoStmt->bind_param('i', $solution_id);
        $infoStmt->execute();
        $infoRow = $infoStmt->get_result()->fetch_assoc();
        $infoStmt->close();

        if ($infoRow) {
            $studentId = (int)$infoRow['student_user_id'];
            $studentEmail = (string)($infoRow['email'] ?? '');
            $exerciseId = (int)$infoRow['exercise_id'];
            $exerciseTitle = (string)($infoRow['exercise_title'] ?? 'your assessment');
            $subjectName = (string)($infoRow['subject_name'] ?? '');
            $score = $infoRow['total_score_earned'] !== null ? round((float)$infoRow['total_score_earned'], 1) : '?';
            $maxScore = $infoRow['max_score_possible'] !== null ? round((float)$infoRow['max_score_possible'], 1) : '?';

            $notifMsg = "Your grade for \"{$exerciseTitle}\" in {$subjectName} has been returned. Score: {$score}/{$maxScore}";
            createNotification($conn, $studentId, $teacher_id, 'grade_returned', 'Grade Returned', $notifMsg, 'exercise', $exerciseId);
            if (!empty($studentEmail)) {
                sendNotificationEmail($studentEmail, 'grade_returned', "Grade Returned: {$exerciseTitle}", $notifMsg);
            }
        }
    } catch (Exception $e) {
        error_log('Failed to send grade returned notification: ' . $e->getMessage());
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to return result.']);
}

$conn->close();
?>
