<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('student');
$student_id = (int)$authUser['user_id'];
$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    ensureScoreReturnColumn($conn);
    ensureAssessmentDueDate($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $query = "
        SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.title,
            ep.description,
            ep.topic,
            ep.difficulty,
            ep.due_date,
            ep.created_at AS date_created,
            s.subject_name,
            s.join_code,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(sy.label, '') AS school_year,
            COUNT(DISTINCT ei.item_id) AS item_count,
            COUNT(DISTINCT cs.solution_id) AS submission_count,
            COUNT(DISTINCT CASE WHEN sc.returned_at IS NOT NULL THEN sc.score_id END) AS graded_count,
            MAX(cs.date_uploaded) AS latest_submission_at,
            MAX(CASE WHEN sc.returned_at IS NOT NULL THEN sc.score_id END) AS score_id,
            MAX(CASE WHEN sc.returned_at IS NOT NULL THEN sc.total_score_earned END) AS total_score_earned,
            MAX(CASE WHEN sc.returned_at IS NOT NULL THEN sc.ai_feedback END) AS ai_feedback,
            MAX(cs.solution_id) AS solution_id
        FROM exercises_problem ep
        INNER JOIN Subject s ON s.subject_id = ep.subject_id
        LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
        LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
        LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
        LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
        LEFT JOIN assessment_subjects asub ON asub.assessment_id = ep.exercise_id
        INNER JOIN Enrollment e ON (
            e.$enrollmentCol = s.subject_id
            OR (asub.subject_id IS NOT NULL AND e.$enrollmentCol = asub.subject_id)
        ) AND e.student_user_id = ?
        LEFT JOIN exercise_items ei ON ei.exercise_id = ep.exercise_id
        LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id AND cs.student_user_id = ?
        LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
        WHERE s.archived = 0
    ";

    $types = 'ii';
    $params = [$student_id, $student_id];

    if ($subject_id) {
        $query .= " AND s.subject_id = ? ";
        $types .= 'i';
        $params[] = $subject_id;
    }

    $query .= "
        GROUP BY
            ep.exercise_id,
            ep.subject_id,
            ep.title,
            ep.description,
            ep.topic,
            ep.difficulty,
            ep.due_date,
            ep.created_at,
            s.subject_name,
            s.join_code,
            c.course_code,
            c.course_name,
            sec.section_name,
            COALESCE(sem.semester_name, s.semester),
            sy.label
        ORDER BY ep.created_at DESC, ep.exercise_id DESC
    ";

    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $assessments = [];
    while ($row = $result->fetch_assoc()) {
        $subjectMeta = array_filter([
            $row['course'] ?? '',
            $row['section'] ?? '',
            $row['semester'] ?? '',
            $row['school_year'] ?? '',
        ], fn($value) => $value !== null && trim((string)$value) !== '');

        $assessments[] = [
            'exercise_id' => (int)$row['exercise_id'],
            'subject_id' => (int)$row['subject_id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'topic' => $row['topic'],
            'difficulty' => $row['difficulty'] ?? 'Medium',
            'due_date' => $row['due_date'] ?? null,
            'date_created' => $row['date_created'],
            'subject_name' => $row['subject_name'],
            'subject_code' => $row['join_code'],
            'subject_meta' => implode(' - ', $subjectMeta),
            'item_count' => (int)$row['item_count'],
            'already_submitted' => ((int)$row['submission_count']) > 0,
            'submission_status' => ((int)$row['graded_count']) > 0
                ? 'Graded'
                : (((int)$row['submission_count']) > 0 ? 'Pending Review' : 'Not Submitted'),
            'submission_count' => (int)$row['submission_count'],
            'latest_submission_at' => $row['latest_submission_at'],
            'score_id' => $row['score_id'] !== null ? (int)$row['score_id'] : null,
            'score' => $row['total_score_earned'] !== null ? round((float)$row['total_score_earned'], 2) : null,
            'ai_feedback' => $row['ai_feedback'] ?? '',
            'solution_id' => $row['solution_id'] !== null ? (int)$row['solution_id'] : null,
            'items' => [],
        ];
    }

    $stmt->close();

    if (count($assessments) > 0) {
        $exerciseIds = array_values(array_unique(array_map(
            fn($assessment) => (int)$assessment['exercise_id'],
            $assessments
        )));

        if (count($exerciseIds) > 0) {
            $placeholders = implode(',', array_fill(0, count($exerciseIds), '?'));
            $types = str_repeat('i', count($exerciseIds));
            $itemStmt = $conn->prepare(
                "SELECT
                    exercise_id,
                    item_no,
                    question_type,
                    question_content,
                    max_score
                 FROM exercise_items
                 WHERE exercise_id IN ($placeholders)
                 ORDER BY exercise_id ASC, item_no ASC"
            );
            $itemStmt->bind_param($types, ...$exerciseIds);
            $itemStmt->execute();
            $itemResult = $itemStmt->get_result();

            $itemsByExercise = [];
            while ($itemRow = $itemResult->fetch_assoc()) {
                $exerciseId = (int)$itemRow['exercise_id'];
                if (!isset($itemsByExercise[$exerciseId])) {
                    $itemsByExercise[$exerciseId] = [];
                }

                $itemsByExercise[$exerciseId][] = [
                    'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
                    'question_type' => $itemRow['question_type'] ?? 'handwritten_algebra',
                    'question_content' => $itemRow['question_content'],
                    'max_score' => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 1.0,
                ];
            }
            $itemStmt->close();

            foreach ($assessments as &$assessment) {
                $exerciseId = (int)$assessment['exercise_id'];
                $assessment['items'] = $itemsByExercise[$exerciseId] ?? [];
            }
            unset($assessment);
        }
    }

    $submittedAssessments = array_filter($assessments, fn($a) => isset($a['solution_id']) && $a['solution_id'] !== null);

    $allSolutionIds = array_values(array_unique(array_map(
        fn($assessment) => (int)$assessment['solution_id'],
        $submittedAssessments
    )));

    if (count($allSolutionIds) > 0) {
        $solutionPlaceholders = implode(',', array_fill(0, count($allSolutionIds), '?'));
        $solutionTypes = str_repeat('i', count($allSolutionIds));

        $fileStmt = $conn->prepare(
            "SELECT solution_id, file_path, ocr_text, ai_raw_json
             FROM Captured_Solution
             WHERE solution_id IN ($solutionPlaceholders)
             ORDER BY solution_id ASC"
        );
        $fileStmt->bind_param($solutionTypes, ...$allSolutionIds);
        $fileStmt->execute();
        $fileResult = $fileStmt->get_result();

        $filesBySolution = [];
        $criteriaScoresBySolution = [];
        $ocrTextBySolution = [];
        while ($fileRow = $fileResult->fetch_assoc()) {
            $solId = (int)$fileRow['solution_id'];
            $files = [];
            $criteriaScores = [];
            // Use ocr_text from database column first, fallback to ai_raw_json
            $ocrText = trim((string)($fileRow['ocr_text'] ?? ''));
            $rawJson = $fileRow['ai_raw_json'] ?? null;
            if ($rawJson) {
                $decoded = json_decode($rawJson, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    // Parse files
                    if (isset($decoded['files']) && is_array($decoded['files'])) {
                        foreach ($decoded['files'] as $f) {
                            $path = trim((string)($f['file_path'] ?? ''));
                            if ($path === '') continue;
                            $name = trim((string)($f['original_name'] ?? basename($path)));
                            $ext = strtolower(pathinfo($name !== '' ? $name : $path, PATHINFO_EXTENSION));
                            $files[] = [
                                'name' => $name !== '' ? $name : basename($path),
                                'path' => $path,
                                'type' => $ext === 'pdf' ? 'pdf' : 'image',
                            ];
                        }
                    }
                    // Parse criteria_scores from grading_draft
                    $draft = $decoded['grading_draft'] ?? null;
                    if (is_array($draft) && isset($draft['criteria_scores']) && is_array($draft['criteria_scores'])) {
                        foreach ($draft['criteria_scores'] as $c) {
                            $weight = isset($c['weight']) ? (float)$c['weight'] : 0;
                            $earned = isset($c['earned']) ? (float)$c['earned'] : (isset($c['score']) ? (float)$c['score'] : 0);
                            $earned = max(0, min($weight, $earned));
                            $criteriaScores[] = [
                                'name' => trim((string)($c['name'] ?? '')),
                                'weight' => $weight,
                                'earned' => round($earned, 2),
                                'explanation' => trim((string)($c['explanation'] ?? '')),
                            ];
                        }
                    }
                    // Parse ocr_text from ai_raw_json if not in database column
                    if ($ocrText === '' && isset($decoded['ocr']) && is_array($decoded['ocr']) && !empty($decoded['ocr']['text'])) {
                        $ocrText = trim((string)$decoded['ocr']['text']);
                    }
                }
            }
            if (count($files) === 0) {
                $fallbackPath = trim((string)($fileRow['file_path'] ?? ''));
                if ($fallbackPath !== '') {
                    $fallbackName = basename($fallbackPath);
                    $ext = strtolower(pathinfo($fallbackName, PATHINFO_EXTENSION));
                    $files[] = [
                        'name' => $fallbackName,
                        'path' => $fallbackPath,
                        'type' => $ext === 'pdf' ? 'pdf' : 'image',
                    ];
                }
            }
            $filesBySolution[$solId] = $files;
            $criteriaScoresBySolution[$solId] = $criteriaScores;
            $ocrTextBySolution[$solId] = $ocrText;
        }
        $fileStmt->close();

        foreach ($assessments as &$assessment) {
            $solId = $assessment['solution_id'] ?? null;
            if ($solId !== null && isset($filesBySolution[$solId])) {
                $assessment['submission_files'] = $filesBySolution[$solId];
                $assessment['criteria_scores'] = $criteriaScoresBySolution[$solId] ?? [];
                $assessment['ocr_text'] = $ocrTextBySolution[$solId] ?? '';
            } else {
                $assessment['submission_files'] = [];
                $assessment['criteria_scores'] = [];
                $assessment['ocr_text'] = '';
            }
        }
        unset($assessment);
    }

    if (count($submittedAssessments) > 0 && count($allSolutionIds) > 0) {
        $scorePlaceholders = implode(',', array_fill(0, count($allSolutionIds), '?'));
        $scoreTypes = str_repeat('i', count($allSolutionIds));
        $itemScoreStmt = $conn->prepare(
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
             WHERE iscore.solution_id IN ($scorePlaceholders)
             ORDER BY iscore.solution_id ASC, ei.item_no ASC"
        );
        $itemScoreStmt->bind_param($scoreTypes, ...$allSolutionIds);
        $itemScoreStmt->execute();
        $itemScoreResult = $itemScoreStmt->get_result();

        $itemScoresBySolution = [];
        while ($itemScoreRow = $itemScoreResult->fetch_assoc()) {
            $solId = (int)$itemScoreRow['solution_id'];
            if (!isset($itemScoresBySolution[$solId])) {
                $itemScoresBySolution[$solId] = [];
            }
            $itemScoresBySolution[$solId][] = [
                'item_score_id' => (int)$itemScoreRow['item_score_id'],
                'item_id' => (int)$itemScoreRow['item_id'],
                'item_no' => isset($itemScoreRow['item_no']) ? (int)$itemScoreRow['item_no'] : 1,
                'question_content' => $itemScoreRow['question_content'],
                'max_score' => isset($itemScoreRow['max_score']) ? round((float)$itemScoreRow['max_score'], 2) : null,
                'score_earned' => $itemScoreRow['score_earned'] !== null ? round((float)$itemScoreRow['score_earned'], 2) : null,
                'ai_feedback' => $itemScoreRow['ai_feedback'] ?? '',
                'is_manual_override' => !empty($itemScoreRow['is_manual_override']),
            ];
        }
        $itemScoreStmt->close();

        foreach ($assessments as &$assessment) {
            $solId = $assessment['solution_id'] ?? null;
            if ($solId !== null && isset($itemScoresBySolution[$solId])) {
                $assessment['item_scores'] = $itemScoresBySolution[$solId];
            } else {
                $assessment['item_scores'] = [];
            }
        }
        unset($assessment);
    }

    foreach ($assessments as &$assessment) {
        if (!isset($assessment['submission_files'])) {
            $assessment['submission_files'] = [];
        }
        if (!isset($assessment['item_scores'])) {
            $assessment['item_scores'] = [];
        }
        if (!isset($assessment['criteria_scores'])) {
            $assessment['criteria_scores'] = [];
        }
        if (!isset($assessment['ocr_text'])) {
            $assessment['ocr_text'] = '';
        }
    }
    unset($assessment);

    setCacheHeaders(60);
    echo json_encode([
        'status' => 'success',
        'assessments' => $assessments,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load student assessments.']);
}

$conn->close();
?>
