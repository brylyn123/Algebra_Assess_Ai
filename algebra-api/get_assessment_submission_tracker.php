<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
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
    ensureCapturedSolutionResetColumns($conn);
    ensureAssessmentSubmitMode($conn);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    $stmt = $conn->prepare(
        "SELECT ep.subject_id, ep.publish_at, ep.due_date, ep.submit_mode
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
    $submitMode = ($row['submit_mode'] ?? 'student') === 'teacher' ? 'teacher' : 'student';
    $publishAt = !empty($row['publish_at']) ? $row['publish_at'] : null;
    $dueDate = !empty($row['due_date']) ? $row['due_date'] : null;
    $publishTs = $publishAt !== null ? strtotime($publishAt) : false;
    $dueTs = $dueDate !== null ? strtotime($dueDate) : false;

    // Multi-subject assessments draw students from every linked subject, not
    // just the primary one stored on exercises_problem.
    $enrollStmt = $conn->prepare(
        "SELECT DISTINCT
            e.student_user_id,
            CASE
                WHEN COALESCE(u.last_name, '') <> '' AND COALESCE(CONCAT_WS(' ', u.first_name, u.middle_name), '') <> ''
                    THEN CONCAT(u.last_name, ', ', CONCAT_WS(' ', u.first_name, u.middle_name))
                WHEN COALESCE(u.last_name, '') <> '' THEN u.last_name
                ELSE CONCAT_WS(' ', u.first_name, u.middle_name)
            END AS student_name,
            COALESCE(u.last_name, '') AS last_name,
            COALESCE(u.first_name, '') AS first_name,
            COALESCE(u.middle_name, '') AS middle_name,
            u.institutional_id AS student_id,
            e.enrollment_status
         FROM Enrollment e
         JOIN {$userTable} u ON u.user_id = e.student_user_id
         WHERE e.enrollment_status = 'enrolled'
           AND (
               e.{$enrollmentCol} = ?
               OR e.{$enrollmentCol} IN (SELECT subject_id FROM assessment_subjects WHERE assessment_id = ?)
           )
         ORDER BY COALESCE(u.last_name, ''), COALESCE(u.first_name, ''), COALESCE(u.middle_name, '')"
    );
    $enrollStmt->bind_param("ii", $subject_id, $exercise_id);
    $enrollStmt->execute();
    $enrollResult = $enrollStmt->get_result();

    $enrolledStudents = [];
    while ($eRow = $enrollResult->fetch_assoc()) {
        $enrolledStudents[(int)$eRow['student_user_id']] = [
            'student_user_id' => (int)$eRow['student_user_id'],
            'student_name' => trim((string)$eRow['student_name']),
            'last_name' => (string)($eRow['last_name'] ?? ''),
            'first_name' => (string)($eRow['first_name'] ?? ''),
            'middle_name' => (string)($eRow['middle_name'] ?? ''),
            'student_id' => $eRow['student_id'] ?? '',
            'enrollment_status' => $eRow['enrollment_status'] ?? 'enrolled',
        ];
    }
    $enrollStmt->close();

    $subStmt = $conn->prepare(
        "SELECT
            cs.student_user_id,
            cs.date_uploaded,
            cs.ai_raw_json,
            CASE
                WHEN sc.score_id IS NOT NULL AND sc.returned_at IS NOT NULL THEN 'Graded'
                WHEN sc.score_id IS NOT NULL THEN 'Ready to Return'
                WHEN cs.ai_status = 'completed' THEN 'Needs Review'
                ELSE 'Pending'
            END AS status,
            cs.reset_count
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
            $submittedVia = null;
            if (!empty($sRow['ai_raw_json'])) {
                $rawDecoded = json_decode($sRow['ai_raw_json'], true);
                if (is_array($rawDecoded) && !empty($rawDecoded['submitted_via'])) {
                    $submittedVia = (string)$rawDecoded['submitted_via'];
                }
            }

            $uploadTs = $sRow['date_uploaded'] ? strtotime($sRow['date_uploaded']) : false;
            $withinWindow = true;
            $timingLabel = null;
            // Teacher-uploaded submissions are administered offline, so the
            // Early/Late window check does not apply to them.
            if ($uploadTs !== false && $submittedVia !== 'teacher_upload') {
                if ($publishTs !== false && $uploadTs < $publishTs) {
                    $withinWindow = false;
                    $timingLabel = 'Early';
                } elseif ($dueTs !== false && $uploadTs > $dueTs) {
                    $withinWindow = false;
                    $timingLabel = 'Late';
                }
            }
            $submissions[$sid] = [
                'submitted' => true,
                'status' => $sRow['status'] ?? 'Pending',
                'date_uploaded' => $sRow['date_uploaded']
                    ? date('M j, Y', strtotime($sRow['date_uploaded']))
                    : null,
                'uploaded_at' => $sRow['date_uploaded'],
                'submitted_via' => $submittedVia,
                'within_window' => $withinWindow,
                'timing_flag' => $timingLabel,
                'attempts' => 1 + (int)($sRow['reset_count'] ?? 0),
            ];
        }
    }
    $subStmt->close();

    // Integrity signal: pairwise OCR-text similarity across submissions for this exercise.
    $ocrStmt = $conn->prepare(
        "SELECT student_user_id, ocr_text, solution_id
         FROM Captured_Solution
         WHERE exercise_id = ? AND ocr_text IS NOT NULL AND TRIM(ocr_text) <> ''"
    );
    $ocrStmt->bind_param("i", $exercise_id);
    $ocrStmt->execute();
    $ocrResult = $ocrStmt->get_result();

    $ocrByStudent = [];
    while ($oRow = $ocrResult->fetch_assoc()) {
        $sid = (int)$oRow['student_user_id'];
        if (!isset($ocrByStudent[$sid])) {
            $ocrByStudent[$sid] = $oRow['ocr_text'];
        }
    }
    $ocrStmt->close();

    $normalize = function ($text) {
        $text = mb_strtolower((string)$text, 'UTF-8');
        $text = preg_replace('/[^a-z0-9]+/u', ' ', $text);
        $text = trim(preg_replace('/\s+/u', ' ', $text));
        // Cap length so pairwise comparison stays fast on long OCR output.
        return mb_substr($text, 0, 1200, 'UTF-8');
    };

    $similarTo = [];
    $duplicatePairs = [];
    $studentIds = array_keys($ocrByStudent);
    for ($i = 0; $i < count($studentIds); $i++) {
        $aId = $studentIds[$i];
        $aNorm = $normalize($ocrByStudent[$aId]);
        if (mb_strlen($aNorm, 'UTF-8') < 30) {
            continue; // Too short to judge (e.g. just a name).
        }
        for ($j = $i + 1; $j < count($studentIds); $j++) {
            $bId = $studentIds[$j];
            $bNorm = $normalize($ocrByStudent[$bId]);
            if (mb_strlen($bNorm, 'UTF-8') < 30) {
                continue;
            }
            similar_text($aNorm, $bNorm, $percent);
            if ($percent >= 90.0) {
                $similarTo[$aId][] = ['student_user_id' => $bId, 'percent' => round($percent, 1)];
                $similarTo[$bId][] = ['student_user_id' => $aId, 'percent' => round($percent, 1)];
                $duplicatePairs[] = [
                    'student_a' => $aId,
                    'student_b' => $bId,
                    'percent' => round($percent, 1),
                ];
            }
        }
    }

    $students = [];
    foreach ($enrolledStudents as $uid => $student) {
        $subInfo = $submissions[$uid] ?? null;
        $matches = [];
        foreach (($similarTo[$uid] ?? []) as $match) {
            $otherName = $enrolledStudents[$match['student_user_id']]['student_name'] ?? 'Unknown student';
            $matches[] = [
                'student_user_id' => $match['student_user_id'],
                'student_name' => $otherName,
                'percent' => $match['percent'],
            ];
        }
        $students[] = [
            'student_user_id' => $student['student_user_id'],
            'student_name' => $student['student_name'],
            'last_name' => $student['last_name'],
            'first_name' => $student['first_name'],
            'middle_name' => $student['middle_name'],
            'student_id' => $student['student_id'],
            'submitted' => $subInfo !== null,
            'status' => $subInfo['status'] ?? null,
            'date_uploaded' => $subInfo['date_uploaded'] ?? null,
            'submitted_via' => $subInfo['submitted_via'] ?? null,
            'within_window' => $subInfo['within_window'] ?? null,
            'timing_flag' => $subInfo['timing_flag'] ?? null,
            'attempts' => $subInfo['attempts'] ?? null,
            'similar_to' => $matches,
        ];
    }

    usort($students, function ($a, $b) {
        $byLast = strcasecmp($a['last_name'], $b['last_name']);
        if ($byLast !== 0) return $byLast;

        $byFirst = strcasecmp($a['first_name'], $b['first_name']);
        if ($byFirst !== 0) return $byFirst;

        return strcasecmp($a['middle_name'], $b['middle_name']);
    });

    $totalEnrolled = count($students);
    $totalSubmitted = count(array_filter($students, fn($s) => $s['submitted']));

    setCacheHeaders(60);
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'success',
        'exercise_id' => $exercise_id,
        'submit_mode' => $submitMode,
        'total_enrolled' => $totalEnrolled,
        'total_submitted' => $totalSubmitted,
        'window' => [
            'opens_at' => $publishAt,
            'closes_at' => $dueDate,
        ],
        'integrity' => [
            'duplicate_pairs' => $duplicatePairs,
            'flagged_students' => count(array_filter($students, fn($s) => $s['timing_flag'] !== null || count($s['similar_to']) > 0 || ($s['attempts'] !== null && $s['attempts'] > 1))),
        ],
        'students' => $students,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load submission tracker.']);
}
