<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'publish_scheduler.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$exercise_id = isset($data['exercise_id']) ? intval($data['exercise_id']) : null;
$publish_now = !empty($data['publish_now']);

if (!$exercise_id) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Missing exercise_id."]);
    exit;
}

try {
    ensureAssessmentDueDate($conn);
    ensureAssessmentPublishSchedule($conn);

    $checkStmt = $conn->prepare(
        "SELECT ep.exercise_id, ep.is_published, ep.publish_at, ep.publish_notified, ep.title, ep.due_date
         FROM exercises_problem ep
         INNER JOIN subject s ON ep.subject_id = s.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?
         LIMIT 1"
    );
    $checkStmt->bind_param("ii", $exercise_id, $teacher_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $checkRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$checkRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Assessment not found or access denied."]);
        exit;
    }

    $itemStmt = $conn->prepare(
        "SELECT COUNT(*) AS cnt FROM exercise_items WHERE exercise_id = ?"
    );
    $itemStmt->bind_param("i", $exercise_id);
    $itemStmt->execute();
    $itemResult = $itemStmt->get_result();
    $itemRow = $itemResult->fetch_assoc();
    $itemStmt->close();

    if ((int)($itemRow['cnt'] ?? 0) === 0) {
        http_response_code(422);
        echo json_encode(["status" => "error", "message" => "Cannot publish an assessment with no questions. Add at least one question first."]);
        exit;
    }

    $publishTimestamp = !empty($checkRow['publish_at']) ? strtotime($checkRow['publish_at']) : false;
    $hasFutureSchedule = !$publish_now
        && $publishTimestamp !== false
        && $publishTimestamp > time()
        && (int)($checkRow['publish_notified'] ?? 0) === 0;

    if ($hasFutureSchedule) {
        // Activate publishing but keep the schedule: students stay hidden until publish_at,
        // and flushScheduledAssessments() notifies them when it is reached.
        $publishStmt = $conn->prepare(
            "UPDATE exercises_problem SET is_published = 1 WHERE exercise_id = ?"
        );
        $publishStmt->bind_param("i", $exercise_id);
        $publishStmt->execute();
        $publishStmt->close();

        $message = "Assessment scheduled. Students will see it on "
            . date('M d, Y h:i A', $publishTimestamp) . ".";
    } else {
        $publishStmt = $conn->prepare(
            "UPDATE exercises_problem
             SET is_published = 1, publish_at = NULL, publish_notified = 1
             WHERE exercise_id = ?"
        );
        $publishStmt->bind_param("i", $exercise_id);
        $publishStmt->execute();
        $publishStmt->close();

        if ((int)($checkRow['publish_notified'] ?? 0) === 0) {
            $subjectStmt = $conn->prepare(
                "SELECT subject_id FROM assessment_subjects WHERE assessment_id = ?"
            );
            $subjectIds = [];
            if ($subjectStmt) {
                $subjectStmt->bind_param("i", $exercise_id);
                $subjectStmt->execute();
                $subjectResult = $subjectStmt->get_result();
                while ($subjectRow = $subjectResult->fetch_assoc()) {
                    $subjectIds[] = (int)$subjectRow['subject_id'];
                }
                $subjectStmt->close();
            }
            if (empty($subjectIds)) {
                $primaryStmt = $conn->prepare(
                    "SELECT s.subject_id, s.teacher_user_id
                     FROM exercises_problem ep
                     INNER JOIN Subject s ON s.subject_id = ep.subject_id
                     WHERE ep.exercise_id = ?
                     LIMIT 1"
                );
                if ($primaryStmt) {
                    $primaryStmt->bind_param("i", $exercise_id);
                    $primaryStmt->execute();
                    $primaryRow = $primaryStmt->get_result()->fetch_assoc();
                    $primaryStmt->close();
                    if ($primaryRow) {
                        $subjectIds[] = (int)$primaryRow['subject_id'];
                        $teacher_id = (int)$primaryRow['teacher_user_id'];
                    }
                }
            }

            notifyStudentsOfNewAssessment(
                $conn,
                $exercise_id,
                $subjectIds,
                (string)$checkRow['title'],
                !empty($checkRow['due_date']) ? (string)$checkRow['due_date'] : null,
                $teacher_id
            );
        }

        $message = "Assessment published. Students can now see it.";
    }

    echo json_encode([
        "status" => "success",
        "message" => $message,
        "exercise_id" => $exercise_id,
    ]);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Unable to publish assessment."]);
}

$conn->close();
?>
