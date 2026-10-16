<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'notifications_helper.php';

header('Content-Type: application/json');

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$data = json_decode(file_get_contents("php://input"), true);
$solution_id = isset($data['solution_id']) ? intval($data['solution_id']) : 0;
$reason = trim((string)($data['reason'] ?? ''));

if (!$solution_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'solution_id is required.']);
    exit;
}

if ($reason === '') {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'A reason for the reset is required.']);
    exit;
}

try {
    ensureCapturedSolutionResetColumns($conn);

    $checkStmt = $conn->prepare(
        "SELECT cs.solution_id, cs.student_user_id, cs.ai_status, cs.reset_count,
                ep.exercise_id, ep.title AS exercise_title, s.subject_name,
                CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name,
                u.email AS student_email
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject s ON s.subject_id = ep.subject_id
         LEFT JOIN Users st ON st.user_id = cs.student_user_id
         LEFT JOIN Users u ON u.user_id = cs.student_user_id
         WHERE cs.solution_id = ? AND s.teacher_user_id = ?
         LIMIT 1"
    );
    $checkStmt->bind_param('ii', $solution_id, $teacher_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $submission = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$submission) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Submission not found or not owned by this teacher.']);
        exit;
    }

    $conn->begin_transaction();

    $studentId = (int)$submission['student_user_id'];
    $exerciseId = (int)$submission['exercise_id'];
    $exerciseTitle = $submission['exercise_title'] ?? 'assessment';
    $subjectName = $submission['subject_name'] ?? '';
    $studentName = $submission['student_name'] ?? 'Student';

    $delItem = $conn->prepare("DELETE FROM Item_Scores WHERE solution_id = ?");
    $delItem->bind_param('i', $solution_id);
    $delItem->execute();
    $delItem->close();

    $delScore = $conn->prepare("DELETE FROM Scores WHERE solution_id = ?");
    $delScore->bind_param('i', $solution_id);
    $delScore->execute();
    $delScore->close();

    $delSolution = $conn->prepare("DELETE FROM Captured_Solution WHERE solution_id = ?");
    $delSolution->bind_param('i', $solution_id);
    $delSolution->execute();
    $delSolution->close();

    $conn->commit();

    try {
        $notifMsg = "Your grade for \"{$exerciseTitle}\" in {$subjectName} has been reset by your teacher. Reason: {$reason}. Please re-submit your work to receive a new grade.";
        createNotification($conn, $studentId, $teacher_id, 'grade_reset', 'Grade Reset', $notifMsg, 'exercise', $exerciseId);
        if (!empty($submission['student_email'])) {
            sendNotificationEmail(
                $submission['student_email'],
                'grade_reset',
                'Grade Reset: ' . $exerciseTitle,
                $notifMsg
            );
        }
    } catch (Exception $e) {
        error_log('Failed to send grade reset notification: ' . $e->getMessage());
    }

    echo json_encode([
        'status' => 'success',
        'message' => "Grade reset for {$studentName}. Record cleared. Student can re-submit.",
        'solution_id' => $solution_id,
        'reason' => $reason,
    ]);
} catch (Exception $e) {
    if ($conn->in_transaction) {
        $conn->rollback();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to reset grade.']);
}

$conn->close();
?>
