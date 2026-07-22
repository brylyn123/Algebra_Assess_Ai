<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connection.php';
require_once 'ai_client.php';
require_once 'schema_utils.php';

function decodeSubmissionRawPayload($rawJson) {
    if (!$rawJson) {
        return [];
    }

    $decoded = json_decode((string)$rawJson, true);
    return (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) ? $decoded : [];
}

function extractSubmissionFilesForOcr(array $rawPayload, $fallbackPath = null) {
    $savedFiles = [];
    $rawFiles = $rawPayload['files'] ?? [];

    if (is_array($rawFiles)) {
        foreach ($rawFiles as $file) {
            if (!is_array($file)) {
                continue;
            }

            $filePath = isset($file['file_path']) ? trim((string)$file['file_path']) : '';
            if ($filePath === '') {
                continue;
            }

            $savedFiles[] = [
                'file_path' => $filePath,
                'original_name' => $file['original_name'] ?? basename($filePath),
                'stored_name' => $file['stored_name'] ?? basename($filePath),
                'size' => isset($file['size']) ? (int)$file['size'] : 0,
            ];
        }
    }

    if (count($savedFiles) === 0 && $fallbackPath) {
        $savedFiles[] = [
            'file_path' => (string)$fallbackPath,
            'original_name' => basename((string)$fallbackPath),
            'stored_name' => basename((string)$fallbackPath),
            'size' => 0,
        ];
    }

    return $savedFiles;
}

$data = json_decode(file_get_contents('php://input'), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];
$solution_id = isset($data['solution_id']) ? (int)$data['solution_id'] : 0;
$ocrTextOverride = isset($data['ocr_text_override']) ? trim((string)$data['ocr_text_override']) : '';

if (!$solution_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Solution ID is required.']);
    exit();
}

try {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $submissionStmt = $conn->prepare(
        "SELECT
            cs.solution_id,
            cs.file_path,
            cs.ocr_text,
            cs.ai_raw_json,
            ep.exercise_id,
            ep.title AS assessment_title,
            rs.rubric_name,
            rs.criteria AS rubric_criteria,
            rs.ai_instructions AS rubric_ai_instructions,
            CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name) AS student_name
         FROM Captured_Solution cs
         INNER JOIN Exercises_Problem ep ON ep.exercise_id = cs.exercise_id
         INNER JOIN Subject subj ON subj.subject_id = ep.subject_id
         LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
         LEFT JOIN {$userTable} st ON st.user_id = cs.student_user_id
         WHERE cs.solution_id = ? AND subj.teacher_user_id = ?
         LIMIT 1"
    );
    $submissionStmt->bind_param('ii', $solution_id, $teacher_id);
    $submissionStmt->execute();
    $submissionResult = $submissionStmt->get_result();
    $submission = $submissionResult ? $submissionResult->fetch_assoc() : null;
    $submissionStmt->close();

    if (!$submission) {
        throw new Exception('Submission not found for this teacher.');
    }

    $itemStmt = $conn->prepare(
        "SELECT item_id, item_no, question_content, model_solution, max_score
         FROM exercise_items
         WHERE exercise_id = ?
         ORDER BY item_no ASC"
    );
    $exerciseId = (int)$submission['exercise_id'];
    $itemStmt->bind_param('i', $exerciseId);
    $itemStmt->execute();
    $itemResult = $itemStmt->get_result();

    $items = [];
    while ($itemRow = $itemResult->fetch_assoc()) {
        $items[] = [
            'item_id' => (int)$itemRow['item_id'],
            'item_no' => isset($itemRow['item_no']) ? (int)$itemRow['item_no'] : 1,
            'question_content' => $itemRow['question_content'],
            'model_solution' => $itemRow['model_solution'] ?? '',
            'max_score' => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 0.0,
        ];
    }
    $itemStmt->close();

    $existingRawPayload = decodeSubmissionRawPayload($submission['ai_raw_json'] ?? null);
    $savedFiles = extractSubmissionFilesForOcr($existingRawPayload, $submission['file_path'] ?? null);
    $ocrText = isset($submission['ocr_text']) ? trim((string)$submission['ocr_text']) : '';

    $statusValue = 'processing';
    $processingPayload = $existingRawPayload;
    $processingPayload['ocr'] = [
        'status' => $ocrText !== '' ? 'completed' : 'processing',
        'started_at' => gmdate('c'),
    ];

    $processingStmt = $conn->prepare(
        "UPDATE Captured_Solution
         SET ai_status = ?, ai_raw_json = ?
         WHERE solution_id = ?"
    );
    $processingJson = json_encode($processingPayload);
    $processingStmt->bind_param('ssi', $statusValue, $processingJson, $solution_id);
    $processingStmt->execute();
    $processingStmt->close();

    if ($ocrTextOverride !== '') {
        $ocrText = $ocrTextOverride;
        $existingRawPayload['ocr'] = [
            'status' => 'completed',
            'source' => 'manual_override',
            'generated_at' => gmdate('c'),
        ];

        $ocrTextOrNull = $ocrText !== '' ? $ocrText : null;
        $ocrUpdateJson = json_encode($existingRawPayload);
        $ocrUpdateStmt = $conn->prepare(
            "UPDATE Captured_Solution
             SET ocr_text = ?, ai_raw_json = ?
             WHERE solution_id = ?"
        );
        $ocrUpdateStmt->bind_param('ssi', $ocrTextOrNull, $ocrUpdateJson, $solution_id);
        $ocrUpdateStmt->execute();
        $ocrUpdateStmt->close();
    } elseif ($ocrText !== '') {
        $existingRawPayload['ocr'] = array_merge(
            is_array($existingRawPayload['ocr'] ?? null) ? $existingRawPayload['ocr'] : [],
            [
                'status' => 'completed',
                'generated_at' => gmdate('c'),
            ]
        );
    }

    if ($ocrText === '' && $ocrTextOverride === '') {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'code' => 'ocr_failed',
            'message' => 'No extracted text available. Please type or paste the student\'s answer manually.',
        ]);
        exit();
    }

    $submission['ocr_text'] = $ocrText;
    $submission['items'] = $items;
    $aiGeneration = generateDeepSeekGrade($submission);

    $existingRawPayload['grading_draft'] = [
        'model' => $aiGeneration['model'],
        'generated_at' => gmdate('c'),
        'overall_score' => $aiGeneration['overall_score'],
        'overall_feedback' => $aiGeneration['overall_feedback'],
        'item_scores' => $aiGeneration['item_scores'],
        'raw_response' => $aiGeneration['raw_response'],
    ];

    $rawJson = json_encode($existingRawPayload);
    $statusValue = 'completed';

    $updateStmt = $conn->prepare(
        "UPDATE Captured_Solution
         SET ai_status = ?, ai_raw_json = ?
         WHERE solution_id = ?"
    );
    $updateStmt->bind_param('ssi', $statusValue, $rawJson, $solution_id);
    $updateStmt->execute();
    $updateStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'AI draft generated successfully.',
        'solution_id' => $solution_id,
        'ai_status' => 'completed',
        'ai_generation' => $aiGeneration,
    ]);
} catch (Exception $e) {
    $msg = $e->getMessage();
    if (stripos($msg, 'tesseract') !== false || stripos($msg, 'ocr') !== false) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'code' => 'ocr_failed',
            'message' => 'OCR could not extract readable text from this submission. Please type or paste the student\'s answer manually.',
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $msg]);
    }
}

$conn->close();
