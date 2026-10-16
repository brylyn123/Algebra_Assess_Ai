<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'rate_limiter.php';
require_once 'ai_config.php';
require_once 'ai_client.php';
require_once 'submission_files_helper.php';

function checkHandwritingLegibility(string $filePath): array
{
    $config = getAiConfig();
    $apiKey = trim((string)($config['gemini_api_key'] ?? ''));
    if ($apiKey === '') {
        return ['readable' => true, 'reason' => 'Legibility check skipped (Gemini API not configured).'];
    }

    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeTypeMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];
    $mimeType = $mimeTypeMap[$extension] ?? 'image/jpeg';

    $imageData = file_get_contents($filePath);
    if ($imageData === false) {
        return ['readable' => true, 'reason' => 'Legibility check skipped (could not read file).'];
    }

    $model = trim((string)($config['gemini_model'] ?? 'gemini-3.8-flash'));
    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $payload = [
        'contents' => [
            ['parts' => [
                ['text' => 'Analyze this image and answer two questions:\n\n1. CONTENT TYPE: What does this image primarily show?\n   - HANDWRITTEN_MATH: Handwritten math solutions, equations, or algebraic work on paper\n   - HANDWRITTEN_TEXT: Handwritten text/notes (not math)\n   - PRINTED_TEXT: Printed or typed text, documents, screenshots\n   - PERSON_SELFIE: A photo of a person, selfie, or portrait\n   - PHOTO_OBJECT: A photo of an object, food, scenery, or anything non-academic\n   - BLANK: Empty or mostly blank paper\n   - OTHER: Anything else\n\n2. LEGIBLE: If this is handwritten content, is it readable? YES or NO\n\nAnswer on exactly two lines:\nLine 1: <CONTENT_TYPE>\nLine 2: <YES/NO> - <brief reason>'],
                ['inlineData' => [
                    'mimeType' => $mimeType,
                    'data' => base64_encode($imageData),
                ]],
            ]],
        ],
        'generationConfig' => [
            'temperature' => 0.1,
            'maxOutputTokens' => 512,
            'thinkingConfig' => ['thinkingBudget' => 0],
        ],
    ];

    try {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => (int)($config['timeout_seconds'] ?? 60),
        ]);

        $rawResponse = curl_exec($ch);
        if ($rawResponse === false) {
            curl_close($ch);
            return ['readable' => true, 'reason' => 'Legibility check skipped (network error).'];
        }

        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            return ['readable' => true, 'reason' => 'Legibility check skipped (API error).'];
        }

        $decodedResponse = json_decode($rawResponse, true);

        $responseText = '';
        $candidates = $decodedResponse['candidates'] ?? [];
        if (!empty($candidates[0]['content']['parts'])) {
            foreach ($candidates[0]['content']['parts'] as $part) {
                if (!empty($part['text'])) {
                    $responseText .= $part['text'];
                }
            }
        }

        $responseText = trim($responseText);
        $lines = preg_split('/\r?\n/', $responseText, 3);
        $contentType = strtoupper(trim($lines[0] ?? 'OTHER'));
        $legibilityLine = trim($lines[1] ?? '');
        $reason = trim($lines[2] ?? $legibilityLine);

        // Reject non-math content
        $invalidTypes = ['PERSON_SELFIE', 'PHOTO_OBJECT', 'SCREENSHOT', 'PRINTED_TEXT', 'BLANK'];
        $isInvalidContent = false;
        foreach ($invalidTypes as $bad) {
            if (str_contains($contentType, $bad)) {
                $isInvalidContent = true;
                break;
            }
        }

        if ($isInvalidContent) {
            $friendlyNames = [
                'PERSON_SELFIE' => 'photo of a person/selfie',
                'PHOTO_OBJECT' => 'photo of an object (not a math solution)',
                'SCREENSHOT' => 'screenshot (not handwritten work)',
                'PRINTED_TEXT' => 'printed/typed text (not handwritten)',
                'BLANK' => 'blank or empty image',
            ];
            $friendlyName = $contentType;
            foreach ($friendlyNames as $key => $name) {
                if (str_contains($contentType, $key)) {
                    $friendlyName = $name;
                    break;
                }
            }
            return [
                'readable' => false,
                'reason' => "This appears to be a {$friendlyName}. Please upload a photo of your handwritten math solution.",
            ];
        }

        // Check legibility for valid content
        $readable = str_starts_with($legibilityLine, 'YES') || str_starts_with($contentType, 'HANDWRITTEN_MATH');

        return ['readable' => $readable, 'reason' => $reason];
    } catch (Exception $e) {
        return ['readable' => true, 'reason' => 'Legibility check skipped (processing error).'];
    }
}

$authUser = requireAuthenticatedUser('student');
validateCsrfToken();
$student_id = (int)$authUser['user_id'];

rateLimitOrDie($conn, $student_id, 'submit_assessment', 10, 3600);

$exercise_id = isset($_POST['exercise_id']) ? intval($_POST['exercise_id']) : null;

if (!$exercise_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Assessment ID is required.']);
    exit();
}

if (!isset($_FILES['files'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Please upload at least one file.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);
    ensureAssessmentDueDate($conn);
    ensureAssessmentPublishSchedule($conn);
    ensureAssessmentSubmitMode($conn);

    $checkStmt = $conn->prepare(
         "SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.due_date,
            ep.is_published,
            ep.publish_at,
            ep.submit_mode
         FROM exercises_problem ep
         INNER JOIN Enrollment e ON e.$enrollmentCol = ep.subject_id AND e.student_user_id = ?
         WHERE ep.exercise_id = ?
         LIMIT 1"
    );
    $checkStmt->bind_param('ii', $student_id, $exercise_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $assessmentRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$assessmentRow) {
        throw new Exception('This assessment is not available for the selected student.');
    }

    // Teacher-administered assessments are uploaded by the teacher, not the student.
    if (($assessmentRow['submit_mode'] ?? 'student') === 'teacher') {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'This assessment is administered by your teacher. Your work will be uploaded by the teacher.',
            'error_code' => 'TEACHER_UPLOAD_ONLY',
        ]);
        exit();
    }

    // Scheduled assessments stay hidden from students until publish_at.
    $publishAt = $assessmentRow['publish_at'] ?? null;
    $publishAtTimestamp = ($publishAt !== null && $publishAt !== '') ? strtotime($publishAt) : false;
    if ((int)($assessmentRow['is_published'] ?? 0) !== 1
        || ($publishAtTimestamp !== false && time() < $publishAtTimestamp)) {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'This assessment is not available yet.',
            'error_code' => 'NOT_PUBLISHED_YET',
        ]);
        exit();
    }

    // Check if due date has passed
    $dueDate = $assessmentRow['due_date'] ?? null;
    if ($dueDate !== null && $dueDate !== '') {
        $dueTimestamp = strtotime($dueDate);
        if ($dueTimestamp !== false && time() > $dueTimestamp) {
            http_response_code(403);
            echo json_encode([
                'status' => 'error',
                'message' => 'This assessment is past its due date and can no longer be submitted.',
                'error_code' => 'PAST_DUE_DATE',
                'due_date' => $dueDate,
            ]);
            exit();
        }
    }

    // Check if student already submitted
    $existingCheck = $conn->prepare(
        "SELECT solution_id FROM Captured_Solution WHERE exercise_id = ? AND student_user_id = ? LIMIT 1"
    );
    $existingCheck->bind_param('ii', $exercise_id, $student_id);
    $existingCheck->execute();
    $existingResult = $existingCheck->get_result();
    if ($existingResult && $existingResult->num_rows > 0) {
        $existingCheck->close();
        http_response_code(409);
        echo json_encode([
            'status' => 'error',
            'message' => 'You have already submitted this assessment.',
            'error_code' => 'ALREADY_SUBMITTED',
        ]);
        exit();
    }
    $existingCheck->close();

    $storeResult = storeSubmissionFiles($_FILES['files'], $exercise_id, $student_id);
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
        'submitted_via' => 'student_submit_portal',
        'ocr' => [
            'status' => 'not_started',
        ],
    ]);
    $aiStatus = 'pending';

    $insertStmt = $conn->prepare(
        "INSERT INTO Captured_Solution (exercise_id, student_user_id, file_path, ocr_text, ai_status, ai_raw_json)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $insertStmt->bind_param(
        'iissss',
        $exercise_id,
        $student_id,
        $primaryFilePath,
        $ocrText,
        $aiStatus,
        $rawJson
    );
    $insertStmt->execute();
    $solutionId = $conn->insert_id;
    $insertStmt->close();

    // Flush response to client before running slow OCR
    if (count($fileErrors) > 0) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Assessment submitted with some files removed due to quality issues.',
            'warnings' => array_values($fileErrors),
            'solution_id' => $solutionId,
            'exercise_id' => $exercise_id,
        ]);
    } else {
        echo json_encode([
            'status' => 'success',
            'message' => 'Assessment submitted successfully.',
            'solution_id' => $solutionId,
            'exercise_id' => $exercise_id,
        ]);
    }

    // Ensure response is sent to client immediately
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // For Apache/mod_php (XAMPP): properly close connection so client gets response
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

    // Background OCR extraction - runs AFTER response is sent to student
    // No output buffering here - client already disconnected
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
        error_log('OCR extraction failed during submission: ' . $e->getMessage());
        $ocrStatus = 'failed';
    }

    // Update the submission with OCR text
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

    // Notify the teacher that a student submitted
    @ob_start();
    try {
        require_once __DIR__ . '/notifications_helper.php';
        $teacherStmt = $conn->prepare(
            "SELECT subj.teacher_user_id, u.email, ep.title AS exercise_title, subj.subject_name
             FROM Exercises_Problem ep
             INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
             INNER JOIN Users u ON u.user_id = subj.teacher_user_id
             WHERE ep.exercise_id = ? LIMIT 1"
        );
        $teacherStmt->bind_param('i', $exercise_id);
        $teacherStmt->execute();
        $teacherRow = $teacherStmt->get_result()->fetch_assoc();
        $teacherStmt->close();

        if ($teacherRow) {
            $teacherId = (int)$teacherRow['teacher_user_id'];
            $teacherEmail = (string)($teacherRow['email'] ?? '');
            $exerciseTitle = (string)($teacherRow['exercise_title'] ?? 'an assessment');
            $subjectName = (string)($teacherRow['subject_name'] ?? '');

            $studentStmt = $conn->prepare("SELECT first_name, last_name FROM Users WHERE user_id = ? LIMIT 1");
            $studentStmt->bind_param('i', $student_id);
            $studentStmt->execute();
            $studentRow = $studentStmt->get_result()->fetch_assoc();
            $studentStmt->close();
            $studentName = trim(($studentRow['first_name'] ?? '') . ' ' . ($studentRow['last_name'] ?? ''));

            $notifMsg = "{$studentName} submitted \"{$exercise_title}\" for {$subject_name}.";
            createNotification($conn, $teacherId, $student_id, 'assessment_submitted', 'New Submission', $notifMsg, 'exercise', $exercise_id);
            if (!empty($teacherEmail)) {
                sendNotificationEmail($teacherEmail, 'assessment_submitted', "New Submission: {$studentName} - {$exerciseTitle}", $notifMsg);
            }
        }
    } catch (Exception $e) {
        error_log('Failed to send submission notification: ' . $e->getMessage());
    }
    @ob_end_clean();

    $conn->close();
    exit();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to submit assessment.']);
    $conn->close();
}
?>
