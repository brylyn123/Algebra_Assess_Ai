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
    $hasRubric = $rubricText !== '' || $rubricInstructions !== '';

    $gradingGuide = '';
    if ($hasRubric) {
        $gradingGuide = implode("\n\n", [
            "Rubric Criteria: " . $rubricText,
            "Rubric AI Instructions: " . $rubricInstructions,
        ]);
    } else {
        $gradingGuide = implode("\n\n", [
            "No rubric provided. Use the following default grading criteria with fixed weights:",
            "1. Mathematical Correctness (30%): Accuracy of operations, intermediate results, and final answer.",
            "2. Solution Process (25%): Appropriate method, logical flow, and correct sequencing.",
            "3. Completeness (20%): Required parts and essential solution steps are included.",
            "4. Mathematical Understanding and Relevant Attempt (15%): Observable understanding or meaningful algebraic attempt.",
            "5. Mathematical Notation (10%): Correct use of symbols, variables, equations, and notation.",
            "For each item, evaluate these criteria. The total score is the sum of points earned across all criteria.",
            "IMPORTANT: If a student has submitted work (OCR text is not empty), each item's score_earned must be at least 10% of max_score, even if all answers are incorrect. This ensures students receive credit for attempting the problem.",
            "Provide specific feedback explaining what the student did correctly and what errors were found.",
        ]);
    }

    return implode("\n\n", [
        "You are grading a student's handwritten algebra submission.",
        "Return valid JSON only with this EXACT structure (ALL fields are REQUIRED):",
        json_encode([
            'overall_score' => 0,
            'overall_feedback' => 'Short overall feedback summary.',
            'criteria_scores' => [
                ['name' => 'Mathematical Correctness', 'weight' => 30, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Solution Process', 'weight' => 25, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Completeness', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Mathematical Understanding and Relevant Attempt', 'weight' => 15, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Mathematical Notation', 'weight' => 10, 'earned' => 0, 'explanation' => 'Why this score.'],
            ],
            'item_scores' => [
                [
                    'item_id' => 0,
                    'item_no' => 1,
                    'score_earned' => 0,
                    'ai_feedback' => 'Step-by-step explanation for this item.',
                ],
            ],
        ], JSON_PRETTY_PRINT),
        "CRITICAL RULES:",
        "- The criteria_scores field is MANDATORY. You MUST include all 5 criteria with their weights and earned scores.",
        "- overall_score must be a percentage from 0 to 100.",
        "- criteria_scores: Each criterion has a fixed weight. earned must be between 0 and weight. The sum of all earned values determines the overall quality.",
        "- weight is fixed: Correctness=30, Process=25, Completeness=20, Effort=15, Notation=10. Do NOT change the weights.",
        "- earned is the points the student achieved for that criterion (0 to weight).",
        "- Provide a short explanation for each criterion describing why that score was given.",
        "- score_earned for each item must not exceed that item's max score.",
        "- ai_feedback for each item should explain what the student did correctly, what errors were found, and what to improve.",
        "- overall_feedback should summarize strengths, mistakes, and next steps.",
        "Assessment Title: " . $submission['assessment_title'],
        "Student Name: " . $submission['student_name'],
        $gradingGuide,
        "Assessment Items:\n" . implode("\n\n", $itemLines),
        !empty($submission['ocr_text'])
            ? "OCR Text of Student Submission:\n" . trim((string)$submission['ocr_text'])
            : "Read the student's handwritten work from the attached image(s) and grade accordingly.",
    ]);
}

function generateDeepSeekGrade(array $submission): array
{
    $config = getAiConfig();

    if (empty($config['api_key'])) {
        throw new Exception('DeepSeek API key is not configured. Add it to algebra-api/ai_secrets.local.php or DEEPSEEK_API_KEY.');
    }

    if (empty($submission['ocr_text'])) {
        throw new Exception('No text available for grading.');
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

        // Apply 10% minimum floor when using default grading (no custom rubric)
        $hasCustomRubric = !empty(trim((string)($submission['rubric_criteria'] ?? ''))) || !empty(trim((string)($submission['rubric_ai_instructions'] ?? '')));
        $minScoreForAttempt = $maxScore * 0.10;
        if (!$hasCustomRubric && $scoreEarned < $minScoreForAttempt) {
            $scoreEarned = $minScoreForAttempt;
        }

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

    $criteriaScores = [];
    foreach (($parsedGeneration['criteria_scores'] ?? []) as $criterion) {
        $weight = isset($criterion['weight']) ? (float)$criterion['weight'] : 0;
        $earned = isset($criterion['earned']) ? (float)$criterion['earned'] : 0;
        $earned = max(0, min($weight, $earned));
        $criteriaScores[] = [
            'name' => trim((string)($criterion['name'] ?? '')),
            'weight' => $weight,
            'earned' => round($earned, 2),
            'explanation' => trim((string)($criterion['explanation'] ?? '')),
        ];
    }

    // Fallback: If AI didn't return criteria_scores, generate them from overall_score
    if (empty($criteriaScores)) {
        $overallScore = isset($parsedGeneration['overall_score']) ? (float)$parsedGeneration['overall_score'] : 0;
        $defaultCriteria = [
            ['name' => 'Mathematical Correctness', 'weight' => 30],
            ['name' => 'Solution Process', 'weight' => 25],
            ['name' => 'Completeness', 'weight' => 20],
            ['name' => 'Mathematical Understanding and Relevant Attempt', 'weight' => 15],
            ['name' => 'Mathematical Notation', 'weight' => 10],
        ];
        foreach ($defaultCriteria as $dc) {
            $earned = round(($overallScore / 100) * $dc['weight'], 2);
            $criteriaScores[] = [
                'name' => $dc['name'],
                'weight' => $dc['weight'],
                'earned' => max(0, min($dc['weight'], $earned)),
                'explanation' => 'Score derived from overall assessment.',
            ];
        }
    }

    return [
        'model' => $config['model'] ?? 'deepseek-chat',
        'overall_score' => isset($parsedGeneration['overall_score']) ? max(0.0, min(100.0, (float)$parsedGeneration['overall_score'])) : 0.0,
        'overall_feedback' => trim((string)($parsedGeneration['overall_feedback'] ?? '')),
        'criteria_scores' => $criteriaScores,
        'item_scores' => $normalizedItemScores,
        'raw_response' => $decodedResponse,
    ];
}

function sanitizeOcrText(string $text): string
{
    $lines = explode("\n", $text);
    $filtered = array_filter($lines, function ($line) {
        $trimmed = trim($line);
        if ($trimmed === '') return false;
        // Tesseract diagnostic messages
        if (preg_match('/^Estimating resolution/i', $trimmed)) return false;
        if (preg_match('/^Warning:/i', $trimmed)) return false;
        if (preg_match('/^Empty page/i', $trimmed)) return false;
        if (preg_match('/^Page \d+/i', $trimmed)) return false;
        if (preg_match('/^Read (done|failed)/i', $trimmed)) return false;
        if (preg_match('/^OCR engine/i', $trimmed)) return false;
        if (preg_match('/^Found \d+ text/i', $trimmed)) return false;
        if (preg_match('/^Too many characters/i', $trimmed)) return false;
        if (preg_match('/^\d+$/i', $trimmed)) return false; // lines with only numbers (diagnostics)
        if (preg_match('/^Version:/i', $trimmed)) return false;
        if (preg_match('/^Configuration:/i', $trimmed)) return false;
        // Also filter lines that are just resolution/dimension numbers like "488"
        if (preg_match('/^\d{2,4}$/', $trimmed)) return false;
        return true;
    });
    $result = trim(implode("\n", $filtered));
    // Log for debugging
    if ($result !== $text) {
        error_log('sanitizeOcrText: filtered from ' . strlen($text) . ' to ' . strlen($result) . ' chars');
    }
    return $result;
}

function extractOcrTextFromSavedFiles(array $savedFiles): array
{
    $config = getAiConfig();
    $ocrProvider = strtolower((string)($config['ocr_provider'] ?? 'tesseract'));
    error_log('OCR Provider configured: ' . $ocrProvider);
    error_log('Gemini API key present: ' . (!empty($config['gemini_api_key']) ? 'yes' : 'no'));

    // For handwritten math, AI vision providers (Gemini/DeepSeek) are much better than Tesseract
    // Try the configured AI vision provider FIRST, then fall back to Tesseract
    if ($ocrProvider === 'gemini') {
        try {
            $result = extractTextWithGeminiApi($savedFiles);
            $geminiText = trim((string)($result['ocr_text'] ?? ''));
            if (!empty($geminiText)) {
                error_log('Gemini OCR succeeded with ' . strlen($geminiText) . ' chars');
                return $result;
            }
            error_log('Gemini OCR returned empty text');
        } catch (Exception $e) {
            error_log('Gemini vision OCR failed: ' . $e->getMessage());
        }
    } elseif ($ocrProvider === 'deepseek_vision' || $ocrProvider === 'vision') {
        try {
            $result = extractTextWithVisionApi($savedFiles);
            $visionText = trim((string)($result['ocr_text'] ?? ''));
            if (!empty($visionText)) {
                error_log('DeepSeek Vision OCR succeeded with ' . strlen($visionText) . ' chars');
                return $result;
            }
        } catch (Exception $e) {
            error_log('DeepSeek Vision OCR failed: ' . $e->getMessage());
        }
    }

    // Fallback to Tesseract (better for printed text, weaker for handwriting)
    $tesseractResult = null;
    try {
        $tesseractResult = extractTextWithTesseract($savedFiles, $config);
        $tesseractText = trim((string)($tesseractResult['ocr_text'] ?? ''));
        $tesseractText = sanitizeOcrText($tesseractText);
        $tesseractResult['ocr_text'] = $tesseractText;
        if (strlen($tesseractText) >= 10) {
            return $tesseractResult;
        }
        error_log('Tesseract produced too short output (' . strlen($tesseractText) . ' chars)');
    } catch (Exception $e) {
        error_log('Tesseract OCR failed: ' . $e->getMessage());
    }

    // If Tesseract failed but Gemini is available, try it as final fallback
    if ($ocrProvider !== 'gemini') {
        try {
            $result = extractTextWithGeminiApi($savedFiles);
            if (!empty(trim((string)($result['ocr_text'] ?? '')))) {
                return $result;
            }
        } catch (Exception $e) {
            error_log('Gemini fallback OCR failed: ' . $e->getMessage());
        }
    }

    // If we have a partial Tesseract result, return it as last resort
    if ($tesseractResult && !empty(trim((string)($tesseractResult['ocr_text'] ?? '')))) {
        return $tesseractResult;
    }

    throw new Exception('All OCR methods failed. Please type the student answer manually using the Edit button.');
}

function extractTextWithTesseract(array $savedFiles, array $config): array
{
    $combinedText = [];
    $fileResults = [];

    $tesseractPath = trim((string)($config['tesseract_path'] ?? ''));
    if ($tesseractPath === '' || !is_file($tesseractPath)) {
        throw new Exception('Tesseract OCR is not available.');
    }

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
                'message' => 'Only JPG, JPEG, and PNG files can be processed by Tesseract.',
            ];
            continue;
        }

        // Preprocess image with Imagick for better OCR accuracy
        $processedPath = $absolutePath;
        if (class_exists('Imagick')) {
            try {
                $imagick = new Imagick();
                $imagick->readImage($absolutePath);
                // Convert to grayscale
                $imagick->setImageColorspace(Imagick::COLORSPACE_GRAY);
                // Increase contrast for better text separation
                $imagick->contrastImage(true);
                // Normalize brightness
                $imagick->normalizeImage(Imagick::CHANNEL_ALL);
                // Sharpen to make edges clearer
                $imagick->sharpenImage(0, 2.0);
                // Increase DPI for better recognition
                $imagick->setImageResolution(300, 300);
                $imagick->resampleImage(300, 300, Imagick::FILTER_LANCZOS, 1);
                $tempProcessed = tempnam(sys_get_temp_dir(), 'ocr_preprocessed_') . '.png';
                $imagick->writeImage($tempProcessed);
                $imagick->destroy();
                $processedPath = $tempProcessed;
            } catch (Exception $e) {
                error_log('Image preprocessing failed, using original: ' . $e->getMessage());
                $processedPath = $absolutePath;
            }
        }

        // Run Tesseract with PSM 6 (assume uniform block of text) for better handwriting support
        // PSM 6 works better for handwritten text blocks than PSM 3
        // On Windows, use 2>NUL to suppress stderr (diagnostic messages like "Estimating resolution")
        $stderrRedirect = (PHP_OS_FAMILY === 'Windows') ? ' 2>NUL' : ' 2>/dev/null';
        $command = escapeshellarg($tesseractPath)
            . ' '
            . escapeshellarg($processedPath)
            . ' stdout --psm 6 --oem 1 -l eng' . $stderrRedirect;
        $output = shell_exec($command);

        // Clean up preprocessed temp file
        if ($processedPath !== $absolutePath && is_file($processedPath)) {
            @unlink($processedPath);
        }

        $ocrText = trim((string)($output ?? ''));
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
        'model' => 'tesseract',
    ];
}

function convertPdfToImage(string $pdfPath): ?string
{
    if (!class_exists('Imagick')) {
        return null;
    }

    try {
        $imagick = new Imagick();
        $imagick->setResolution(200, 200);
        $imagick->readImage($pdfPath . '[0]');
        $imagick->setImageFormat('png');
        $tempImage = tempnam(sys_get_temp_dir(), 'ocr_pdf_') . '.png';
        $imagick->writeImage($tempImage);
        $imagick->destroy();
        return $tempImage;
    } catch (Exception $e) {
        return null;
    }
}

function extractTextWithGeminiApi(array $savedFiles): array
{
    $config = getAiConfig();
    $apiKey = trim((string)($config['gemini_api_key'] ?? ''));
    if ($apiKey === '') {
        throw new Exception('Gemini API key is not configured.');
    }

    $model = trim((string)($config['gemini_model'] ?? 'gemini-3-flash-preview'));
    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    error_log('Gemini OCR: Starting extraction with model=' . $model);
    error_log('Gemini OCR: API key length=' . strlen($apiKey) . ' chars');

    $parts = [
        ['text' => 'You are a precise OCR assistant for student handwritten math submissions. '
            . 'Extract ALL text and mathematical expressions EXACTLY as written by the student. '
            . 'PRESERVE THE ORIGINAL HANDWRITTEN STEPS - do not skip, summarize, or reorganize. '
            . 'Transcribe each line of handwritten work in the order it appears on the page. '
            . 'For handwritten math, use standard mathematical notation: '
            . '- Fractions: use / for inline (e.g., 1/2) or vertical notation when clear '
            . '- Exponents: use ^ (e.g., x^2) '
            . '- Square roots: use √ or sqrt() '
            . '- Variables: use standard letters (x, y, z, a, b, c) '
            . '- Equations: preserve = signs and equation numbering '
            . '- Systems of equations: use curly brace notation or label as Equation 1, Equation 2 '
            . '- Solution sets: write as (x, y) = (value, value) '
            . 'Include ALL intermediate steps, calculations, and final answers. '
            . 'Do NOT add commentary or interpretation - output ONLY the extracted text.'],
    ];

    $fileResults = [];
    $tempFiles = [];

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
        $imagePath = $absolutePath;
        $mimeType = 'image/jpeg';

        if ($extension === 'pdf') {
            if (class_exists('Imagick')) {
                try {
                    $imagick = new Imagick();
                    $imagick->setResolution(200, 200);
                    $imagick->readImage($absolutePath . '[0]');
                    $imagick->setImageFormat('png');
                    $tempImage = tempnam(sys_get_temp_dir(), 'ocr_gemini_') . '.png';
                    $imagick->writeImage($tempImage);
                    $imagick->destroy();
                    $imagePath = $tempImage;
                    $mimeType = 'image/png';
                    $tempFiles[] = $tempImage;
                } catch (Exception $e) {
                    $fileResults[] = [
                        'file_path' => $relativePath,
                        'status' => 'unsupported',
                        'ocr_text' => '',
                        'message' => 'PDF to image conversion failed.',
                    ];
                    continue;
                }
            } else {
                $fileResults[] = [
                    'file_path' => $relativePath,
                    'status' => 'unsupported',
                    'ocr_text' => '',
                    'message' => 'PDF to image conversion requires the Imagick PHP extension.',
                ];
                continue;
            }
        } elseif ($extension === 'png') {
            $mimeType = 'image/png';
        } elseif ($extension === 'webp') {
            $mimeType = 'image/webp';
        } else {
            $mimeType = 'image/jpeg';
        }

        $imageData = file_get_contents($imagePath);
        if ($imageData === false) {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'read_error',
                'ocr_text' => '',
            ];
            continue;
        }

        $parts[] = [
            'inlineData' => [
                'mimeType' => $mimeType,
                'data' => base64_encode($imageData),
            ],
        ];
    }

    foreach ($tempFiles as $tmp) {
        if (is_file($tmp)) {
            @unlink($tmp);
        }
    }

    if (count($parts) <= 1) {
        error_log('Gemini OCR: No images found to process');
        return [
            'ocr_text' => '',
            'files' => $fileResults,
            'model' => $model,
        ];
    }

    error_log('Gemini OCR: Sending ' . (count($parts) - 1) . ' image(s) to Gemini API');

    $payload = [
        'contents' => [
            ['parts' => $parts],
        ],
        'generationConfig' => [
            'temperature' => 0.1,
            'maxOutputTokens' => 4096,
        ],
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => (int)($config['timeout_seconds'] ?? 120),
    ]);

    $rawResponse = curl_exec($ch);
    if ($rawResponse === false) {
        $error = curl_error($ch);
        curl_close($ch);
        error_log('Gemini OCR: CURL error - ' . $error);
        throw new Exception('Gemini vision request failed: ' . $error);
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    error_log('Gemini OCR: HTTP response code=' . $httpCode);
    error_log('Gemini OCR: Raw response length=' . strlen($rawResponse) . ' chars');

    $decodedResponse = json_decode($rawResponse, true);
    if ($httpCode >= 400) {
        $message = $decodedResponse['error']['message'] ?? $rawResponse;
        error_log('Gemini OCR: API error - ' . $message);
        throw new Exception('Gemini API error (HTTP ' . $httpCode . ': ' . $message);
    }

    $extractedText = '';
    $candidates = $decodedResponse['candidates'] ?? [];
    error_log('Gemini OCR: Candidates count=' . count($candidates));
    if (!empty($candidates[0]['content']['parts'])) {
        foreach ($candidates[0]['content']['parts'] as $part) {
            if (!empty($part['text'])) {
                $extractedText .= $part['text'];
            }
        }
    }
    $extractedText = trim($extractedText);
    error_log('Gemini OCR: Extracted text length=' . strlen($extractedText) . ' chars');
    if (strlen($extractedText) > 0) {
        error_log('Gemini OCR: First 200 chars=' . substr($extractedText, 0, 200));
    }

    foreach ($savedFiles as $file) {
        $relativePath = trim((string)($file['file_path'] ?? ''));
        if ($relativePath !== '') {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'completed',
                'ocr_text' => $extractedText,
            ];
        }
    }

    return [
        'ocr_text' => $extractedText,
        'files' => $fileResults,
        'model' => $model,
    ];
}

function extractTextWithVisionApi(array $savedFiles): array
{
    $config = getAiConfig();

    if (empty($config['api_key'])) {
        throw new Exception('DeepSeek API key is not configured for vision OCR.');
    }

    $endpoint = rtrim((string)$config['base_url'], '/') . '/chat/completions';
    $ocrModel = $config['ocr_model'] ?? $config['model'] ?? 'deepseek-chat';

    $combinedText = [];
    $fileResults = [];
    $contentParts = [
        [
            'type' => 'text',
            'text' => 'You are a precise OCR assistant for student handwritten math submissions. '
                . 'Extract ALL text and mathematical expressions EXACTLY as written by the student. '
                . 'PRESERVE THE ORIGINAL HANDWRITTEN STEPS - do not skip, summarize, or reorganize. '
                . 'Transcribe each line of handwritten work in the order it appears on the page. '
                . 'For handwritten math, use standard mathematical notation: '
                . '- Fractions: use / for inline (e.g., 1/2) or vertical notation when clear '
                . '- Exponents: use ^ (e.g., x^2) '
                . '- Square roots: use √ or sqrt() '
                . '- Variables: use standard letters (x, y, z, a, b, c) '
                . '- Equations: preserve = signs and equation numbering '
                . '- Systems of equations: use curly brace notation or label as Equation 1, Equation 2 '
                . '- Solution sets: write as (x, y) = (value, value) '
                . 'Include ALL intermediate steps, calculations, and final answers. '
                . 'Do NOT add commentary or interpretation - output ONLY the extracted text.',
        ],
    ];

    $tempFiles = [];

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

        $imagePath = $absolutePath;
        $mimeType = 'image/jpeg';

        if ($extension === 'pdf') {
            $convertedPath = convertPdfToImage($absolutePath);
            if ($convertedPath && is_file($convertedPath)) {
                $imagePath = $convertedPath;
                $mimeType = 'image/png';
                $tempFiles[] = $convertedPath;
            } else {
                $fileResults[] = [
                    'file_path' => $relativePath,
                    'status' => 'unsupported',
                    'ocr_text' => '',
                    'message' => 'PDF to image conversion requires the Imagick PHP extension.',
                ];
                continue;
            }
        } elseif ($extension === 'png') {
            $mimeType = 'image/png';
        } else {
            $mimeType = 'image/jpeg';
        }

        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'pdf'], true)) {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'unsupported',
                'ocr_text' => '',
                'message' => 'Unsupported file type for vision OCR.',
            ];
            continue;
        }

        $imageData = file_get_contents($imagePath);
        if ($imageData === false) {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'read_error',
                'ocr_text' => '',
            ];
            continue;
        }

        $base64 = base64_encode($imageData);
        $contentParts[] = [
            'type' => 'image_url',
            'image_url' => [
                'url' => 'data:' . $mimeType . ';base64,' . $base64,
            ],
        ];
    }

    foreach ($tempFiles as $tmp) {
        if (is_file($tmp)) {
            @unlink($tmp);
        }
    }

    if (count($contentParts) <= 1) {
        return [
            'ocr_text' => '',
            'files' => $fileResults,
            'model' => $ocrModel,
        ];
    }

    $payload = [
        'model' => $ocrModel,
        'temperature' => 0.1,
        'max_tokens' => 4096,
        'messages' => [
            [
                'role' => 'system',
                'content' => 'You are a precise OCR assistant for student answer sheets. Extract text accurately, preserving mathematical notation. Output only the extracted text.',
            ],
            [
                'role' => 'user',
                'content' => $contentParts,
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
        CURLOPT_TIMEOUT => (int)($config['timeout_seconds'] ?? 120),
    ]);

    $rawResponse = curl_exec($ch);
    if ($rawResponse === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('DeepSeek vision request failed: ' . $error);
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decodedResponse = json_decode($rawResponse, true);
    if ($httpCode >= 400) {
        $message = $decodedResponse['error']['message'] ?? $rawResponse;
        throw new Exception('DeepSeek vision API error (HTTP ' . $httpCode . '): ' . $message);
    }

    $extractedText = trim((string)($decodedResponse['choices'][0]['message']['content'] ?? ''));

    foreach ($savedFiles as $file) {
        $relativePath = trim((string)($file['file_path'] ?? ''));
        if ($relativePath !== '') {
            $fileResults[] = [
                'file_path' => $relativePath,
                'status' => 'completed',
                'ocr_text' => $extractedText,
            ];
        }
    }

    return [
        'ocr_text' => $extractedText,
        'files' => $fileResults,
        'model' => $ocrModel,
    ];
}
