<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];
$subject_filter_raw = $_GET['subject_id'] ?? null;
$exercise_filter_raw = $_GET['exercise_id'] ?? null;
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int)($_GET['per_page'] ?? 25)));
$subject_filter_value = null;
$subject_filter_is_null = false;

ensureAssessmentRubricColumn($conn);
ensureSubjectLookupColumns($conn);
ensureScoreReturnColumn($conn);
$courseTable = resolveExistingTableName($conn, ['Course', 'course']);
$sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
$yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
$semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);
$userTable = resolveExistingTableName($conn, ['Users', 'users']);

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
    s.institutional_id AS student_id,
    ep.title AS assessment_title,
    ep.rubric_set_id,
    rs.rubric_name,
    rs.criteria AS rubric_criteria,
    rs.ai_instructions AS rubric_ai_instructions,
    subj.subject_id,
    subj.subject_name,
    subj.join_code AS subject_code,
    COALESCE(c.course_code, c.course_name) AS course,
    sec.section_name AS section,
    yl.year_level AS year,
    COALESCE(sem.semester_name, subj.semester) AS semester,
    COALESCE(sy.label, subj.school_year) AS school_year,
    cs.file_path,
    cs.ai_raw_json,
    cs.ocr_text,
    sc.score_id,
    sc.total_score_earned,
    sc.ai_feedback,
    sc.returned_at,
    DATE_FORMAT(cs.date_uploaded, '%b %e, %Y') AS submission_date,
    CASE
        WHEN sc.score_id IS NOT NULL AND sc.returned_at IS NOT NULL THEN 'Graded'
        WHEN sc.score_id IS NOT NULL THEN 'Ready to Return'
        WHEN cs.ai_status = 'completed' THEN 'Needs Review'
        ELSE 'Pending'
    END AS status
FROM Captured_Solution cs
LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
LEFT JOIN Subject subj ON subj.subject_id = ep.subject_id
LEFT JOIN {$courseTable} c ON c.course_id = subj.course_id
LEFT JOIN {$sectionTable} sec ON sec.section_id = subj.section_id
LEFT JOIN {$yearTable} yl ON yl.year_id = subj.year_id
LEFT JOIN {$semesterTable} sem ON sem.semester_id = subj.semester_id
LEFT JOIN school_year sy ON sy.school_year_id = subj.school_year_id
LEFT JOIN {$userTable} s ON s.user_id = cs.student_user_id
";

$filters = [];
$params = [];
$types = '';

$filters[] = 'subj.teacher_user_id = ?';
$types .= 'i';
$params[] = $teacher_id;

if ($exercise_filter_raw !== null) {
    $exercise_id = intval($exercise_filter_raw);
    if ($exercise_id > 0) {
        $filters[] = 'ep.exercise_id = ?';
        $types .= 'i';
        $params[] = $exercise_id;
    }
}

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

$countQuery = "SELECT COUNT(*) AS total FROM Captured_Solution cs
    LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
    JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
    LEFT JOIN Subject subj ON subj.subject_id = ep.subject_id";
if (!empty($filters)) {
    $countQuery .= ' WHERE ' . implode(' AND ', $filters);
}

$countStmt = $conn->prepare($countQuery);
if (!empty($params)) {
    $countStmt->bind_param($types, ...$params);
}
$countStmt->execute();
$totalRow = $countStmt->get_result()->fetch_assoc();
$totalCount = (int)($totalRow['total'] ?? 0);
$countStmt->close();

$totalPages = max(1, (int)ceil($totalCount / $perPage));
$page = min($page, $totalPages);
$offset = ($page - 1) * $perPage;

$query .= ' ORDER BY cs.date_uploaded DESC, cs.solution_id DESC';
$query .= " LIMIT {$perPage} OFFSET {$offset}";

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
        'subject_meta' => implode(' - ', $metaFields),
        'submission_date' => $row['submission_date'],
        'status' => $row['status'],
        'files' => $files,
        'score_id' => $row['score_id'] !== null ? (int)$row['score_id'] : null,
        'score' => $row['total_score_earned'] !== null ? round((float)$row['total_score_earned'], 2) : null,
        'ai_feedback' => $row['ai_feedback'] ?? '',
        'ocr_text' => $row['ocr_text'] ?? null,
        'returned_at' => $row['returned_at'] ?? null,
        'items' => [],
    ];
}
$result->free();
$stmt->close();

if (count($submissions) > 0) {
    $submissionIds = array_map(static fn($submission) => (int)$submission['id'], $submissions);
    $placeholders = implode(',', array_fill(0, count($submissionIds), '?'));
    $types = str_repeat('i', count($submissionIds));

    $itemStmt = $conn->prepare(
        "SELECT
            cs.solution_id,
            ei.item_id,
            ei.item_no,
            ei.question_content,
            ei.max_score,
            iscore.item_score_id,
            iscore.score_earned,
            iscore.ai_feedback,
            iscore.is_manual_override
         FROM Captured_Solution cs
         INNER JOIN exercise_items ei ON ei.exercise_id = cs.exercise_id
         LEFT JOIN Item_Scores iscore
            ON iscore.solution_id = cs.solution_id
           AND iscore.item_id = ei.item_id
         WHERE cs.solution_id IN ($placeholders)
         ORDER BY cs.solution_id ASC, ei.item_no ASC"
    );

    $itemStmt->bind_param($types, ...$submissionIds);
    $itemStmt->execute();
    $itemResult = $itemStmt->get_result();

    $submissionsById = [];
    foreach ($submissions as $index => $submission) {
        $submissionsById[(int)$submission['id']] = $index;
    }

    while ($itemRow = $itemResult->fetch_assoc()) {
        $solutionId = (int)$itemRow['solution_id'];
        if (!isset($submissionsById[$solutionId])) {
            continue;
        }

        $submissions[$submissionsById[$solutionId]]['items'][] = [
            'item_score_id' => $itemRow['item_score_id'] !== null ? (int)$itemRow['item_score_id'] : null,
            'item_id' => (int)$itemRow['item_id'],
            'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
            'question_content' => $itemRow['question_content'],
            'max_score' => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 0.0,
            'score_earned' => $itemRow['score_earned'] !== null ? (float)$itemRow['score_earned'] : null,
            'ai_feedback' => $itemRow['ai_feedback'] ?? '',
            'is_manual_override' => !empty($itemRow['is_manual_override']),
        ];
    }

    $itemStmt->close();
}

header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'submissions' => $submissions,
    'pagination' => [
        'total' => $totalCount,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => $totalPages,
    ],
]);
