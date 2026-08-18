<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'ai_client.php';
require_once 'schema_utils.php';

header('Content-Type: application/json');

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

try {
    // Find all submissions with empty ocr_text that belong to this teacher
    $stmt = $conn->prepare(
        "SELECT cs.solution_id, cs.file_path, cs.ocr_text, cs.ai_raw_json
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject s ON s.subject_id = ep.subject_id
         WHERE s.teacher_user_id = ?
           AND (cs.ocr_text IS NULL OR TRIM(cs.ocr_text) = '')
         ORDER BY cs.solution_id ASC"
    );
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    $updated = 0;
    $skipped = 0;
    $failed = 0;
    $details = [];

    while ($row = $result->fetch_assoc()) {
        $solutionId = (int)$row['solution_id'];
        $rawJson = $row['ai_raw_json'] ?? null;
        $decoded = $rawJson ? json_decode($rawJson, true) : null;

        // Try to get OCR text from ai_raw_json first
        $ocrFromJson = '';
        if (is_array($decoded) && isset($decoded['ocr']) && is_array($decoded['ocr']) && !empty($decoded['ocr']['text'])) {
            $ocrFromJson = trim((string)$decoded['ocr']['text']);
        }

        if ($ocrFromJson !== '') {
            // Copy existing OCR text from ai_raw_json to the ocr_text column
            $ocrOrNull = $ocrFromJson;
            $updateStmt = $conn->prepare(
                "UPDATE Captured_Solution SET ocr_text = ? WHERE solution_id = ?"
            );
            $updateStmt->bind_param('si', $ocrOrNull, $solutionId);
            $updateStmt->execute();
            $updateStmt->close();
            $updated++;
            $details[] = ['solution_id' => $solutionId, 'status' => 'copied_from_json', 'chars' => strlen($ocrFromJson)];
            continue;
        }

        // Parse saved files from ai_raw_json or file_path
        $savedFiles = [];
        if (is_array($decoded) && !empty($decoded['files']) && is_array($decoded['files'])) {
            foreach ($decoded['files'] as $file) {
                if (!is_array($file)) continue;
                $filePath = trim((string)($file['file_path'] ?? ''));
                if ($filePath === '') continue;
                $savedFiles[] = [
                    'file_path' => $filePath,
                    'original_name' => $file['original_name'] ?? basename($filePath),
                    'stored_name' => $file['stored_name'] ?? basename($filePath),
                    'size' => isset($file['size']) ? (int)$file['size'] : 0,
                ];
            }
        }
        if (empty($savedFiles)) {
            $fallbackPath = trim((string)($row['file_path'] ?? ''));
            if ($fallbackPath !== '') {
                $savedFiles[] = [
                    'file_path' => $fallbackPath,
                    'original_name' => basename($fallbackPath),
                    'stored_name' => basename($fallbackPath),
                    'size' => 0,
                ];
            }
        }

        if (empty($savedFiles)) {
            $skipped++;
            $details[] = ['solution_id' => $solutionId, 'status' => 'no_files'];
            continue;
        }

        // Run OCR extraction
        try {
            $visionResult = extractOcrTextFromSavedFiles($savedFiles);
            $extractedText = trim((string)($visionResult['ocr_text'] ?? ''));

            if ($extractedText === '') {
                $failed++;
                $details[] = ['solution_id' => $solutionId, 'status' => 'ocr_empty'];
                continue;
            }

            // Update database with new OCR text
            $ocrOrNull = $extractedText;
            $rawPayload = is_array($decoded) ? $decoded : [];
            $rawPayload['ocr'] = [
                'status' => 'completed',
                'source' => 'ai_vision_batch_reextract',
                'model' => $visionResult['model'] ?? 'unknown',
                'generated_at' => gmdate('c'),
                'files' => $visionResult['files'] ?? [],
            ];
            $updateJson = json_encode($rawPayload);

            $updateStmt = $conn->prepare(
                "UPDATE Captured_Solution SET ocr_text = ?, ai_raw_json = ? WHERE solution_id = ?"
            );
            $updateStmt->bind_param('ssi', $ocrOrNull, $updateJson, $solutionId);
            $updateStmt->execute();
            $updateStmt->close();

            $updated++;
            $details[] = ['solution_id' => $solutionId, 'status' => 'ocr_extracted', 'chars' => strlen($extractedText), 'model' => $visionResult['model'] ?? 'unknown'];
        } catch (Exception $e) {
            $failed++;
            $details[] = ['solution_id' => $solutionId, 'status' => 'error', 'message' => $e->getMessage()];
        }

        // Small delay to avoid rate limiting
        usleep(500000); // 0.5 seconds
    }

    echo json_encode([
        'status' => 'success',
        'updated' => $updated,
        'skipped' => $skipped,
        'failed' => $failed,
        'details' => $details,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Batch re-extraction failed: ' . $e->getMessage()]);
}

$conn->close();
?>
