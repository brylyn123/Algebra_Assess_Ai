<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'notifications_helper.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : null;

if (!$exercise_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Assessment is required.']);
    exit();
}

try {
    ensureScoreReturnColumn($conn);

    $readyStmt = $conn->prepare(
        "SELECT
            COUNT(cs.solution_id) AS total_submissions,
            COUNT(sc.score_id) AS total_saved,
            SUM(CASE WHEN sc.score_id IS NULL THEN 1 ELSE 0 END) AS missing_saved_results,
            SUM(CASE WHEN sc.returned_at IS NULL AND sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS ready_to_return
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE ep.exercise_id = ?
           AND subj.teacher_user_id = ?"
    );
    $readyStmt->bind_param('ii', $exercise_id, $teacher_id);
    $readyStmt->execute();
    $summary = $readyStmt->get_result()->fetch_assoc();
    $readyStmt->close();

    if (!$summary || (int)($summary['total_saved'] ?? 0) === 0) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'No saved results were found for this assessment.']);
        exit();
    }

    if ((int)($summary['missing_saved_results'] ?? 0) > 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Save every student result in this assessment before returning it.']);
        exit();
    }

    $returnStmt = $conn->prepare(
        "UPDATE Scores sc
         INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         SET sc.returned_at = COALESCE(sc.returned_at, CURRENT_TIMESTAMP)
         WHERE ep.exercise_id = ?
           AND subj.teacher_user_id = ?"
    );
    $returnStmt->bind_param('ii', $exercise_id, $teacher_id);
    $returnStmt->execute();
    $affectedRows = $returnStmt->affected_rows;
    $returnStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'Assessment results returned successfully.',
        'exercise_id' => $exercise_id,
        'returned_count' => max(0, (int)$affectedRows),
    ]);

    // Notify all students whose grades were returned
    try {
        $infoStmt = $conn->prepare(
            "SELECT cs.student_user_id, u.email, ep.title AS exercise_title, s.subject_name,
                    sc.total_score_earned, sc.max_score_possible
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject s ON s.subject_id = ep.subject_id
             INNER JOIN Users u ON u.user_id = cs.student_user_id
             WHERE ep.exercise_id = ?
               AND s.teacher_user_id = ?
               AND sc.returned_at IS NOT NULL"
        );
        $infoStmt->bind_param('ii', $exercise_id, $teacher_id);
        $infoStmt->execute();
        $infoResult = $infoStmt->get_result();

        while ($infoRow = $infoResult->fetch_assoc()) {
            $studentId = (int)$infoRow['student_user_id'];
            $studentEmail = (string)($infoRow['email'] ?? '');
            $exerciseTitle = (string)($infoRow['exercise_title'] ?? 'your assessment');
            $subjectName = (string)($infoRow['subject_name'] ?? '');
            $score = $infoRow['total_score_earned'] !== null ? round((float)$infoRow['total_score_earned'], 1) : '?';
            $maxScore = $infoRow['max_score_possible'] !== null ? round((float)$infoRow['max_score_possible'], 1) : '?';

            $notifMsg = "Your grade for \"{$exerciseTitle}\" in {$subjectName} has been returned. Score: {$score}/{$maxScore}";
            createNotification($conn, $studentId, $teacher_id, 'grade_returned', 'Grade Returned', $notifMsg, 'exercise', $exercise_id);
            if (!empty($studentEmail)) {
                sendNotificationEmail($studentEmail, 'grade_returned', "Grade Returned: {$exerciseTitle}", $notifMsg);
            }
        }
        $infoStmt->close();
    } catch (Exception $e) {
        error_log('Failed to send bulk grade returned notifications: ' . $e->getMessage());
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to return assessment results.']);
}

$conn->close();
?>
