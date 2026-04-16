<?php
require_once __DIR__ . '/ai_config.php';

function decodeJsonObjectFromText(string $content): ?array
{
    $decoded = json_decode($content, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        return $decoded;
    }

    if (preg_match('/\{.*\}/s', $content, $matches) !== 1) {
        return null;
    }

    $decoded = json_decode($matches[0], true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        return $decoded;
    }

    return null;
}

function buildDeepSeekGradePrompt(array $submission): string
{
    $itemLines = [];
    foreach ($submission['items'] as $item) {
        $itemLines[] = sprintf(
            "Item %d\nQuestion: %s\nMax Score: %.2f\nReference Solution: %s",
            (int)$item['item_no'],
            trim((string)$item['question_content']),
            isset($item['max_score']) ? (float)$item['max_score'] : 0.0,
            trim((string)($item['model_solution'] ?? '')) !== '' ? trim((string)$item['model_solution']) : 'Not provided'
        );
    }

    $rubricText = trim((string)($submission['rubric_criteria'] ?? ''));
    $rubricInstructions = trim((string)($submission['rubric_ai_instructions'] ?? ''));

    return implode("\n\n", [
        "You are grading a student's handwritten algebra submission.",
        "Return valid JSON only with this exact top-level shape:",
        json_encode([
            'overall_score' => 0,
            'overall_feedback' => 'Short overall feedback summary.',
            'item_scores' => [
                [
                    'item_id' => 0,
                    'item_no' => 1,
                    'score_earned' => 0,
                    'ai_feedback' => 'Step-by-step explanation for this item.',
                ],
            ],
        ], JSON_PRETTY_PRINT),
        "Rules:",
        "- overall_score must be a percentage from 0 to 100.",
        "- score_earned for each item must not exceed that item's max score.",
        "- ai_feedback for each item should explain what the student did correctly, what errors were found, and what to improve.",
        "- overall_feedback should summarize strengths, mistakes, and next steps.",
        "Assessment Title: " . $submission['assessment_title'],
        "Student Name: " . $submission['student_name'],
        "Rubric Criteria: " . ($rubricText !== '' ? $rubricText : 'Not provided'),
        "Rubric AI Instructions: " . ($rubricInstructions !== '' ? $rubricInstructions : 'Not provided'),
        "Assessment Items:\n" . implode("\n\n", $itemLines),
        "OCR Text of Student Submission:\n" . trim((string)$submission['ocr_text']),
    ]);
}

function generateDeepSeekGrade(array $submission): array
{
    $config = getAiConfig();

    if (empty($config['api_key'])) {
        throw new Exception('DeepSeek API key is not configured. Add it to algebra-api/ai_secrets.local.php or DEEPSEEK_API_KEY.');
    }

    if (empty($submission['ocr_text'])) {
        throw new Exception('No OCR text is available for this submission yet. Add OCR extraction before AI grading, or store extracted text in Captured_Solution.ocr_text.');
    }

    $endpoint = rtrim((string)$config['base_url'], '/') . '/chat/completions';
    $prompt = buildDeepSeekGradePrompt($submission);

    $payload = [
        'model' => $config['model'] ?? 'deepseek-chat',
        'temperature' => 0.2,
        'messages' => [
            [
                'role' => 'system',
                'content' => 'You are a precise algebra grading assistant. Output JSON only.',
            ],
            [
                'role' => 'user',
                'content' => $prompt,
            ],
        ],
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $config['api_key'],
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => (int)($config['timeout_seconds'] ?? 60),
    ]);

    $rawResponse = curl_exec($ch);
    if ($rawResponse === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('DeepSeek request failed: ' . $error);
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decodedResponse = json_decode($rawResponse, true);
    if ($httpCode >= 400) {
        $message = $decodedResponse['error']['message'] ?? $rawResponse;
        throw new Exception('DeepSeek API error: ' . $message);
    }

    $content = $decodedResponse['choices'][0]['message']['content'] ?? '';
    if (!is_string($content) || trim($content) === '') {
        throw new Exception('DeepSeek returned an empty response.');
    }

    $parsedGeneration = decodeJsonObjectFromText($content);
    if (!$parsedGeneration) {
        throw new Exception('DeepSeek response was not valid grading JSON.');
    }

    $itemsByNo = [];
    foreach ($submission['items'] as $item) {
        $itemsByNo[(int)$item['item_no']] = $item;
    }

    $normalizedItemScores = [];
    foreach (($parsedGeneration['item_scores'] ?? []) as $itemScore) {
        $itemNo = isset($itemScore['item_no']) ? (int)$itemScore['item_no'] : 0;
        $matchedItem = $itemsByNo[$itemNo] ?? null;
        if (!$matchedItem) {
            continue;
        }

        $maxScore = isset($matchedItem['max_score']) ? (float)$matchedItem['max_score'] : 0.0;
        $scoreEarned = isset($itemScore['score_earned']) ? (float)$itemScore['score_earned'] : 0.0;
        $scoreEarned = max(0.0, min($maxScore, $scoreEarned));

        $normalizedItemScores[] = [
            'item_id' => (int)$matchedItem['item_id'],
            'item_no' => (int)$matchedItem['item_no'],
            'question_content' => $matchedItem['question_content'],
            'max_score' => $maxScore,
            'score_earned' => round($scoreEarned, 2),
            'ai_feedback' => trim((string)($itemScore['ai_feedback'] ?? '')),
            'is_manual_override' => false,
        ];
    }

    return [
        'model' => $config['model'] ?? 'deepseek-chat',
        'overall_score' => isset($parsedGeneration['overall_score']) ? max(0.0, min(100.0, (float)$parsedGeneration['overall_score'])) : 0.0,
        'overall_feedback' => trim((string)($parsedGeneration['overall_feedback'] ?? '')),
        'item_scores' => $normalizedItemScores,
        'raw_response' => $decodedResponse,
    ];
}

function extractOcrTextFromSavedFiles(array $savedFiles): array
{
    $config = getAiConfig();
    $ocrProvider = strtolower((string)($config['ocr_provider'] ?? 'tesseract'));

    $combinedText = [];
    $fileResults = [];

    foreach ($savedFiles as $file) {
        $relativePath = trim((string)($file['file_path'] ?? ''));
        if ($relativePath === '') {
            continue;
        }

        $absolutePath = __DIR__ . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
        if (!is_file($absolutePath)) {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'missing',
                'ocr_text' => '',
            ];
            continue;
        }

        $extension = strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION));
        if (!in_array($extension, ['jpg', 'jpeg', 'png'], true)) {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'unsupported',
                'ocr_text' => '',
                'message' => 'Only JPG, JPEG, and PNG OCR is currently supported by this integration.',
            ];
            continue;
        }

        if ($ocrProvider !== 'tesseract') {
            throw new Exception(
                'OCR provider "' . $ocrProvider . '" is not supported by this app. '
                . 'Set ocr_provider to "tesseract" and configure tesseract_path in algebra-api/ai_secrets.local.php.'
            );
        }

        $tesseractPath = trim((string)($config['tesseract_path'] ?? ''));
        if ($tesseractPath === '') {
            throw new Exception('OCR is configured for Tesseract, but tesseract_path is missing in algebra-api/ai_secrets.local.php.');
        }
        if (!is_file($tesseractPath)) {
            throw new Exception('Tesseract executable was not found at: ' . $tesseractPath);
        }

        $command = escapeshellarg($tesseractPath)
            . ' '
            . escapeshellarg($absolutePath)
            . ' stdout --psm 6 2>&1';
        $output = shell_exec($command);
        if ($output === null) {
            throw new Exception('Tesseract OCR command failed to run.');
        }

        $ocrText = trim((string)$output);
        $fileResults[] = [
            'file_path' => $relativePath,
            'status' => 'completed',
            'ocr_text' => $ocrText,
        ];

        if ($ocrText !== '') {
            $combinedText[] = $ocrText;
        }
    }

    return [
        'ocr_text' => trim(implode("\n\n", $combinedText)),
        'files' => $fileResults,
        'model' => $ocrProvider === 'tesseract' ? 'tesseract' : ($config['ocr_model'] ?? $config['model'] ?? 'ocr'),
    ];
}
