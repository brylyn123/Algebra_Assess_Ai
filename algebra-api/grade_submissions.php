<?php
require_once 'cors.php';
require_once 'db_connection.php';

$query = "
SELECT
    gs.id,
    gs.student_name,
    gs.student_id,
    gs.assessment_title,
    gs.subject_id,
    gs.rubric_set_id,
    DATE_FORMAT(gs.submission_date, '%b %e, %Y') AS submission_date,
    COALESCE(NULLIF(s.subject_name, ''), 'Unassigned Subject') AS subject_display,
    s.course AS subject_course,
    s.year AS subject_year,
    s.section AS subject_section,
    s.semester AS subject_semester,
    rs.rubric_name,
    rs.criteria AS rubric_criteria,
    gs.status
FROM grade_submissions gs
LEFT JOIN subject s ON s.subject_id = gs.subject_id
LEFT JOIN rubric_sets rs ON rs.rubric_set_id = gs.rubric_set_id
ORDER BY gs.submission_date DESC, gs.id DESC;
";

$result = $conn->query($query);

if (!$result) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load grade submissions: ' . $conn->error]);
    exit();
}

$submissions = [];
while ($row = $result->fetch_assoc()) {
    $subjectMeta = [];
    foreach (['subject_course', 'subject_year', 'subject_section', 'subject_semester'] as $field) {
        if (!empty($row[$field])) {
            $subjectMeta[] = $row[$field];
        }
    }

    $submissions[] = [
        'id' => (int)$row['id'],
        'student_name' => $row['student_name'],
        'student_id' => $row['student_id'],
        'assessment_title' => $row['assessment_title'],
        'subject_id' => $row['subject_id'] !== null ? (int)$row['subject_id'] : null,
        'subject_display' => $row['subject_display'],
        'subject_meta' => implode(' • ', $subjectMeta),
        'rubric_set_id' => $row['rubric_set_id'] !== null ? (int)$row['rubric_set_id'] : null,
        'rubric_name' => $row['rubric_name'],
        'rubric_criteria' => $row['rubric_criteria'],
        'submission_date' => $row['submission_date'],
        'status' => $row['status'],
    ];
}
$result->free();

header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'submissions' => $submissions,
]);
