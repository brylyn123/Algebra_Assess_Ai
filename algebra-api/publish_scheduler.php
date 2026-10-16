<?php
require_once __DIR__ . '/schema_utils.php';
require_once __DIR__ . '/notifications_helper.php';

/**
 * Notify every enrolled student about an assessment that is visible to them.
 */
function notifyStudentsOfNewAssessment(
    mysqli $conn,
    int $exerciseId,
    array $subjectIds,
    string $title,
    ?string $dueDate,
    ?int $teacherId
): void {
    $subjectIds = array_values(array_unique(array_filter(array_map('intval', $subjectIds), fn($id) => $id > 0)));
    if (empty($subjectIds)) {
        return;
    }

    $enrollmentCol = getEnrollmentSubjectColumn($conn);

    $notifStmt = $conn->prepare(
        "SELECT DISTINCT e.student_user_id, u.email
         FROM Enrollment e
         INNER JOIN Users u ON u.user_id = e.student_user_id
         WHERE e.$enrollmentCol = ? AND e.enrollment_status = 'enrolled'"
    );
    $subjNameStmt = $conn->prepare("SELECT subject_name FROM Subject WHERE subject_id = ? LIMIT 1");
    if (!$notifStmt || !$subjNameStmt) {
        error_log('Notification prepare failed: ' . $conn->error);
        return;
    }

    foreach ($subjectIds as $sid) {
        $subject_name = 'your subject';
        $subjNameStmt->bind_param('i', $sid);
        $subjNameStmt->execute();
        $subjNameRow = $subjNameStmt->get_result()->fetch_assoc();
        if ($subjNameRow) {
            $subject_name = $subjNameRow['subject_name'] ?? 'your subject';
        }

        $notifStmt->bind_param('i', $sid);
        $notifStmt->execute();
        $notifResult = $notifStmt->get_result();
        while ($student = $notifResult->fetch_assoc()) {
            $studentId = (int)$student['student_user_id'];
            $studentEmail = (string)($student['email'] ?? '');
            $dueMsg = $dueDate ? " Due: {$dueDate}." : '';
            $notifMsg = "A new assessment \"{$title}\" has been added to {$subject_name}.{$dueMsg}";
            createNotification($conn, $studentId, $teacherId, 'assessment_created', 'New Assessment', $notifMsg, 'exercise', $exerciseId);
            if (!empty($studentEmail)) {
                sendNotificationEmail($studentEmail, 'assessment_created', 'New Assessment: ' . $title, $notifMsg);
            }
        }
    }

    $subjNameStmt->close();
    $notifStmt->close();
}

/**
 * Publish assessments whose scheduled publish_at time has passed and notify students.
 *
 * Runs lazily inside regular requests, so no cron job is required. Each assessment is
 * claimed (publish_notified flipped) before notifying, so concurrent requests cannot
 * double-send notifications. Never throws: listing endpoints must not fail because of it.
 *
 * Returns the number of assessments that were published.
 */
function flushScheduledAssessments(mysqli $conn, int $limit = 20): int {
    static $ran = false;
    if ($ran) { return 0; }
    $ran = true;

    try {
        ensureAssessmentPublishSchedule($conn);

        $dueStmt = $conn->prepare(
            "SELECT ep.exercise_id, ep.title, ep.due_date, ep.subject_id
             FROM exercises_problem ep
             WHERE ep.is_published = 1
               AND ep.publish_at IS NOT NULL
               AND ep.publish_at <= NOW()
               AND ep.publish_notified = 0
             ORDER BY ep.publish_at ASC
             LIMIT " . max(1, $limit)
        );
        if (!$dueStmt) {
            return 0;
        }
        $dueStmt->execute();
        $dueResult = $dueStmt->get_result();

        $dueRows = [];
        while ($row = $dueResult->fetch_assoc()) {
            $dueRows[] = $row;
        }
        $dueStmt->close();

        $published = 0;
        foreach ($dueRows as $row) {
            $exerciseId = (int)$row['exercise_id'];

            // Claim first so a concurrent request cannot notify twice.
            $claimStmt = $conn->prepare(
                "UPDATE exercises_problem
                 SET publish_notified = 1
                 WHERE exercise_id = ? AND publish_notified = 0"
            );
            if (!$claimStmt) {
                continue;
            }
            $claimStmt->bind_param('i', $exerciseId);
            $claimStmt->execute();
            $claimed = $claimStmt->affected_rows > 0;
            $claimStmt->close();

            if (!$claimed) {
                continue;
            }

            $subjectIds = [];
            $teacherId = null;

            $primaryStmt = $conn->prepare(
                "SELECT s.subject_id, s.teacher_user_id
                 FROM exercises_problem ep
                 INNER JOIN Subject s ON s.subject_id = ep.subject_id
                 WHERE ep.exercise_id = ?
                 LIMIT 1"
            );
            if ($primaryStmt) {
                $primaryStmt->bind_param('i', $exerciseId);
                $primaryStmt->execute();
                $primaryRow = $primaryStmt->get_result()->fetch_assoc();
                $primaryStmt->close();
                if ($primaryRow) {
                    $subjectIds[] = (int)$primaryRow['subject_id'];
                    $teacherId = isset($primaryRow['teacher_user_id']) ? (int)$primaryRow['teacher_user_id'] : null;
                }
            }

            $linkStmt = $conn->prepare(
                "SELECT subject_id FROM assessment_subjects WHERE assessment_id = ?"
            );
            if ($linkStmt) {
                $linkStmt->bind_param('i', $exerciseId);
                $linkStmt->execute();
                $linkResult = $linkStmt->get_result();
                while ($linkRow = $linkResult->fetch_assoc()) {
                    $subjectIds[] = (int)$linkRow['subject_id'];
                }
                $linkStmt->close();
            }

            notifyStudentsOfNewAssessment(
                $conn,
                $exerciseId,
                $subjectIds,
                (string)$row['title'],
                !empty($row['due_date']) ? (string)$row['due_date'] : null,
                $teacherId
            );
            $published++;
        }

        return $published;
    } catch (Throwable $e) {
        error_log('flushScheduledAssessments failed: ' . $e->getMessage());
        return 0;
    }
}
