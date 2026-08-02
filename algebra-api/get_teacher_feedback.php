<?php
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];
$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;
$exercise_id = isset($_GET['exercise_id']) ? intval($_GET['exercise_id']) : null;

try {
    ensureScoreAiFeedbackColumn($conn);
    ensureScoreMetricsColumns($conn);
    ensureScoreReturnColumn($conn);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    $query = "
        SELECT
            sc.score_id,
            sc.solution_id,
            sc.total_score_earned,
            COALESCE(
                sc.raw_score_earned,
                CASE
                    WHEN ex.max_score_possible > 0 AND sc.total_score_earned IS NOT NULL
                        THEN ROUND((sc.total_score_earned / 100) * ex.max_score_possible, 2)
                    ELSE NULL
                END
            ) AS raw_score_earned,
            COALESCE(sc.max_score_possible, ex.max_score_possible) AS max_score_possible,
            sc.ai_feedback,
            sc.date_scored,
            sc.returned_at,
            ep.exercise_id,
            ep.title AS assessment_title,
            subj.subject_id,
            subj.subject_name,
            subj.join_code AS subject_code,
            CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name,
            st.institutional_id AS student_id,
            DATE_FORMAT(cs.date_uploaded, '%b %e, %Y') AS submission_date
        FROM Scores sc
        INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
        INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
        INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
        LEFT JOIN {$userTable} st ON st.user_id = cs.student_user_id
        LEFT JOIN (
            SELECT exercise_id, COALESCE(SUM(max_score), 0) AS max_score_possible
            FROM exercise_items
            GROUP BY exercise_id
        ) ex ON ex.exercise_id = ep.exercise_id
        WHERE subj.teacher_user_id = ?
          AND sc.returned_at IS NOT NULL
    ";

    $types = 'i';
    $params = [$teacher_id];

    if ($subject_id) {
        $query .= " AND subj.subject_id = ? ";
        $types .= 'i';
        $params[] = $subject_id;
    }

    if ($exercise_id) {
        $query .= " AND ep.exercise_id = ? ";
        $types .= 'i';
        $params[] = $exercise_id;
    }

    $query .= " ORDER BY sc.date_scored DESC, sc.score_id DESC";

    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $records = [];
    while ($row = $result->fetch_assoc()) {
        $records[] = [
            'score_id' => (int)$row['score_id'],
            'solution_id' => (int)$row['solution_id'],
            'exercise_id' => (int)$row['exercise_id'],
            'assessment_title' => $row['assessment_title'],
            'subject_id' => (int)$row['subject_id'],
            'subject_name' => $row['subject_name'],
            'subject_code' => $row['subject_code'],
            'student_name' => $row['student_name'] ?: 'Unknown Student',
            'student_id' => $row['student_id'],
            'submission_date' => $row['submission_date'],
            'score' => $row['total_score_earned'] !== null ? round((float)$row['total_score_earned'], 2) : null,
            'raw_score_earned' => $row['raw_score_earned'] !== null ? round((float)$row['raw_score_earned'], 2) : null,
            'max_score_possible' => $row['max_score_possible'] !== null ? round((float)$row['max_score_possible'], 2) : null,
            'ai_feedback' => $row['ai_feedback'] ?? '',
            'date_scored' => $row['date_scored'],
            'returned_at' => $row['returned_at'],
            'item_scores' => [],
        ];
    }
    $stmt->close();

    if (count($records) > 0) {
        $solutionIds = array_map(static fn($record) => (int)$record['solution_id'], $records);
        $placeholders = implode(',', array_fill(0, count($solutionIds), '?'));
        $itemStmt = $conn->prepare(
            "SELECT
                iscore.solution_id,
                iscore.item_score_id,
                iscore.item_id,
                ei.item_no,
                ei.question_content,
                ei.max_score,
                iscore.score_earned,
                iscore.ai_feedback,
                iscore.is_manual_override
             FROM Item_Scores iscore
             INNER JOIN exercise_items ei ON ei.item_id = iscore.item_id
             WHERE iscore.solution_id IN ($placeholders)
             ORDER BY iscore.solution_id ASC, ei.item_no ASC"
        );
        $itemStmt->bind_param(str_repeat('i', count($solutionIds)), ...$solutionIds);
        $itemStmt->execute();
        $itemResult = $itemStmt->get_result();

        $recordsBySolutionId = [];
        foreach ($records as $index => $record) {
            $recordsBySolutionId[(int)$record['solution_id']] = $index;
        }

        while ($itemRow = $itemResult->fetch_assoc()) {
            $solutionId = (int)$itemRow['solution_id'];
            if (!isset($recordsBySolutionId[$solutionId])) {
                continue;
            }

            $records[$recordsBySolutionId[$solutionId]]['item_scores'][] = [
                'item_score_id' => (int)$itemRow['item_score_id'],
                'item_id' => (int)$itemRow['item_id'],
                'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
                'question_content' => $itemRow['question_content'],
                'max_score' => isset($itemRow['max_score']) ? round((float)$itemRow['max_score'], 2) : null,
                'score_earned' => $itemRow['score_earned'] !== null ? round((float)$itemRow['score_earned'], 2) : null,
                'ai_feedback' => $itemRow['ai_feedback'] ?? '',
                'is_manual_override' => !empty($itemRow['is_manual_override']),
            ];
        }

        $itemStmt->close();
    }

    setCacheHeaders(60);
    echo json_encode([
        'status' => 'success',
        'records' => $records,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load feedback records: ' . $e->getMessage()]);
}

$conn->close();
?>
