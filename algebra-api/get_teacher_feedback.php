<?php
require_once 'db_connection.php';
require_once 'schema_utils.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;
$exercise_id = isset($_GET['exercise_id']) ? intval($_GET['exercise_id']) : null;

if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Teacher ID is required.']);
    exit();
}

try {
    ensureScoreAiFeedbackColumn($conn);
    ensureScoreMetricsColumns($conn);

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
            ep.exercise_id,
            ep.title AS assessment_title,
            subj.subject_id,
            subj.subject_name,
            subj.join_code AS subject_code,
            CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name,
            st.student_id,
            DATE_FORMAT(cs.date_uploaded, '%b %e, %Y') AS submission_date
        FROM Scores sc
        INNER JOIN Captured_Solution cs ON cs.solution_id = sc.solution_id
        INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
        INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
        LEFT JOIN Student st ON st.student_id = cs.student_id
        LEFT JOIN (
            SELECT exercise_id, COALESCE(SUM(max_score), 0) AS max_score_possible
            FROM exercise_items
            GROUP BY exercise_id
        ) ex ON ex.exercise_id = ep.exercise_id
        WHERE subj.teacher_id = ?
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
        ];
    }
    $stmt->close();

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
