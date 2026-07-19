<?php
require_once 'auth.php';
require_once 'db_connection.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    $summaryStmt = $conn->prepare(
        "SELECT
            COUNT(cs.solution_id) AS total_submissions,
            SUM(CASE WHEN sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS graded_submissions,
            SUM(CASE WHEN sc.score_id IS NULL THEN 1 ELSE 0 END) AS pending_submissions,
            AVG(sc.total_score_earned) AS average_score,
            MAX(sc.total_score_earned) AS highest_score,
            MIN(sc.total_score_earned) AS lowest_score
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE subj.teacher_user_id = ?"
    );
    $summaryStmt->bind_param("i", $teacher_id);
    $summaryStmt->execute();
    $summary = $summaryStmt->get_result()->fetch_assoc();
    $summaryStmt->close();

    $subjectStmt = $conn->prepare(
        "SELECT
            subj.subject_id,
            subj.subject_name,
            COUNT(cs.solution_id) AS submissions,
            SUM(CASE WHEN sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS graded,
            AVG(sc.total_score_earned) AS average_score
         FROM Subject subj
         LEFT JOIN Exercises_Problem ep ON ep.subject_id = subj.subject_id
         LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE subj.teacher_user_id = ?
         GROUP BY subj.subject_id, subj.subject_name
         ORDER BY submissions DESC, subj.subject_name ASC"
    );
    $subjectStmt->bind_param("i", $teacher_id);
    $subjectStmt->execute();
    $subjectResult = $subjectStmt->get_result();

    $subjects = [];
    while ($row = $subjectResult->fetch_assoc()) {
        $subjects[] = [
            'subject_id' => (int)$row['subject_id'],
            'subject_name' => $row['subject_name'],
            'submissions' => (int)$row['submissions'],
            'graded' => (int)$row['graded'],
            'average_score' => $row['average_score'] !== null ? round((float)$row['average_score'], 2) : null,
        ];
    }
    $subjectStmt->close();

    $assessmentStmt = $conn->prepare(
        "SELECT
            ep.exercise_id,
            ep.title,
            ep.difficulty,
            subj.subject_name,
            COUNT(cs.solution_id) AS submissions,
            SUM(CASE WHEN sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS graded,
            AVG(sc.total_score_earned) AS average_score
         FROM Exercises_Problem ep
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE subj.teacher_user_id = ?
         GROUP BY ep.exercise_id, ep.title, ep.difficulty, subj.subject_name
         ORDER BY ep.created_at DESC, ep.exercise_id DESC"
    );
    $assessmentStmt->bind_param("i", $teacher_id);
    $assessmentStmt->execute();
    $assessmentResult = $assessmentStmt->get_result();

    $assessments = [];
    while ($row = $assessmentResult->fetch_assoc()) {
        $assessments[] = [
            'exercise_id' => (int)$row['exercise_id'],
            'title' => $row['title'],
            'difficulty' => $row['difficulty'] ?? 'Medium',
            'subject_name' => $row['subject_name'],
            'submissions' => (int)$row['submissions'],
            'graded' => (int)$row['graded'],
            'average_score' => $row['average_score'] !== null ? round((float)$row['average_score'], 2) : null,
        ];
    }
    $assessmentStmt->close();

    echo json_encode([
        'status' => 'success',
        'report' => [
            'summary' => [
                'total_submissions' => (int)($summary['total_submissions'] ?? 0),
                'graded_submissions' => (int)($summary['graded_submissions'] ?? 0),
                'pending_submissions' => (int)($summary['pending_submissions'] ?? 0),
                'average_score' => $summary['average_score'] !== null ? round((float)$summary['average_score'], 2) : null,
                'highest_score' => $summary['highest_score'] !== null ? round((float)$summary['highest_score'], 2) : null,
                'lowest_score' => $summary['lowest_score'] !== null ? round((float)$summary['lowest_score'], 2) : null,
            ],
            'subjects' => $subjects,
            'assessments' => $assessments,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load teacher reports: ' . $e->getMessage()]);
}

$conn->close();
?>
