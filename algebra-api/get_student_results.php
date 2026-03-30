<?php
require_once 'db_connection.php';
require_once 'schema_utils.php';

$student_id = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;

if (!$student_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student ID is required.']);
    exit();
}

try {
    ensureScoreAiFeedbackColumn($conn);
    ensureScoreMetricsColumns($conn);

    $stmt = $conn->prepare("
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
            sc.teacher_feedback,
            sc.date_scored,
            ep.exercise_id,
            ep.title AS assessment_title,
            subj.subject_id,
            subj.subject_name,
            subj.join_code AS subject_code,
            DATE_FORMAT(cs.date_uploaded, '%b %e, %Y') AS submission_date
        FROM Scores sc
        INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
        INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
        INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
        LEFT JOIN (
            SELECT exercise_id, COALESCE(SUM(max_score), 0) AS max_score_possible
            FROM exercise_items
            GROUP BY exercise_id
        ) ex ON ex.exercise_id = ep.exercise_id
        WHERE cs.student_id = ?
        ORDER BY subj.subject_name ASC, ep.title ASC, sc.date_scored DESC, sc.score_id DESC
    ");

    $stmt->bind_param('i', $student_id);
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
            'submission_date' => $row['submission_date'],
            'score' => $row['total_score_earned'] !== null ? round((float)$row['total_score_earned'], 2) : null,
            'raw_score_earned' => $row['raw_score_earned'] !== null ? round((float)$row['raw_score_earned'], 2) : null,
            'max_score_possible' => $row['max_score_possible'] !== null ? round((float)$row['max_score_possible'], 2) : null,
            'ai_feedback' => $row['ai_feedback'] ?? '',
            'teacher_feedback' => $row['teacher_feedback'] ?? '',
            'date_scored' => $row['date_scored'],
        ];
    }

    $stmt->close();

    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'success',
        'records' => $records,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load student results: ' . $e->getMessage()]);
}

$conn->close();
?>
