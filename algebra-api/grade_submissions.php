<?php
require_once 'cors.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
$subject_filter_raw = $_GET['subject_id'] ?? null;
$subject_filter_value = null;
$subject_filter_is_null = false;

if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Teacher ID is required.']);
    exit();
}

ensureAssessmentRubricColumn($conn);

if ($subject_filter_raw !== null) {
    if ($subject_filter_raw === 'unassigned' || $subject_filter_raw === '0') {
        $subject_filter_is_null = true;
    } else {
        $subject_filter_value = intval($subject_filter_raw);
    }
}

$query = "
SELECT
    cs.solution_id AS id,
    ep.exercise_id,
    CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) AS student_name,
    s.student_id,
    ep.title AS assessment_title,
    ep.rubric_set_id,
    rs.rubric_name,
    rs.criteria AS rubric_criteria,
    rs.ai_instructions AS rubric_ai_instructions,
    subj.subject_id,
    subj.subject_name,
    subj.join_code AS subject_code,
    subj.course,
    subj.section,
    subj.year,
    subj.semester,
    subj.school_year,
    cs.file_path,
    cs.ai_raw_json,
    sc.score_id,
    sc.total_score_earned,
    sc.teacher_feedback,
    DATE_FORMAT(cs.date_uploaded, '%b %e, %Y') AS submission_date,
    CASE
        WHEN sc.score_id IS NOT NULL THEN 'Graded'
        WHEN cs.ai_status = 'completed' THEN 'Needs Review'
        ELSE 'Pending'
    END AS status
FROM Captured_Solution cs
LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
LEFT JOIN Subject subj ON subj.subject_id = ep.subject_id
LEFT JOIN Student s ON s.student_id = cs.student_id
";

$filters = [];
$params = [];
$types = '';

$filters[] = 'subj.teacher_id = ?';
$types .= 'i';
$params[] = $teacher_id;

if ($subject_filter_is_null) {
    $filters[] = 'subj.subject_id IS NULL';
} elseif ($subject_filter_value !== null) {
    $filters[] = 'subj.subject_id = ?';
    $types .= 'i';
    $params[] = $subject_filter_value;
}

if (!empty($filters)) {
    $query .= ' WHERE ' . implode(' AND ', $filters);
}

$query .= ' ORDER BY cs.date_uploaded DESC, cs.solution_id DESC;';

$stmt = $conn->prepare($query);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to prepare grade submissions query: ' . $conn->error]);
    exit();
}

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();

if (!$result) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load grade submissions: ' . $conn->error]);
    exit();
}

$submissions = [];
while ($row = $result->fetch_assoc()) {
    $subjectName = trim((string)($row['subject_name'] ?? ''));
    $subjectCode = trim((string)($row['subject_code'] ?? ''));

    $subjectDisplayParts = [];
    if ($subjectName !== '') {
        $subjectDisplayParts[] = $subjectName;
    }
    if ($subjectCode !== '') {
        $subjectDisplayParts[] = "({$subjectCode})";
    }
    $subjectDisplay = count($subjectDisplayParts) > 0 ? implode(' ', $subjectDisplayParts) : 'Unassigned Subject';

    $metaFields = array_filter([
        $row['course'] ?? '',
        $row['section'] ?? '',
        $row['semester'] ?? '',
        $row['school_year'] ?? '',
        $row['year'] ?? '',
    ], fn($value) => $value !== null && trim((string)$value) !== '');

    $files = [];
    $rawJson = $row['ai_raw_json'] ?? null;
    if ($rawJson) {
        $decoded = json_decode($rawJson, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded['files']) && is_array($decoded['files'])) {
            foreach ($decoded['files'] as $file) {
                $path = trim((string)($file['file_path'] ?? ''));
                if ($path === '') {
                    continue;
                }

                $originalName = trim((string)($file['original_name'] ?? basename($path)));
                $extension = strtolower(pathinfo($originalName !== '' ? $originalName : $path, PATHINFO_EXTENSION));
                $files[] = [
                    'name' => $originalName !== '' ? $originalName : basename($path),
                    'path' => $path,
                    'type' => $extension === 'pdf' ? 'pdf' : 'image',
                ];
            }
        }
    }

    if (count($files) === 0) {
        $fallbackPath = trim((string)($row['file_path'] ?? ''));
        if ($fallbackPath !== '') {
            $fallbackName = basename($fallbackPath);
            $extension = strtolower(pathinfo($fallbackName, PATHINFO_EXTENSION));
            $files[] = [
                'name' => $fallbackName,
                'path' => $fallbackPath,
                'type' => $extension === 'pdf' ? 'pdf' : 'image',
            ];
        }
    }

    $submissions[] = [
        'id' => (int)$row['id'],
        'exercise_id' => $row['exercise_id'] !== null ? (int)$row['exercise_id'] : null,
        'student_name' => $row['student_name'],
        'student_id' => $row['student_id'],
        'assessment_title' => $row['assessment_title'],
        'rubric_set_id' => $row['rubric_set_id'] !== null ? (int)$row['rubric_set_id'] : null,
        'rubric_name' => $row['rubric_name'] ?? null,
        'rubric_criteria' => $row['rubric_criteria'] ?? null,
        'rubric_ai_instructions' => $row['rubric_ai_instructions'] ?? null,
        'subject_id' => $row['subject_id'] !== null ? (int)$row['subject_id'] : null,
        'subject_display' => $subjectDisplay,
        'subject_code' => $subjectCode,
        'subject_meta' => implode(' · ', $metaFields),
        'submission_date' => $row['submission_date'],
        'status' => $row['status'],
        'files' => $files,
        'score_id' => $row['score_id'] !== null ? (int)$row['score_id'] : null,
        'score' => $row['total_score_earned'] !== null ? round((float)$row['total_score_earned'], 2) : null,
        'teacher_feedback' => $row['teacher_feedback'] ?? '',
    ];
}
$result->free();
$stmt->close();

header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'submissions' => $submissions,
]);
