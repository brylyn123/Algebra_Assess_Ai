<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];
$exercise_id = isset($_GET['exercise_id']) ? (int)$_GET['exercise_id'] : 0;

if ($exercise_id <= 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'A valid exercise_id is required.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureSubjectLookupColumns($conn);
    ensureScoreReturnColumn($conn);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    $stmt = $conn->prepare(
        "SELECT ep.subject_id
         FROM exercises_problem ep
         JOIN Subject s ON s.subject_id = ep.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?
         LIMIT 1"
    );
    $stmt->bind_param("ii", $exercise_id, $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Assessment not found or not owned by this teacher.']);
        exit();
    }

    $subject_id = (int)$row['subject_id'];

    $enrollStmt = $conn->prepare(
        "SELECT
            e.student_user_id,
            CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) AS student_name,
            u.institutional_id AS student_id,
            e.enrollment_status
         FROM Enrollment e
         JOIN {$userTable} u ON u.user_id = e.student_user_id
         WHERE e.{$enrollmentCol} = ? AND e.enrollment_status = 'enrolled'
         ORDER BY student_name ASC"
    );
    $enrollStmt->bind_param("i", $subject_id);
    $enrollStmt->execute();
    $enrollResult = $enrollStmt->get_result();

    $enrolledStudents = [];
    while ($eRow = $enrollResult->fetch_assoc()) {
        $enrolledStudents[(int)$eRow['student_user_id']] = [
            'student_user_id' => (int)$eRow['student_user_id'],
            'student_name' => trim((string)$eRow['student_name']),
            'student_id' => $eRow['student_id'] ?? '',
            'enrollment_status' => $eRow['enrollment_status'] ?? 'enrolled',
        ];
    }
    $enrollStmt->close();

    $subStmt = $conn->prepare(
        "SELECT
            cs.student_user_id,
            cs.date_uploaded,
            CASE
                WHEN sc.score_id IS NOT NULL AND sc.returned_at IS NOT NULL THEN 'Graded'
                WHEN sc.score_id IS NOT NULL THEN 'Ready to Return'
                WHEN cs.ai_status = 'completed' THEN 'Needs Review'
                ELSE 'Pending'
            END AS status
         FROM Captured_Solution cs
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE cs.exercise_id = ?
         ORDER BY cs.date_uploaded DESC"
    );
    $subStmt->bind_param("i", $exercise_id);
    $subStmt->execute();
    $subResult = $subStmt->get_result();

    $submissions = [];
    while ($sRow = $subResult->fetch_assoc()) {
        $sid = (int)$sRow['student_user_id'];
        if (!isset($submissions[$sid])) {
            $submissions[$sid] = [
                'submitted' => true,
                'status' => $sRow['status'] ?? 'Pending',
                'date_uploaded' => $sRow['date_uploaded']
                    ? date('M j, Y', strtotime($sRow['date_uploaded']))
                    : null,
            ];
        }
    }
    $subStmt->close();

    $students = [];
    foreach ($enrolledStudents as $uid => $student) {
        $subInfo = $submissions[$uid] ?? null;
        $students[] = [
            'student_user_id' => $student['student_user_id'],
            'student_name' => $student['student_name'],
            'student_id' => $student['student_id'],
            'submitted' => $subInfo !== null,
            'status' => $subInfo['status'] ?? null,
            'date_uploaded' => $subInfo['date_uploaded'] ?? null,
        ];
    }

    usort($students, function ($a, $b) {
        if ($a['submitted'] && !$b['submitted']) return -1;
        if (!$a['submitted'] && $b['submitted']) return 1;
        return strcmp($a['student_name'], $b['student_name']);
    });

    $totalEnrolled = count($students);
    $totalSubmitted = count(array_filter($students, fn($s) => $s['submitted']));

    setCacheHeaders(60);
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'success',
        'exercise_id' => $exercise_id,
        'total_enrolled' => $totalEnrolled,
        'total_submitted' => $totalSubmitted,
        'students' => $students,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load submission tracker: ' . $e->getMessage()]);
}
