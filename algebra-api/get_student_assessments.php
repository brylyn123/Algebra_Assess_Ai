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
            s.course,
            s.section,
            s.semester,
            s.school_year,
            COUNT(DISTINCT ei.item_id) AS item_count,
            MAX(cs.date_uploaded) AS latest_submission_at,
            COUNT(DISTINCT cs.solution_id) AS submission_count
        FROM exercises_problem ep
        INNER JOIN Subject s ON s.subject_id = ep.subject_id
        INNER JOIN Enrollment e ON e.$enrollmentCol = s.subject_id AND e.student_id = ?
        LEFT JOIN exercise_items ei ON ei.exercise_id = ep.exercise_id
        LEFT JOIN Captured_Solution cs ON cs.exercise_id = ep.exercise_id AND cs.student_id = ?
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
            s.course,
            s.section,
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
            'latest_submission_at' => $row['latest_submission_at'],
        ];
    }

    $stmt->close();

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
