<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'rate_limiter.php';
require_once 'ai_config.php';
require_once 'ai_client.php';
require_once 'submission_files_helper.php';

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$exercise_id = isset($_POST['exercise_id']) ? intval($_POST['exercise_id']) : null;
$student_user_id = isset($_POST['student_user_id']) ? intval($_POST['student_user_id']) : null;
$action = trim($_POST['action'] ?? 'upload');
if (!in_array($action, ['upload', 'remove'], true)) {
    $action = 'upload';
}

rateLimitOrDie($conn, $teacher_id, 'teacher_upload_submission', 60, 3600);

if (!$exercise_id || !$student_user_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Assessment ID and student ID are required.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureAssessmentSubmitMode($conn);
    ensureScoreReturnColumn($conn);

    // Load the assessment and verify this teacher owns it.
    $assessStmt = $conn->prepare(
        "SELECT ep.exercise_id, ep.subject_id, ep.is_published, ep.title
         FROM exercises_problem ep
         INNER JOIN Subject s ON s.subject_id = ep.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?
         LIMIT 1"
    );
    $assessStmt->bind_param('ii', $exercise_id, $teacher_id);
    $assessStmt->execute();
    $assessmentRow = $assessStmt->get_result()->fetch_assoc();
    $assessStmt->close();

    if (!$assessmentRow) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Assessment not found or not owned by this teacher.']);
        exit();
    }

    if (($assessmentRow['is_published'] ?? 0) != 1) {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Publish this assessment before uploading student submissions.',
            'error_code' => 'NOT_PUBLISHED_YET',
        ]);
        exit();
    }

    // The target student must be enrolled in one of the assessment's subjects.
    $primarySubjectId = (int)$assessmentRow['subject_id'];
    $enrollStmt = $conn->prepare(
        "SELECT 1
         FROM Enrollment e
         WHERE e.student_user_id = ?
           AND e.enrollment_status = 'enrolled'
           AND (
               e.{$enrollmentCol} = ?
               OR e.{$enrollmentCol} IN (SELECT subject_id FROM assessment_subjects WHERE assessment_id = ?)
           )
         LIMIT 1"
    );
    $enrollStmt->bind_param('iii', $student_user_id, $primarySubjectId, $exercise_id);
    $enrollStmt->execute();
    $enrollResult = $enrollStmt->get_result();
    $isEnrolled = $enrollResult && $enrollResult->num_rows > 0;
    $enrollStmt->close();

    if (!$isEnrolled) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'This student is not enrolled in the assessment\'s subject.']);
        exit();
    }

    // Any existing submission for this student (with its score state).
    $existingStmt = $conn->prepare(
        "SELECT cs.solution_id, cs.ai_raw_json, cs.file_path, sc.returned_at
         FROM Captured_Solution cs
         LEFT JOIN Scores sc ON sc.solution_id = cs.solution_id
         WHERE cs.exercise_id = ? AND cs.student_user_id = ?
         LIMIT 1"
    );
    $existingStmt->bind_param('ii', $exercise_id, $student_user_id);
    $existingStmt->execute();
    $existingRow = $existingStmt->get_result()->fetch_assoc();
    $existingStmt->close();

    if ($action === 'remove') {
        if (!$existingRow) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'No submission found for this student.']);
            exit();
        }
        if (!empty($existingRow['returned_at'])) {
            http_response_code(409);
            echo json_encode([
                'status' => 'error',
                'message' => 'This grade has already been returned to the student. Reset it before removing the submission.',
                'error_code' => 'ALREADY_RETURNED',
            ]);
            exit();
        }

        $solutionId = (int)$existingRow['solution_id'];

        $conn->begin_transaction();
        $delItemScores = $conn->prepare('DELETE FROM Item_Scores WHERE solution_id = ?');
        $delItemScores->bind_param('i', $solutionId);
        $delItemScores->execute();
        $delItemScores->close();

        $delScores = $conn->prepare('DELETE FROM Scores WHERE solution_id = ?');
        $delScores->bind_param('i', $solutionId);
        $delScores->execute();
        $delScores->close();

        $delSolution = $conn->prepare('DELETE FROM Captured_Solution WHERE solution_id = ?');
        $delSolution->bind_param('i', $solutionId);
        $delSolution->execute();
        $delSolution->close();
        $conn->commit();

        deleteStoredSubmissionFiles($existingRow['ai_raw_json'] ?? null, $existingRow['file_path'] ?? null);

        echo json_encode([
            'status' => 'success',
            'message' => 'Submission removed.',
            'exercise_id' => $exercise_id,
            'student_user_id' => $student_user_id,
        ]);
        $conn->close();
        exit();
    }

    // ---- action === 'upload' ----
    if (!isset($_FILES['files'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Please upload at least one file.']);
        exit();
    }

    if ($existingRow && !empty($existingRow['returned_at'])) {
        http_response_code(409);
        echo json_encode([
            'status' => 'error',
            'message' => 'This grade has already been returned to the student. Reset it before replacing the submission.',
            'error_code' => 'ALREADY_RETURNED',
        ]);
        exit();
    }

    $storeResult = storeSubmissionFiles($_FILES['files'], $exercise_id, $student_user_id);
    $savedFiles = $storeResult['saved_files'];
    $fileErrors = $storeResult['file_errors'];

    if (count($savedFiles) === 0) {
        if (count($fileErrors) > 0) {
            http_response_code(422);
            echo json_encode([
                'status' => 'error',
                'message' => 'Uploaded files did not pass quality checks.',
                'file_errors' => array_values($fileErrors),
            ]);
        } else {
            throw new Exception('Please upload at least one valid file.');
        }
        exit();
    }

    $primaryFilePath = $savedFiles[0]['file_path'];
    $ocrText = null;
    $rawJson = json_encode([
        'files' => $savedFiles,
        'submitted_via' => 'teacher_upload',
        'uploaded_by' => $teacher_id,
        'ocr' => [
            'status' => 'not_started',
        ],
    ]);
    $aiStatus = 'pending';
    $isReplace = false;

    if ($existingRow) {
        $isReplace = true;
        $solutionId = (int)$existingRow['solution_id'];

        // Discard any draft/manual scores tied to the replaced files.
        $conn->begin_transaction();
        $delItemScores = $conn->prepare('DELETE FROM Item_Scores WHERE solution_id = ?');
        $delItemScores->bind_param('i', $solutionId);
        $delItemScores->execute();
        $delItemScores->close();

        $delScores = $conn->prepare('DELETE FROM Scores WHERE solution_id = ?');
        $delScores->bind_param('i', $solutionId);
        $delScores->execute();
        $delScores->close();

        $updateStmt = $conn->prepare(
            "UPDATE Captured_Solution
             SET file_path = ?, ocr_text = NULL, ai_status = 'pending', ai_raw_json = ?
             WHERE solution_id = ?"
        );
        $updateStmt->bind_param('ssi', $primaryFilePath, $rawJson, $solutionId);
        $updateStmt->execute();
        $updateStmt->close();
        $conn->commit();

        deleteStoredSubmissionFiles($existingRow['ai_raw_json'] ?? null, $existingRow['file_path'] ?? null);
    } else {
        $insertStmt = $conn->prepare(
            "INSERT INTO Captured_Solution (exercise_id, student_user_id, file_path, ocr_text, ai_status, ai_raw_json)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $insertStmt->bind_param(
            'iissss',
            $exercise_id,
            $student_user_id,
            $primaryFilePath,
            $ocrText,
            $aiStatus,
            $rawJson
        );
        $insertStmt->execute();
        $solutionId = $conn->insert_id;
        $insertStmt->close();
    }

    // Flush response to client before running slow OCR
    if (count($fileErrors) > 0) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Submission saved with some files removed due to quality issues.',
            'warnings' => array_values($fileErrors),
            'solution_id' => $solutionId,
            'exercise_id' => $exercise_id,
            'student_user_id' => $student_user_id,
            'replaced' => $isReplace,
        ]);
    } else {
        echo json_encode([
            'status' => 'success',
            'message' => $isReplace ? 'Submission replaced successfully.' : 'Submission uploaded successfully.',
            'solution_id' => $solutionId,
            'exercise_id' => $exercise_id,
            'student_user_id' => $student_user_id,
            'replaced' => $isReplace,
        ]);
    }

    // Ensure response is sent to client immediately
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        header('Connection: close');
        header('Content-Length: ' . ob_get_length());
        @ob_end_flush();
        @flush();
        if (function_exists('ignore_user_abort')) {
            ignore_user_abort(true);
        }
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }
    }

    // Background OCR extraction - runs AFTER response is sent to the teacher
    $ocrText = null;
    $ocrStatus = 'not_started';
    try {
        $ocrResult = extractOcrTextFromSavedFiles($savedFiles);
        $ocrText = trim((string)($ocrResult['ocr_text'] ?? ''));
        if (!empty($ocrText)) {
            $ocrStatus = 'completed';
        } else {
            $ocrStatus = 'empty';
        }
    } catch (Exception $e) {
        error_log('OCR extraction failed during teacher upload: ' . $e->getMessage());
        $ocrStatus = 'failed';
    }

    @ob_start();
    if ($ocrText !== null && $ocrStatus === 'completed') {
        $updateStmt = $conn->prepare(
            "UPDATE Captured_Solution SET ocr_text = ?, ai_status = 'pending' WHERE solution_id = ?"
        );
        $updateStmt->bind_param('si', $ocrText, $solutionId);
        $updateStmt->execute();
        $updateStmt->close();
    }
    @ob_end_clean();

    $conn->close();
    exit();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to save the submission.']);
    $conn->close();
}
?>
