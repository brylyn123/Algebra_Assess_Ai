<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'notifications_helper.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : 0;

$solutionIds = [];
if (isset($data['solution_ids']) && is_array($data['solution_ids'])) {
    foreach ($data['solution_ids'] as $rawId) {
        $rawId = intval($rawId);
        if ($rawId > 0) {
            $solutionIds[] = $rawId;
        }
    }
    $solutionIds = array_values(array_unique($solutionIds));
}

$useSolutionIds = !empty($solutionIds);

if (!$exercise_id && !$useSolutionIds) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Assessment or submission selection is required.']);
    exit();
}

try {
    ensureScoreReturnColumn($conn);

    $targetIds = [];

    if ($useSolutionIds) {
        // Multi-select: return only the chosen submissions (partial returns allowed).
        $checkStmt = $conn->prepare(
            "SELECT sc.solution_id
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
             WHERE sc.solution_id = ?
               AND subj.teacher_user_id = ?
               AND sc.returned_at IS NULL
             LIMIT 1"
        );
        foreach ($solutionIds as $solutionId) {
            $checkStmt->bind_param('ii', $solutionId, $teacher_id);
            $checkStmt->execute();
            $row = $checkStmt->get_result()->fetch_assoc();
            if ($row) {
                $targetIds[] = (int)$row['solution_id'];
            }
        }
        $checkStmt->close();
    } else {
        // Whole-assessment return: every student must be saved first.
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

        $targetStmt = $conn->prepare(
            "SELECT sc.solution_id
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
             WHERE ep.exercise_id = ?
               AND subj.teacher_user_id = ?
               AND sc.returned_at IS NULL"
        );
        $targetStmt->bind_param('ii', $exercise_id, $teacher_id);
        $targetStmt->execute();
        $targetResult = $targetStmt->get_result();
        while ($row = $targetResult->fetch_assoc()) {
            $targetIds[] = (int)$row['solution_id'];
        }
        $targetStmt->close();
    }

    if (empty($targetIds)) {
        echo json_encode([
            'status' => 'success',
            'message' => 'No pending results to return.',
            'exercise_id' => $exercise_id ?: null,
            'returned_count' => 0,
            'returned_solution_ids' => [],
        ]);
        $conn->close();
        exit();
    }

    $returnStmt = $conn->prepare(
        "UPDATE Scores
         SET returned_at = CURRENT_TIMESTAMP
         WHERE solution_id = ? AND returned_at IS NULL"
    );
    $returnedIds = [];
    foreach ($targetIds as $solutionId) {
        $returnStmt->bind_param('i', $solutionId);
        $returnStmt->execute();
        if ($returnStmt->affected_rows > 0) {
            $returnedIds[] = $solutionId;
        }
    }
    $returnStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => count($returnedIds) === 1
            ? 'Result returned successfully.'
            : 'Assessment results returned successfully.',
        'exercise_id' => $exercise_id ?: null,
        'returned_count' => count($returnedIds),
        'returned_solution_ids' => $returnedIds,
    ]);

    // Notify only the students whose grades were newly returned
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

        foreach ($returnedIds as $solutionId) {
            $infoStmt->bind_param('i', $solutionId);
            $infoStmt->execute();
            $infoRow = $infoStmt->get_result()->fetch_assoc();

            if (!$infoRow) {
                continue;
            }

            $studentId = (int)$infoRow['student_user_id'];
            $studentEmail = (string)($infoRow['email'] ?? '');
            $exerciseTitle = (string)($infoRow['exercise_title'] ?? 'your assessment');
            $subjectName = (string)($infoRow['subject_name'] ?? '');
            $score = $infoRow['total_score_earned'] !== null ? round((float)$infoRow['total_score_earned'], 1) : '?';
            $maxScore = $infoRow['max_score_possible'] !== null ? round((float)$infoRow['max_score_possible'], 1) : '?';

            $notifMsg = "Your grade for \"{$exerciseTitle}\" in {$subjectName} has been returned. Score: {$score}/{$maxScore}";
            createNotification($conn, $studentId, $teacher_id, 'grade_returned', 'Grade Returned', $notifMsg, 'exercise', (int)$infoRow['exercise_id']);
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
