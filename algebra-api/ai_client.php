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
    $hasAnyItemRubric = false;
    foreach ($submission['items'] as $item) {
        if (!empty($item['rubric'])) {
            $hasAnyItemRubric = true;
            break;
        }
    }

    $itemLines = [];
    foreach ($submission['items'] as $item) {
        $itemRubric = $item['rubric'] ?? null;
        $itemText = sprintf(
            "Item %d\nQuestion: %s\nMax Score: %.2f",
            (int)$item['item_no'],
            trim((string)$item['question_content']),
            isset($item['max_score']) ? (float)$item['max_score'] : 0.0
        );

        if ($itemRubric && !empty($itemRubric['rubric_criteria'])) {
            $itemText .= "\nRubric for this item: " . $itemRubric['rubric_criteria'];
            if (!empty($itemRubric['rubric_ai_instructions'])) {
                $itemText .= "\nRubric AI Instructions: " . $itemRubric['rubric_ai_instructions'];
            }
            if (!empty($itemRubric['rubric_items'])) {
                $criteriaLines = [];
                foreach ($itemRubric['rubric_items'] as $ri) {
                    $criteriaLines[] = sprintf(
                        "- %s (max %.1f pts, effort min %.1f pts)",
                        $ri['description'],
                        $ri['points'],
                        $ri['min_points']
                    );
                }
                $itemText .= "\nRubric criteria:\n" . implode("\n", $criteriaLines);
            }
        }
        $itemLines[] = $itemText;
    }

    // Build assessment-level rubric fallback
    $rubricText = trim((string)($submission['rubric_criteria'] ?? ''));
    $rubricInstructions = trim((string)($submission['rubric_ai_instructions'] ?? ''));
    $hasAssessmentRubric = $rubricText !== '' || $rubricInstructions !== '';

    $gradingGuide = '';
    if ($hasAnyItemRubric) {
        $gradingGuide = "Each item listed above has its own rubric. Grade EACH item using THAT item's specific rubric criteria and weights. "
            . "Do NOT use a single rubric for all items — follow each item's rubric independently.";
    } elseif ($hasAssessmentRubric) {
        $gradingGuide = implode("\n\n", [
            "Rubric Criteria: " . $rubricText,
            "Rubric AI Instructions: " . $rubricInstructions,
        ]);
    } else {
        $gradingGuide = implode("\n\n", [
            "No rubric provided. Use the following default grading criteria:",
            "For each item, grade from 0 to the item's max score (shown above).",
            "Use these 5 criteria to evaluate the student's work:",
            "1. Understanding of the Problem (20%) — Did the student correctly identify the given information and what the problem asks?",
            "2. Algebraic Method/Approach (20%) — Did the student select and apply an appropriate algebraic method, formula, or approach?",
            "3. Solution Process and Computation (30%) — Are the steps correct, logical, properly ordered, and are computations accurate?",
            "4. Completeness of Solution (20%) — Did the student provide sufficient steps and work to demonstrate the complete solution?",
            "5. Final Answer (10%) — Is the final answer correct and provided in an appropriate form?",
            "Credit Levels for Each Criterion:",
            "- Full Credit: Correctly meets all requirements of the criterion.",
            "- Partial Credit: Shows mostly correct understanding but misses or misinterprets a minor detail, or applies with some errors.",
            "- Minimal Credit: Shows limited understanding or an incomplete/inappropriate attempt related to the criterion.",
            "- No Credit: Shows no identifiable understanding or attempt for this criterion.",
            "SCORING POLICY:",
            "- Award 0 ONLY if no attempt is detected.",
            "- If the student submits visible work, award at least 1 point total.",
            "- If the final answer is wrong due to a minor error, preserve credit for correct process and method.",
            "- BE STRICT: Deduct points for errors, missing steps, and wrong answers. Students should earn their scores.",
            "Provide specific feedback explaining what the student did correctly, what errors were found, and what to improve.",
        ]);
    }

    // Build the criteria_scores example based on whether per-item rubrics are used
    if ($hasAnyItemRubric) {
        $criteriaExample = [];
        foreach ($submission['items'] as $item) {
            $itemRubric = $item['rubric'] ?? null;
            if ($itemRubric && !empty($itemRubric['rubric_items'])) {
                foreach ($itemRubric['rubric_items'] as $ri) {
                    $key = strtolower(trim($ri['description']));
                    $criteriaExample[$key] = [
                        'name' => $ri['description'],
                        'weight' => (float)$ri['points'],
                        'earned' => 0,
                        'explanation' => 'Why this score.',
                    ];
                }
            }
        }
        if (empty($criteriaExample)) {
            $criteriaExample = [
                ['name' => 'Understanding of the Problem', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Algebraic Method/Approach', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Solution Process and Computation', 'weight' => 30, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Completeness of Solution', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
                ['name' => 'Final Answer', 'weight' => 10, 'earned' => 0, 'explanation' => 'Why this score.'],
            ];
        }
    } else {
        $criteriaExample = [
            ['name' => 'Understanding of the Problem', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
            ['name' => 'Algebraic Method/Approach', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
            ['name' => 'Solution Process and Computation', 'weight' => 30, 'earned' => 0, 'explanation' => 'Why this score.'],
            ['name' => 'Completeness of Solution', 'weight' => 20, 'earned' => 0, 'explanation' => 'Why this score.'],
            ['name' => 'Final Answer', 'weight' => 10, 'earned' => 0, 'explanation' => 'Why this score.'],
        ];
    }

    return implode("\n\n", [
        "You are grading a student's handwritten algebra submission.",
        "Return valid JSON only with this EXACT structure (ALL fields are REQUIRED):",
        json_encode([
            'overall_score' => 0,
            'overall_feedback' => 'Short overall feedback summary.',
            'criteria_scores' => $criteriaExample,
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
        "- The criteria_scores field is MANDATORY.",
        $hasAnyItemRubric
            ? "- Each item has its own rubric. Grade each item using THAT item's rubric criteria and weights. Include ALL rubric criteria from ALL items in criteria_scores."
            : "- If a custom rubric is provided, follow its criteria and weights exactly.",
        "- overall_score must be a percentage from 0 to 100.",
        "- criteria_scores: earned must be between 0 and the criterion's weight. The sum of earned values divided by total weight gives the percentage, which is then multiplied by the item's max_score to get the final points.",
        "- score_earned for each item must not exceed that item's max score.",
        "- BASELINE FLOOR: If a student has submitted work (OCR text is not empty), each item's score_earned must be at least 1 point, even if all criteria are wrong.",
        "- PARTIAL CREDIT: If the final answer is wrong due to a minor error, preserve credit for correct process and method.",
        "- Provide a short explanation for each criterion describing why that score was given.",
        "- ai_feedback for each item should explain what the student did correctly, what errors were found, and what to improve.",
        "- overall_feedback should summarize strengths, mistakes, and next steps.",
        "- PERFECT SCORES: A score of 100% should only be given for a completely correct solution with the right answer AND all steps shown correctly.",
        "- BE STRICT: Do not be overly generous. Deduct points for errors, missing steps, and wrong answers. Students should earn their scores.",
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
        'temperature' => 0.0,
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

        // Apply baseline floor: minimum 1 point for any visible attempt (default grading only)
        $hasCustomRubric = !empty(trim((string)($submission['rubric_criteria'] ?? ''))) || !empty(trim((string)($submission['rubric_ai_instructions'] ?? '')));
        $minScoreForAttempt = 1.0;
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

    // Build a lookup of rubric items by description for effort minimum enforcement
    $rubricItems = $submission['rubric_items'] ?? [];
    $rubricMinPointsByDesc = [];
    foreach ($rubricItems as $ri) {
        $desc = strtolower(trim((string)($ri['description'] ?? '')));
        if ($desc !== '') {
            $rubricMinPointsByDesc[$desc] = (float)($ri['min_points'] ?? 0);
        }
    }

    $criteriaScores = [];
    foreach (($parsedGeneration['criteria_scores'] ?? []) as $criterion) {
        $weight = isset($criterion['weight']) ? (float)$criterion['weight'] : 0;
        $earned = isset($criterion['earned']) ? (float)$criterion['earned'] : 0;
        $earned = max(0, min($weight, $earned));

        // Apply effort minimum floor per rubric criterion if defined
        $criterionName = strtolower(trim((string)($criterion['name'] ?? '')));
        if (isset($rubricMinPointsByDesc[$criterionName])) {
            $minPts = $rubricMinPointsByDesc[$criterionName];
            if ($minPts > 0 && $earned < $minPts) {
                $earned = $minPts;
            }
        }

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
            ['name' => 'Understanding of the Problem', 'weight' => 20],
            ['name' => 'Algebraic Method/Approach', 'weight' => 20],
            ['name' => 'Solution Process and Computation', 'weight' => 30],
            ['name' => 'Completeness of Solution', 'weight' => 20],
            ['name' => 'Final Answer', 'weight' => 10],
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

    // Derive overall_score from criteria_scores for accuracy (weights sum to 100)
    $totalEarned = 0;
    $totalWeight = 0;
    foreach ($criteriaScores as $cs) {
        $totalEarned += (float)$cs['earned'];
        $totalWeight += (float)$cs['weight'];
    }
    $computedScore = $totalWeight > 0 ? round(($totalEarned / $totalWeight) * 100, 2) : 0;

    // Also compute score from item_scores to ensure effort minimums are reflected
    $itemTotalEarned = 0;
    $itemTotalMax = 0;
    foreach ($normalizedItemScores as $nis) {
        $itemTotalEarned += (float)$nis['score_earned'];
        $itemTotalMax += (float)$nis['max_score'];
    }
    $itemBasedScore = $itemTotalMax > 0 ? round(($itemTotalEarned / $itemTotalMax) * 100, 2) : 0;

    // Use whichever is higher — criteria-based or item-based — to respect effort minimums
    $finalScore = max($computedScore, $itemBasedScore);

    $overallFeedback = trim((string)($parsedGeneration['overall_feedback'] ?? ''));

    // If item-based score is higher due to effort minimums, append a note to the feedback
    if ($itemBasedScore > $computedScore && $itemTotalEarned > 0) {
        $effortNote = "Note: A minimum effort score was applied based on the rubric settings. " .
            "The student earned {$itemTotalEarned} out of {$itemTotalMax} possible points " .
            "due to the minimum point guarantee for attempted work.";
        $overallFeedback = $overallFeedback !== '' ? $overallFeedback . "\n\n" . $effortNote : $effortNote;
    }

    return [
        'model' => $config['model'] ?? 'deepseek-chat',
        'overall_score' => max(0.0, min(100.0, $finalScore)),
        'overall_feedback' => $overallFeedback,
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

/**
 * Detect if OCR text looks like garbage / low-quality extraction.
 * Returns true if the text is likely garbled and should be cleaned up or re-extracted.
 */
function looksLikeOcrGarbage(string $text): bool
{
    if (strlen(trim($text)) < 5) return true;

    // Check for common Tesseract diagnostic patterns
    if (preg_match('/Estimating resolution/i', $text)) return true;
    if (preg_match('/Warning:/i', $text)) return true;

    // High ratio of non-alphanumeric noise characters suggests garbled output
    $cleaned = preg_replace('/[\s\n\r\t]/', '', $text);
    if (strlen($cleaned) === 0) return true;
    $noise = preg_replace('@[a-zA-Z0-9=+\-*/^().,;:!？\[\]{}|\\\/<>~`\'"#%&_¥€£$§°±×÷√∑∏∫∂∞≈≠≤≥±]@', '', $cleaned);
    $noiseRatio = strlen($noise) / strlen($cleaned);
    if ($noiseRatio > 0.35) return true;

    // Lines with very few recognizable words
    $lines = array_filter(explode("\n", $text), fn($l) => trim($l) !== '');
    if (count($lines) > 0) {
        $shortLines = 0;
        foreach ($lines as $line) {
            // Lines with less than 40% alphanumeric chars
            $lineClean = preg_replace('/[\s]/', '', $line);
            if (strlen($lineClean) > 0) {
                $alphaNum = preg_replace('/[^a-zA-Z0-9]/', '', $lineClean);
                if (strlen($alphaNum) / strlen($lineClean) < 0.4) {
                    $shortLines++;
                }
            }
        }
        if (count($lines) > 0 && $shortLines / count($lines) > 0.5) return true;
    }

    return false;
}

/**
 * Use AI (Gemini) to clean up garbled OCR text from handwritten math.
 * Fixes common OCR misrecognitions while preserving math notation.
 */
function cleanupOcrTextWithAi(string $ocrText): string
{
    $config = getAiConfig();
    $apiKey = trim((string)($config['gemini_api_key'] ?? ''));
    if ($apiKey === '') {
        error_log('cleanupOcrTextWithAi: No Gemini API key, skipping cleanup');
        return $ocrText;
    }

    $model = trim((string)($config['gemini_model'] ?? 'gemini-3-flash-preview'));
    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $prompt = 'You are an OCR text cleanup assistant. The following text was extracted from a student\'s handwritten math solution using OCR, but the extraction is garbled and contains errors. '
        . 'Your job is to FIX the OCR errors and produce a clean, accurate transcription of what the student actually wrote. '
        . 'Common OCR mistakes to fix: '
        - 'Misrecognized letters (e.g., "Ceegcey" might be "Correct", "Sowë" might be "Solve", "AnswER" might be "Answer") '
        - 'Garbled math symbols (e.g., "¥" might be "=", "&-" might be "-" or "+") '
        - 'Wrong variable names (e.g., "FIZ" might be "x", "BX" might be "x") '
        - 'Broken equation formatting '
        . 'RULES: '
        . '1. Output ONLY the corrected text, no explanations or commentary '
        . '2. Preserve the original structure (line breaks, numbering) '
        . '3. Use standard math notation: x, y, z for variables; = for equals; +, -, *, / for operators '
        . '4. If a line is completely unintelligible, write [unclear] '
        . '5. Preserve equation numbers like "1.", "2.", "3." '
        . '6. Keep math expressions in a readable format '
        . 'Here is the garbled OCR text to clean up:';

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt],
                    ['text' => $ocrText],
                ],
            ],
        ],
        'generationConfig' => [
            'temperature' => 0.0,
            'maxOutputTokens' => 4096,
        ],
    ];

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
        $error = curl_error($ch);
        curl_close($ch);
        error_log('cleanupOcrTextWithAi: CURL error - ' . $error);
        return $ocrText;
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400) {
        error_log('cleanupOcrTextWithAi: HTTP error ' . $httpCode);
        return $ocrText;
    }

    $decoded = json_decode($rawResponse, true);
    $cleanedText = '';
    $candidates = $decoded['candidates'] ?? [];
    if (!empty($candidates[0]['content']['parts'])) {
        foreach ($candidates[0]['content']['parts'] as $part) {
            if (!empty($part['text'])) {
                $cleanedText .= $part['text'];
            }
        }
    }
    $cleanedText = trim($cleanedText);

    if (strlen($cleanedText) > 0) {
        error_log('cleanupOcrTextWithAi: Cleaned from ' . strlen($ocrText) . ' to ' . strlen($cleanedText) . ' chars');
        return $cleanedText;
    }

    return $ocrText;
}

function extractOcrTextFromSavedFiles(array $savedFiles): array
{
    $config = getAiConfig();
    $ocrProvider = strtolower((string)($config['ocr_provider'] ?? 'tesseract'));
    error_log('OCR Provider configured: ' . $ocrProvider);
    error_log('Gemini API key present: ' . (!empty($config['gemini_api_key']) ? 'yes' : 'no'));

    $result = null;
    $perFileResults = null;

    // Always try Gemini first — it handles handwritten math far better than Tesseract.
    // Tesseract only runs as a last-resort fallback if Gemini is unavailable or fails.
    if (!empty($config['gemini_api_key'])) {
        try {
            $geminiResult = extractTextWithGeminiApi($savedFiles);
            $geminiText = trim((string)($geminiResult['ocr_text'] ?? ''));
            if (!empty($geminiText)) {
                error_log('Gemini OCR succeeded with ' . strlen($geminiText) . ' chars');
                $result = $geminiText;
                // Use per-file results from Gemini if available
                if (!empty($geminiResult['files'])) {
                    $perFileResults = $geminiResult['files'];
                    error_log('Gemini OCR returned per-file results for ' . count($perFileResults) . ' files');
                }
            } else {
                error_log('Gemini OCR returned empty text');
            }
        } catch (Exception $e) {
            error_log('Gemini vision OCR failed: ' . $e->getMessage());
        }
    }

    // If Gemini failed or is not configured, try DeepSeek Vision
    if ($result === null && ($ocrProvider === 'deepseek_vision' || $ocrProvider === 'vision')) {
        try {
            $visionResult = extractTextWithVisionApi($savedFiles);
            $visionText = trim((string)($visionResult['ocr_text'] ?? ''));
            if (!empty($visionText)) {
                error_log('DeepSeek Vision OCR succeeded with ' . strlen($visionText) . ' chars');
                $result = $visionText;
            }
        } catch (Exception $e) {
            error_log('DeepSeek Vision OCR failed: ' . $e->getMessage());
        }
    }

    // Last resort: Tesseract (weak for handwritten math, but better than nothing)
    if ($result === null) {
        try {
            $tesseractResult = extractTextWithTesseract($savedFiles, $config);
            $tesseractText = trim((string)($tesseractResult['ocr_text'] ?? ''));
            $tesseractText = sanitizeOcrText($tesseractText);
            if (strlen($tesseractText) >= 10) {
                $result = $tesseractText;
            } else {
                error_log('Tesseract produced too short output (' . strlen($tesseractText) . ' chars)');
            }
        } catch (Exception $e) {
            error_log('Tesseract OCR failed: ' . $e->getMessage());
        }
    }

    if ($result === null || $result === '') {
        throw new Exception('All OCR methods failed. Please type the student answer manually using the Edit button.');
    }

    // AI cleanup: if the extracted text still looks garbled, clean it up
    if (looksLikeOcrGarbage($result)) {
        error_log('OCR text looks like garbage (' . strlen($result) . ' chars), attempting AI cleanup');
        try {
            $cleanedText = cleanupOcrTextWithAi($result);
            if (strlen($cleanedText) > 0 && !looksLikeOcrGarbage($cleanedText)) {
                error_log('AI cleanup improved OCR text from ' . strlen($result) . ' to ' . strlen($cleanedText) . ' chars');
                $result = $cleanedText;
            } else {
                error_log('AI cleanup did not improve OCR text, keeping original');
            }
        } catch (Exception $e) {
            error_log('AI cleanup failed: ' . $e->getMessage());
        }
    }

    // Build the final result array
    // Use per-file results from Gemini if available, otherwise assign combined text to all files
    $fileResults = [];
    if ($perFileResults !== null) {
        // Map per-file results from Gemini to the saved files
        $perFileMap = [];
        foreach ($perFileResults as $pf) {
            $pfPath = trim((string)($pf['file_path'] ?? ''));
            if ($pfPath !== '') {
                $perFileMap[$pfPath] = $pf;
            }
        }
        foreach ($savedFiles as $file) {
            $relativePath = trim((string)($file['file_path'] ?? ''));
            if ($relativePath !== '' && isset($perFileMap[$relativePath])) {
                $ocrText = trim((string)($perFileMap[$relativePath]['ocr_text'] ?? ''));
                $fileResults[] = [
                    'file_path' => $relativePath,
                    'status' => 'completed',
                    'ocr_text' => !empty($ocrText) ? $ocrText : $result,
                ];
            } elseif ($relativePath !== '') {
                $fileResults[] = [
                    'file_path' => $relativePath,
                    'status' => 'completed',
                    'ocr_text' => $result,
                ];
            }
        }
    } else {
        foreach ($savedFiles as $file) {
            $relativePath = trim((string)($file['file_path'] ?? ''));
            if ($relativePath !== '') {
                $fileResults[] = [
                    'file_path' => $relativePath,
                    'status' => 'completed',
                    'ocr_text' => $result,
                ];
            }
        }
    }

    return [
        'ocr_text' => $result,
        'files' => $fileResults,
        'model' => $ocrProvider,
    ];
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

    $imageCount = count($savedFiles);

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
            . 'Do NOT add commentary or interpretation - output ONLY the extracted text. '
            . ($imageCount > 1
                ? "\n\nIMPORTANT: You are given {$imageCount} image(s). "
                    . 'For EACH image, extract the text separately. '
                    . 'Start each image extraction with the delimiter [IMAGE_N] where N is the image number (1, 2, 3...). '
                    . 'Example format: [IMAGE_1]\nextracted text from image 1\n\n[IMAGE_2]\nextracted text from image 2\n\n'
                    . 'Do NOT skip any image. Process ALL images.'
                : '')],
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

    $maxTokens = max(4096, $imageCount * 4096);

    $payload = [
        'contents' => [
            ['parts' => $parts],
        ],
        'generationConfig' => [
            'temperature' => 0.0,
            'maxOutputTokens' => $maxTokens,
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
        error_log('Gemini OCR: First 300 chars=' . substr($extractedText, 0, 300));
    }

    // Split per-image results using [IMAGE_N] delimiters
    $perImageTexts = [];
    if ($imageCount > 1 && preg_match('/\[IMAGE_\d+\]/', $extractedText)) {
        // Split by [IMAGE_N] delimiters
        $segments = preg_split('/\s*\[IMAGE_(\d+)\]\s*/', $extractedText, -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
        // $segments alternates: text, number, text, number, ...
        $currentText = '';
        for ($i = 0; $i < count($segments); $i++) {
            if (ctype_digit($segments[$i])) {
                // This is a captured number - save previous text if any
                if ($currentText !== '') {
                    $perImageTexts[] = $currentText;
                }
                $currentText = '';
            } else {
                $currentText .= $segments[$i];
            }
        }
        if ($currentText !== '') {
            $perImageTexts[] = $currentText;
        }
        // Trim each segment
        $perImageTexts = array_map('trim', $perImageTexts);
        error_log('Gemini OCR: Split into ' . count($perImageTexts) . ' image segments');
    }

    // Build per-file results
    $fileIndex = 0;
    foreach ($savedFiles as $file) {
        $relativePath = trim((string)($file['file_path'] ?? ''));
        if ($relativePath === '') {
            continue;
        }

        if (!empty($perImageTexts) && $fileIndex < count($perImageTexts)) {
            // Use the per-image text if available
            $ocrText = $perImageTexts[$fileIndex];
        } else {
            // Fall back to the full combined text
            $ocrText = $extractedText;
        }

        $fileResults[] = [
            'file_path' => $relativePath,
            'status' => 'completed',
            'ocr_text' => $ocrText,
        ];
        $fileIndex++;
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
    $imageCount = count($savedFiles);
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
                . 'Do NOT add commentary or interpretation - output ONLY the extracted text.'
                . ($imageCount > 1
                    ? "\n\nIMPORTANT: You are given {$imageCount} image(s). "
                        . 'For EACH image, extract the text separately. '
                        . 'Start each image extraction with the delimiter [IMAGE_N] where N is the image number (1, 2, 3...). '
                        . 'Example format: [IMAGE_1]\nextracted text from image 1\n\n[IMAGE_2]\nextracted text from image 2\n\n'
                        . 'Do NOT skip any image. Process ALL images.'
                    : ''),
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

    $maxTokens = max(4096, $imageCount * 4096);

    $payload = [
        'model' => $ocrModel,
        'temperature' => 0.0,
        'max_tokens' => $maxTokens,
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

    // Split per-image results using [IMAGE_N] delimiters
    $perImageTexts = [];
    if ($imageCount > 1 && preg_match('/\[IMAGE_\d+\]/', $extractedText)) {
        $segments = preg_split('/\s*\[IMAGE_(\d+)\]\s*/', $extractedText, -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
        $currentText = '';
        for ($i = 0; $i < count($segments); $i++) {
            if (ctype_digit($segments[$i])) {
                if ($currentText !== '') {
                    $perImageTexts[] = $currentText;
                }
                $currentText = '';
            } else {
                $currentText .= $segments[$i];
            }
        }
        if ($currentText !== '') {
            $perImageTexts[] = $currentText;
        }
        $perImageTexts = array_map('trim', $perImageTexts);
    }

    $fileIndex = 0;
    foreach ($savedFiles as $file) {
        $relativePath = trim((string)($file['file_path'] ?? ''));
        if ($relativePath === '') {
            continue;
        }

        if (!empty($perImageTexts) && $fileIndex < count($perImageTexts)) {
            $ocrText = $perImageTexts[$fileIndex];
        } else {
            $ocrText = $extractedText;
        }

        $fileResults[] = [
            'file_path' => $relativePath,
            'status' => 'completed',
            'ocr_text' => $ocrText,
        ];
        $fileIndex++;
    }

    return [
        'ocr_text' => $extractedText,
        'files' => $fileResults,
        'model' => $ocrModel,
    ];
}
