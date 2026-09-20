<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'notifications_helper.php';

$data = json_decode(file_get_contents("php://input"), true);

$extractOverallScore = static function (array $payload): ?float {
    foreach (['total_score_earned', 'score', 'overall_score'] as $field) {
        if (isset($payload[$field]) && $payload[$field] !== '' && $payload[$field] !== null) {
            return (float)$payload[$field];
        }
    }

    return null;
};

$extractOverallFeedback = static function (array $payload): string {
    foreach (['ai_feedback', 'overall_feedback', 'feedback', 'summary_feedback'] as $field) {
        if (isset($payload[$field])) {
            return trim((string)$payload[$field]);
        }
    }

    return '';
};

$extractItemScores = static function (array $payload): array {
    foreach (['item_scores', 'items', 'item_results'] as $field) {
        if (isset($payload[$field]) && is_array($payload[$field])) {
            return $payload[$field];
        }
    }

    return [];
};

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$solution_id = isset($data['solution_id']) ? intval($data['solution_id']) : null;
$ai_generation = isset($data['ai_generation']) && is_array($data['ai_generation']) ? $data['ai_generation'] : [];
$score = isset($data['total_score_earned']) ? (float)$data['total_score_earned'] : $extractOverallScore($ai_generation);
$ai_feedback = trim((string)($data['ai_feedback'] ?? $data['teacher_feedback'] ?? $extractOverallFeedback($ai_generation)));
$item_scores = isset($data['item_scores']) && is_array($data['item_scores']) ? $data['item_scores'] : $extractItemScores($ai_generation);
$ai_model = trim((string)($data['ai_model'] ?? $ai_generation['model'] ?? ''));
$ocrText = isset($data['ocr_text']) ? trim((string)$data['ocr_text']) : null;
$ocrOnly = !empty($data['ocr_only']);

if (!$solution_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Submission is required.']);
    exit();
}

if (!$ocrOnly && $score === null) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Score is required when not saving OCR text only.']);
    exit();
}

try {
    ensureScoreAiFeedbackColumn($conn);
    ensureScoreMetricsColumns($conn);
    ensureScoreReturnColumn($conn);

    $ownershipStmt = $conn->prepare(
        "SELECT
            cs.solution_id,
            cs.ai_raw_json,
            ep.exercise_id,
            subj.subject_id,
            subj.teacher_user_id
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         WHERE cs.solution_id = ? AND subj.teacher_user_id = ?
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

    $maxScoreStmt = $conn->prepare(
        "SELECT COALESCE(SUM(max_score), 0) AS max_score_possible
         FROM exercise_items
         WHERE exercise_id = ?"
    );
    $maxScoreStmt->bind_param("i", $submission['exercise_id']);
    $maxScoreStmt->execute();
    $maxScoreResult = $maxScoreStmt->get_result();
    $maxScoreRow = $maxScoreResult ? $maxScoreResult->fetch_assoc() : null;
    $maxScoreStmt->close();

    $maxScorePossible = isset($maxScoreRow['max_score_possible']) ? (float)$maxScoreRow['max_score_possible'] : 0.0;
    $rawScore = $maxScorePossible > 0
        ? round(($score / 100.0) * $maxScorePossible, 2)
        : null;

    $validItemsStmt = $conn->prepare(
        "SELECT item_id
         FROM exercise_items
         WHERE exercise_id = ?"
    );
    $exerciseId = (int)$submission['exercise_id'];
    $validItemsStmt->bind_param("i", $exerciseId);
    $validItemsStmt->execute();
    $validItemsResult = $validItemsStmt->get_result();
    $validItemIds = [];
    while ($validItemRow = $validItemsResult->fetch_assoc()) {
        $validItemIds[(int)$validItemRow['item_id']] = true;
    }
    $validItemsStmt->close();

    $existingRawPayload = [];
    $existingRawJson = $submission['ai_raw_json'] ?? null;
    if ($existingRawJson) {
        $decodedRaw = json_decode((string)$existingRawJson, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedRaw)) {
            $existingRawPayload = $decodedRaw;
        }
    }

    $conn->begin_transaction();

    $scoreId = null;

    if (!$ocrOnly) {
        $existingStmt = $conn->prepare("SELECT score_id FROM Scores WHERE solution_id = ? LIMIT 1");
        $existingStmt->bind_param("i", $solution_id);
        $existingStmt->execute();
        $existingResult = $existingStmt->get_result();
        $existingScore = $existingResult ? $existingResult->fetch_assoc() : null;
        $existingStmt->close();

        if ($existingScore) {
            $updateStmt = $conn->prepare(
                "UPDATE Scores
                 SET total_score_earned = ?, raw_score_earned = ?, max_score_possible = ?, ai_feedback = ?, date_scored = CURRENT_TIMESTAMP
                 WHERE score_id = ?"
            );
            $scoreId = (int)$existingScore['score_id'];
            $updateStmt->bind_param("dddsi", $score, $rawScore, $maxScorePossible, $ai_feedback, $scoreId);
            $updateStmt->execute();
            $updateStmt->close();
        } else {
            $insertStmt = $conn->prepare(
                "INSERT INTO Scores (solution_id, total_score_earned, raw_score_earned, max_score_possible, ai_feedback)
                 VALUES (?, ?, ?, ?, ?)"
            );
            $insertStmt->bind_param("iddds", $solution_id, $score, $rawScore, $maxScorePossible, $ai_feedback);
            $insertStmt->execute();
            $scoreId = $conn->insert_id;
            $insertStmt->close();
        }

        if (count($item_scores) > 0) {
            $deleteItemScoresStmt = $conn->prepare("DELETE FROM Item_Scores WHERE solution_id = ?");
            $deleteItemScoresStmt->bind_param("i", $solution_id);
            $deleteItemScoresStmt->execute();
            $deleteItemScoresStmt->close();

            $insertItemScoreStmt = $conn->prepare(
                "INSERT INTO Item_Scores (solution_id, item_id, score_earned, ai_feedback, is_manual_override)
                 VALUES (?, ?, ?, ?, ?)"
            );

            foreach ($item_scores as $itemScore) {
                $itemId = isset($itemScore['item_id']) ? (int)$itemScore['item_id'] : 0;
                if (!$itemId || !isset($validItemIds[$itemId])) {
                    continue;
                }

                $itemFeedback = trim((string)($itemScore['ai_feedback'] ?? ''));
                $scoreEarned = isset($itemScore['score_earned']) ? (float)$itemScore['score_earned'] : 0.0;
                $isManualOverride = !empty($itemScore['is_manual_override']) ? 1 : 0;

                $insertItemScoreStmt->bind_param(
                    "iidsi",
                    $solution_id,
                    $itemId,
                    $scoreEarned,
                    $itemFeedback,
                    $isManualOverride
                );
                $insertItemScoreStmt->execute();
            }

            $insertItemScoreStmt->close();
        }

        $gradingPayload = [
            'model' => $ai_model !== '' ? $ai_model : null,
            'saved_at' => gmdate('c'),
            'overall_score' => $score !== null ? round($score, 2) : null,
            'overall_feedback' => $ai_feedback,
            'criteria_scores' => isset($ai_generation['criteria_scores']) && is_array($ai_generation['criteria_scores'])
                ? $ai_generation['criteria_scores']
                : ($existingRawPayload['grading_draft']['criteria_scores'] ?? []),
            'item_scores' => array_values(array_map(
                static function (array $itemScore): array {
                    $raw = isset($itemScore['score_earned']) && $itemScore['score_earned'] !== ''
                        ? (float)$itemScore['score_earned']
                        : null;
                    $isManual = !empty($itemScore['is_manual_override']);
                    return [
                        'item_id' => isset($itemScore['item_id']) ? (int)$itemScore['item_id'] : null,
                        'item_no' => isset($itemScore['item_no']) ? (int)$itemScore['item_no'] : null,
                        'score_earned' => $raw,
                        'ai_feedback' => trim((string)($itemScore['ai_feedback'] ?? '')),
                        'is_manual_override' => $isManual,
                    ];
                },
                $item_scores
            )),
            'raw_response' => isset($data['ai_raw_response']) ? $data['ai_raw_response'] : $ai_generation,
        ];

        $mergedRawPayload = $existingRawPayload;
        $mergedRawPayload['grading'] = $gradingPayload;
        $mergedRawPayload['latest_saved_score'] = [
            'score_id' => (int)$scoreId,
            'solution_id' => (int)$solution_id,
            'total_score_earned' => $score !== null ? round($score, 2) : null,
            'raw_score_earned' => $rawScore,
            'max_score_possible' => $maxScorePossible > 0 ? round($maxScorePossible, 2) : null,
            'ai_feedback' => $ai_feedback,
        ];
    } else {
        $mergedRawPayload = $existingRawPayload;
    }

    $mergedRawJson = json_encode($mergedRawPayload);
    $statusValue = 'completed';
    $solutionUpdateStmt = $conn->prepare(
        "UPDATE Captured_Solution
         SET ai_status = ?, ai_raw_json = ?
         WHERE solution_id = ?"
    );
    $solutionUpdateStmt->bind_param("ssi", $statusValue, $mergedRawJson, $solution_id);
    $solutionUpdateStmt->execute();
    $solutionUpdateStmt->close();

    if ($ocrText !== null) {
        $ocrUpdateStmt = $conn->prepare(
            "UPDATE Captured_Solution SET ocr_text = ? WHERE solution_id = ?"
        );
        $ocrUpdateStmt->bind_param("si", $ocrText, $solution_id);
        $ocrUpdateStmt->execute();
        $ocrUpdateStmt->close();
    }

    $conn->commit();

    // Auto-return: set returned_at so the student can see the grade immediately (skip for OCR-only saves)
    $autoReturnSuccess = false;
    if (!$ocrOnly && $scoreId) {
        try {
            ensureScoreReturnColumn($conn);
            $returnStmt = $conn->prepare(
                "UPDATE Scores SET returned_at = COALESCE(returned_at, CURRENT_TIMESTAMP) WHERE score_id = ?"
            );
            $returnStmt->bind_param("i", $scoreId);
            $returnStmt->execute();
            $autoReturnSuccess = $returnStmt->affected_rows > 0 || $conn->info !== '';
            $returnStmt->close();
        } catch (Exception $e) {
            error_log('Auto-return failed for score ' . $scoreId . ': ' . $e->getMessage());
        }
    }

    // Send notification to student (skip for OCR-only saves)
    if (!$ocrOnly && $scoreId) {
        try {
        $notifStmt = $conn->prepare(
            "SELECT cs.student_user_id, u.email, ep.exercise_id, ep.title AS exercise_title, s.subject_name,
                    sc.total_score_earned, sc.max_score_possible
             FROM Scores sc
             INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
             INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
             INNER JOIN Subject s ON s.subject_id = ep.subject_id
             INNER JOIN Users u ON u.user_id = cs.student_user_id
             WHERE sc.score_id = ? LIMIT 1"
        );
        $notifStmt->bind_param('i', $scoreId);
        $notifStmt->execute();
        $notifRow = $notifStmt->get_result()->fetch_assoc();
        $notifStmt->close();

        if ($notifRow) {
            $studentId = (int)$notifRow['student_user_id'];
            $studentEmail = (string)($notifRow['email'] ?? '');
            $exerciseTitle = (string)($notifRow['exercise_title'] ?? 'your assessment');
            $subjectName = (string)($notifRow['subject_name'] ?? '');
            $scoreVal = $notifRow['total_score_earned'] !== null ? round((float)$notifRow['total_score_earned'], 1) : '?';
            $maxScoreVal = $notifRow['max_score_possible'] !== null ? round((float)$notifRow['max_score_possible'], 1) : '?';

            $notifMsg = "Your grade for \"{$exerciseTitle}\" in {$subjectName} has been returned. Score: {$scoreVal}/{$maxScoreVal}";
            createNotification($conn, $studentId, $teacher_id, 'grade_returned', 'Grade Returned', $notifMsg, 'exercise', (int)$notifRow['exercise_id']);
            if (!empty($studentEmail)) {
                sendNotificationEmail($studentEmail, 'grade_returned', "Grade Returned: {$exerciseTitle}", $notifMsg);
            }
        }
    } catch (Exception $e) {
        error_log('Failed to send grade returned notification for score ' . $scoreId . ': ' . $e->getMessage());
    }
    }

    echo json_encode([
        'status' => 'success',
        'message' => $autoReturnSuccess ? 'Grade saved and returned successfully.' : 'Grade saved. Return to student may require manual action.',
        'score_id' => (int)$scoreId,
        'solution_id' => $solution_id,
        'score' => round($score, 2),
        'raw_score_earned' => $rawScore,
        'max_score_possible' => $maxScorePossible > 0 ? round($maxScorePossible, 2) : null,
        'ai_feedback' => $ai_feedback,
        'item_scores_saved' => count($item_scores),
        'ai_status' => 'completed',
        'ocr_text' => $ocrText,
        'returned' => $autoReturnSuccess,
    ]);
} catch (Exception $e) {
    if ($conn->in_transaction) {
        $conn->rollback();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to save grade.']);
}

$conn->close();
?>
