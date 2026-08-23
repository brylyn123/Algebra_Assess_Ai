<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'rate_limiter.php';
require_once 'ai_config.php';
require_once 'ai_client.php';

function checkImageQualityWithImagick(string $filePath): array
{
    if (!class_exists('Imagick')) {
        return ['pass' => true, 'reason' => 'Imagick not available; quality check skipped.'];
    }

    try {
        $imagick = new Imagick();
        $imagick->readImage($filePath);

        $width = $imagick->getImageWidth();
        $height = $imagick->getImageHeight();
        if ($width < 100 || $height < 100) {
            $imagick->destroy();
            return ['pass' => false, 'reason' => 'Image is too small (' . $width . 'x' . $height . ' pixels). Please upload a larger image.'];
        }

        $gray = clone $imagick;
        $gray->setImageType(Imagick::IMGTYPE_GRAYSCALE);
        $gray->setImageDepth(8);

        $laplacianKernel = [
            0, 1, 0,
            1, -4, 1,
            0, 1, 0,
        ];
        $convolved = clone $gray;
        $convolved->convolveImage($laplacianKernel);
        $kurtosis = $convolved->getImageKurtosis();
        $blurScore = is_float($kurtosis) ? $kurtosis : 0.0;

        $meanInfo = $gray->getImageMean();
        $brightness = is_float($meanInfo) ? $meanInfo : 0.0;

        $stdDev = $gray->getImageStdDeviation();
        $contrast = is_float($stdDev) ? $stdDev : 0.0;

        $convolved->destroy();
        $gray->destroy();
        $imagick->destroy();

        $reasons = [];

        if ($blurScore < 50) {
            $reasons[] = 'Image appears blurry (sharpness score: ' . round($blurScore, 1) . '). Please retake with a steady hand or better focus.';
        }

        if ($brightness < 30) {
            $reasons[] = 'Image is too dark (brightness: ' . round($brightness, 1) . '). Please retake in better lighting.';
        } elseif ($brightness > 225) {
            $reasons[] = 'Image is too bright or washed out (brightness: ' . round($brightness, 1) . '). Please retake with less glare.';
        }

        if ($contrast < 20) {
            $reasons[] = 'Image has low contrast (score: ' . round($contrast, 1) . '). Please retake with better lighting or contrast.';
        }

        if (count($reasons) > 0) {
            return ['pass' => false, 'reason' => implode(' ', $reasons)];
        }

        return ['pass' => true, 'reason' => ''];
    } catch (Exception $e) {
        return ['pass' => true, 'reason' => 'Quality check skipped due to processing error.'];
    }
}

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

    $model = trim((string)($config['gemini_model'] ?? 'gemini-2.0-flash'));
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
            'maxOutputTokens' => 128,
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

    $checkStmt = $conn->prepare(
         "SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.due_date
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

    $uploadRoot = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'captured_solutions';
    if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true) && !is_dir($uploadRoot)) {
        throw new Exception('Unable to create the upload directory.');
    }

    $files = $_FILES['files'];
    $isMulti = is_array($files['name']);
    $fileCount = $isMulti ? count($files['name']) : 1;

    if ($fileCount > 5) {
        throw new Exception('You can upload a maximum of 5 files per submission.');
    }

    $totalSize = 0;
    for ($i = 0; $i < $fileCount; $i++) {
        $totalSize += $isMulti ? (int)$files['size'][$i] : (int)$files['size'];
    }
    if ($totalSize > 25 * 1024 * 1024) {
        throw new Exception('Total upload size must be 25MB or smaller.');
    }

    $savedFiles = [];
    $fileErrors = [];

    for ($index = 0; $index < $fileCount; $index++) {
        $error = $isMulti ? $files['error'][$index] : $files['error'];
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            throw new Exception('One of the uploaded files failed to upload.');
        }

        $tmpName = $isMulti ? $files['tmp_name'][$index] : $files['tmp_name'];
        $originalName = $isMulti ? $files['name'][$index] : $files['name'];
        $size = $isMulti ? (int)$files['size'][$index] : (int)$files['size'];

        if ($size > 10 * 1024 * 1024) {
            throw new Exception('Each file must be 10MB or smaller.');
        }

        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'pdf'];
        if (!in_array($extension, $allowed, true)) {
            throw new Exception('Only JPG, JPEG, PNG, and PDF files are allowed.');
        }

        $allowedMimeTypes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'pdf' => 'application/pdf',
        ];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpName);
        if ($mimeType !== $allowedMimeTypes[$extension]) {
            throw new Exception('File type does not match its content. Only image and PDF files are allowed.');
        }

        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($originalName));
        $storedName = sprintf(
            'student_%d_exercise_%d_%s_%d.%s',
            $student_id,
            $exercise_id,
            bin2hex(random_bytes(16)),
            $index,
            $extension
        );
        $targetPath = $uploadRoot . DIRECTORY_SEPARATOR . $storedName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to store one of the uploaded files.');
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
            $qualityResult = checkImageQualityWithImagick($targetPath);
            if (!$qualityResult['pass']) {
                @unlink($targetPath);
                $fileErrors[$index] = ['file' => $originalName, 'reason' => $qualityResult['reason'], 'type' => 'quality'];
                continue;
            }
        }

        $savedFiles[] = [
            'original_name' => $safeName,
            'stored_name' => $storedName,
            'file_path' => 'uploads/captured_solutions/' . $storedName,
            'size' => $size,
        ];
    }

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

    // Send response immediately so student doesn't wait for OCR
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

    // Flush response to client before running slow OCR extraction
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        @ob_end_flush();
        if (ob_get_level()) flush();
    }

    // Background OCR extraction - runs AFTER response is sent to student
    // Wrap in output buffering to prevent any leaked output from corrupting the JSON response
    @ob_start();
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
    @ob_end_clean();

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

    $conn->close();
    exit();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to submit assessment.']);
    $conn->close();
}
?>
