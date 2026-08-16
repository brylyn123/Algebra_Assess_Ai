<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'ai_client.php';

header('Content-Type: application/json');

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$data = json_decode(file_get_contents("php://input"), true);
$solution_id = isset($data['solution_id']) ? intval($data['solution_id']) : 0;

if (!$solution_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'solution_id is required.']);
    exit();
}

try {
    // Verify teacher owns this submission
    $checkStmt = $conn->prepare(
        "SELECT cs.solution_id, cs.file_path, cs.ai_raw_json
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject s ON s.subject_id = ep.subject_id
         WHERE cs.solution_id = ? AND s.teacher_user_id = ?"
    );
    $checkStmt->bind_param('ii', $solution_id, $teacher_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $submission = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$submission) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Submission not found or not owned by this teacher.']);
        exit();
    }

    // Parse saved files from ai_raw_json or file_path
    $rawPayload = [];
    if (!empty($submission['ai_raw_json'])) {
        $decoded = json_decode($submission['ai_raw_json'], true);
        if (is_array($decoded)) {
            $rawPayload = $decoded;
        }
    }

    $savedFiles = [];
    if (!empty($rawPayload['files']) && is_array($rawPayload['files'])) {
        $savedFiles = $rawPayload['files'];
    } elseif (!empty($submission['file_path'])) {
        $primaryPath = trim((string)$submission['file_path']);
        if ($primaryPath !== '') {
            $savedFiles = [['file_path' => $primaryPath]];
        }
    }

    if (empty($savedFiles)) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'No files found for this submission.']);
        exit();
    }

    // Run OCR extraction
    $visionResult = extractOcrTextFromSavedFiles($savedFiles);
    $extractedText = trim((string)($visionResult['ocr_text'] ?? ''));

    if ($extractedText === '') {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Could not extract text from the uploaded files.']);
        exit();
    }

    // Update database with new OCR text
    $ocrOrNull = $extractedText !== '' ? $extractedText : null;
    $rawPayload['ocr'] = [
        'status' => 'completed',
        'source' => 'ai_vision_reextract',
        'model' => $visionResult['model'] ?? 'unknown',
        'generated_at' => gmdate('c'),
        'files' => $visionResult['files'] ?? [],
    ];
    $updateJson = json_encode($rawPayload);

    $updateStmt = $conn->prepare(
        "UPDATE Captured_Solution
         SET ocr_text = ?, ai_raw_json = ?
         WHERE solution_id = ?"
    );
    $updateStmt->bind_param('ssi', $ocrOrNull, $updateJson, $solution_id);
    $updateStmt->execute();
    $updateStmt->close();

    echo json_encode([
        'status' => 'success',
        'ocr_text' => $extractedText,
        'model' => $visionResult['model'] ?? 'unknown',
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Re-extraction failed: ' . $e->getMessage()]);
}

$conn->close();
?>
