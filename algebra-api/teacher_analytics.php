<?php
require_once 'cors.php';
require_once 'db_connect.php';
require_once 'auth.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    $totalsStmt = $conn->prepare(
        "SELECT
            COUNT(cs.solution_id) AS total_submissions,
            SUM(CASE WHEN sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS graded_submissions,
            SUM(CASE WHEN sc.score_id IS NULL AND cs.ai_status = 'completed' THEN 1 ELSE 0 END) AS needs_review,
            SUM(CASE WHEN sc.score_id IS NULL AND cs.ai_status = 'pending' THEN 1 ELSE 0 END) AS pending_submissions,
            AVG(sc.total_score_earned) AS average_score
         FROM Captured_Solution cs
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         LEFT JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         LEFT JOIN Subject subj ON subj.subject_id = ep.subject_id
         WHERE subj.teacher_user_id = ?"
    );
    $totalsStmt->bind_param("i", $teacher_id);
    $totalsStmt->execute();
    $totalsResult = $totalsStmt->get_result()->fetch_assoc();
    $totalsStmt->close();

    $subjectStmt = $conn->prepare(
        "SELECT
            subj.subject_id,
            subj.subject_name,
            COUNT(cs.solution_id) AS submissions,
            SUM(CASE WHEN sc.score_id IS NULL THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN sc.score_id IS NOT NULL THEN 1 ELSE 0 END) AS graded
         FROM Subject subj
         LEFT JOIN Exercises_Problem ep ON ep.subject_id = subj.subject_id
         LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE subj.teacher_user_id = ?
         GROUP BY subj.subject_id
         ORDER BY submissions DESC
         LIMIT 6"
    );
    $subjectStmt->bind_param("i", $teacher_id);
    $subjectStmt->execute();
    $subjectResults = $subjectStmt->get_result();

    $subjects = [];
    while ($row = $subjectResults->fetch_assoc()) {
        $subjects[] = [
            'subject_id' => (int)$row['subject_id'],
            'subject_name' => $row['subject_name'] ?? 'Untitled',
            'submissions' => (int)$row['submissions'],
            'pending' => (int)$row['pending'],
            'graded' => (int)$row['graded'],
        ];
    }
    $subjectStmt->close();

    setCacheHeaders(60);
    echo json_encode([
        'status' => 'success',
        'analytics' => [
            'total_submissions' => (int)($totalsResult['total_submissions'] ?? 0),
            'graded_submissions' => (int)($totalsResult['graded_submissions'] ?? 0),
            'needs_review' => (int)($totalsResult['needs_review'] ?? 0),
            'pending_submissions' => (int)($totalsResult['pending_submissions'] ?? 0),
            'average_score' => $totalsResult['average_score'] !== null ? round((float)$totalsResult['average_score'], 2) : null,
            'subjects' => $subjects,
        ],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load teacher analytics.']);
}
