<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';
require_once 'schema_utils.php';

$student_id = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;
$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;

if (!$student_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Student ID is required.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);

    $query = "
        SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.title,
            ep.description,
            ep.topic,
            ep.difficulty,
            ep.date_created,
            s.subject_name,
            s.join_code,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            s.semester,
            s.school_year,
            COUNT(DISTINCT ei.item_id) AS item_count,
            COUNT(DISTINCT cs.solution_id) AS submission_count,
            COUNT(DISTINCT sc.score_id) AS graded_count,
            MAX(cs.date_uploaded) AS latest_submission_at,
            MAX(sc.score_id) AS score_id,
            MAX(sc.total_score_earned) AS total_score_earned,
            MAX(sc.ai_feedback) AS ai_feedback
        FROM exercises_problem ep
        INNER JOIN Subject s ON s.subject_id = ep.subject_id
        LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
        LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
        INNER JOIN Enrollment e ON e.$enrollmentCol = s.subject_id AND e.student_id = ?
        LEFT JOIN exercise_items ei ON ei.exercise_id = ep.exercise_id
        LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id AND cs.student_id = ?
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
            ep.date_created,
            s.subject_name,
            s.join_code,
            c.course_code,
            c.course_name,
            sec.section_name,
            s.semester,
            s.school_year
        ORDER BY ep.date_created DESC, ep.exercise_id DESC
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
                    options,
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
                $decodedOptions = null;
                if (!empty($itemRow['options'])) {
                    $decoded = json_decode($itemRow['options'], true);
                    $decodedOptions = json_last_error() === JSON_ERROR_NONE ? $decoded : $itemRow['options'];
                }

                $exerciseId = (int)$itemRow['exercise_id'];
                if (!isset($itemsByExercise[$exerciseId])) {
                    $itemsByExercise[$exerciseId] = [];
                }

                $itemsByExercise[$exerciseId][] = [
                    'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
                    'question_type' => $itemRow['question_type'] ?? 'handwritten_algebra',
                    'question_content' => $itemRow['question_content'],
                    'options' => $decodedOptions,
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

    echo json_encode([
        'status' => 'success',
        'assessments' => $assessments,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load student assessments: ' . $e->getMessage()]);
}

$conn->close();
?>
