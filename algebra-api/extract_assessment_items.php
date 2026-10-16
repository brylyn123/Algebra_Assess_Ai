<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/ai_config.php';

header('Content-Type: application/json');

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();

$config = getAiConfig();
$apiKey = trim((string)($config['gemini_api_key'] ?? ''));

if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gemini API key is not configured. Add it to algebra-api/ai_secrets.local.php or GEMINI_API_KEY.']);
    exit;
}

$models = array_values(array_unique(array_filter([
    trim((string)($config['gemini_model'] ?? '')),
    'gemini-3.8-flash',
])));
$timeout = min((int)($config['timeout_seconds'] ?? 60), 120);

$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
    'application/msword' => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
];

$maxFiles = 5;
$maxFileSize = 10 * 1024 * 1024; // 10MB

if (!isset($_FILES['files']) || empty($_FILES['files']['name'][0])) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'No files uploaded.']);
    exit;
}

$fileCount = count($_FILES['files']['name']);
if ($fileCount > $maxFiles) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => "Maximum {$maxFiles} files allowed."]);
    exit;
}

$parts = [
    ['text' => 'Extract assessment questions from the uploaded image(s). Return ONLY a JSON object, no other text.\n\n'
        . 'FORMAT (return exactly this, no markdown, no explanation):\n'
        . '{"items":[{"question_content":"question text here","suggested_score":5.0}]}\n\n'
        . 'RULES:\n'
        . '- Each distinct question gets its own entry in the items array\n'
        . '- Use plain text for math, NOT LaTeX. Examples: "3x + 9 = 24" not "$3x + 9 = 24$". Use ^ for exponents (x^2), sqrt() for square roots, / for fractions (1/2).\n'
        . '- Include the full question text, not just the equation\n'
        . '- suggested_score is always 5.0 for all items\n'
        . '- If the image is not an assessment, return {"items":[]}\n'
        . '- Do NOT include question numbers\n'
        . '- Do NOT wrap in markdown code blocks'],
];

$tempFiles = [];
$errors = [];

for ($i = 0; $i < $fileCount; $i++) {
    $fileName = $_FILES['files']['name'][$i];
    $fileTmp = $_FILES['files']['tmp_name'][$i];
    $fileSize = $_FILES['files']['size'][$i];
    $fileError = $_FILES['files']['error'][$i];

    if ($fileError !== UPLOAD_ERR_OK) {
        $errors[] = "Error uploading {$fileName}.";
        continue;
    }

    if ($fileSize > $maxFileSize) {
        $errors[] = "{$fileName} exceeds 10MB limit.";
        continue;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($fileTmp);

    if (!isset($allowedTypes[$mimeType])) {
        $errors[] = "{$fileName} is not a supported file type.";
        continue;
    }

    $ext = $allowedTypes[$mimeType];

    if ($mimeType === 'application/pdf') {
        if (!class_exists('Imagick')) {
            $errors[] = "{$fileName}: PDF processing requires Imagick extension.";
            continue;
        }
        try {
            $imagick = new Imagick();
            $imagick->setResolution(200, 200);
            $imagick->readImage($fileTmp . '[0]');
            $imagick->setImageFormat('png');
            $tempImage = tempnam(sys_get_temp_dir(), 'assessment_extract_') . '.png';
            $imagick->writeImage($tempImage);
            $imagick->destroy();
            $imageData = file_get_contents($tempImage);
            @unlink($tempImage);
            $tempFiles[] = $tempImage;
            $mimeType = 'image/png';
        } catch (Exception $e) {
            $errors[] = "{$fileName}: PDF conversion failed.";
            continue;
        }
    } elseif ($mimeType === 'application/msword' || $mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Word documents: convert using libreoffice headless
        $tempPdf = tempnam(sys_get_temp_dir(), 'assessment_extract_') . '.pdf';
        $cmd = 'libreoffice --headless --convert-to pdf --outdir ' . escapeshellarg(sys_get_temp_dir()) . ' ' . escapeshellarg($fileTmp) . ' 2>&1';
        exec($cmd, $output, $returnCode);
        if ($returnCode !== 0 || !file_exists($tempPdf)) {
            // Try to find the generated PDF (libreoffice uses original filename)
            $baseName = pathinfo($fileTmp, PATHINFO_FILENAME);
            $altPdf = sys_get_temp_dir() . '/' . $baseName . '.pdf';
            if (file_exists($altPdf)) {
                $tempPdf = $altPdf;
            } else {
                $errors[] = "{$fileName}: Word to PDF conversion failed. Ensure LibreOffice is installed.";
                continue;
            }
        }
        $tempFiles[] = $tempPdf;
        // Now process as PDF
        if (!class_exists('Imagick')) {
            $errors[] = "{$fileName}: PDF processing requires Imagick extension.";
            continue;
        }
        try {
            $imagick = new Imagick();
            $imagick->setResolution(200, 200);
            $imagick->readImage($tempPdf . '[0]');
            $imagick->setImageFormat('png');
            $tempImage = tempnam(sys_get_temp_dir(), 'assessment_extract_') . '.png';
            $imagick->writeImage($tempImage);
            $imagick->destroy();
            $imageData = file_get_contents($tempImage);
            @unlink($tempImage);
            $tempFiles[] = $tempImage;
            $mimeType = 'image/png';
        } catch (Exception $e) {
            $errors[] = "{$fileName}: PDF conversion failed after Word conversion.";
            continue;
        }
    } else {
        $imageData = file_get_contents($fileTmp);
    }

    if ($imageData === false) {
        $errors[] = "{$fileName}: Could not read file.";
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
    http_response_code(422);
    echo json_encode([
        'status' => 'error',
        'message' => 'No valid files could be processed.',
        'errors' => $errors,
    ]);
    exit;
}

$maxTokens = max(4096, $fileCount * 4096);

$payload = [
    'contents' => [
        ['parts' => $parts],
    ],
    'generationConfig' => [
        'temperature' => 0.0,
        'maxOutputTokens' => $maxTokens,
    ],
];

$lastError = null;

foreach ($models as $model) {
    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
    error_log("extract_assessment_items: Trying model {$model}");

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => $timeout,
    ]);

    $rawResponse = curl_exec($ch);
    if ($rawResponse === false) {
        $lastError = curl_error($ch);
        curl_close($ch);
        error_log("extract_assessment_items: cURL error for {$model}: {$lastError}");
        continue;
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($rawResponse, true);
    if ($httpCode >= 400) {
        $lastError = $decoded['error']['message'] ?? $rawResponse;
        error_log("extract_assessment_items: API error {$httpCode} for {$model}: {$lastError}");
        if ($httpCode === 429 || $httpCode === 503) {
            sleep(2);
            continue;
        }
        // 404 = model not found, try next model
        if ($httpCode === 404) {
            continue;
        }
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'AI API error: ' . $lastError]);
        exit;
    }

    $content = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (trim($content) === '') {
        $lastError = 'Empty response';
        error_log("extract_assessment_items: Empty response from {$model}");
        continue;
    }

    error_log("extract_assessment_items: Got response from {$model}, length=" . strlen($content));
    break;
}

// Fallback: Try DeepSeek Vision if all Gemini models failed
if (trim($content ?? '') === '') {
    $config = getAiConfig();
    if (!empty($config['api_key'])) {
        error_log("extract_assessment_items: Trying DeepSeek Vision fallback");

        // Build content parts with images for DeepSeek Vision format
        $dsParts = [];
        foreach ($parts as $part) {
            if (is_array($part)) {
                if (isset($part['text'])) {
                    $dsParts[] = ['type' => 'text', 'text' => $part['text']];
                } elseif (isset($part['inlineData'])) {
                    $dsParts[] = [
                        'type' => 'image_url',
                        'image_url' => [
                            'url' => 'data:' . $part['inlineData']['mimeType'] . ';base64,' . $part['inlineData']['data'],
                        ],
                    ];
                }
            }
        }

        $dsPayload = [
            'model' => $config['ocr_model'] ?? 'deepseek-flash',
            'temperature' => 0.0,
            'max_tokens' => 8192,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Extract assessment questions from images. Return ONLY a JSON object: {"items":[{"question_content":"question text","suggested_score":5.0}]}. Use plain text for math (e.g., "3x + 9 = 24", "x^2 - 5x + 6 = 0"), NOT LaTeX.',
                ],
                [
                    'role' => 'user',
                    'content' => $dsParts,
                ],
            ],
        ];

        $ch = curl_init(rtrim($config['base_url'], '/') . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $config['api_key'],
            ],
            CURLOPT_POSTFIELDS => json_encode($dsPayload),
            CURLOPT_TIMEOUT => $timeout,
        ]);

        $rawResponse = curl_exec($ch);
        if ($rawResponse !== false) {
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($httpCode < 400) {
                $decoded = json_decode($rawResponse, true);
                $content = $decoded['choices'][0]['message']['content'] ?? '';
                if (trim($content) !== '') {
                    error_log("extract_assessment_items: DeepSeek Vision succeeded");
                }
            } else {
                error_log("extract_assessment_items: DeepSeek Vision failed HTTP {$httpCode}: " . substr($rawResponse, 0, 500));
            }
        } else {
            error_log("extract_assessment_items: DeepSeek Vision cURL error: " . curl_error($ch));
        }
        curl_close($ch);
    }
}

if (trim($content ?? '') === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'AI service is temporarily unavailable. Please try again in a moment.']);
    exit;
}

// Clean content: remove markdown code blocks if present
$cleanContent = trim($content);
$cleanContent = preg_replace('/^```(?:json)?\s*/i', '', $cleanContent);
$cleanContent = preg_replace('/\s*```$/i', '', $cleanContent);
$cleanContent = trim($cleanContent);

// Parse JSON from response
$parsed = null;
$jsonMatch = null;

// Try direct parse first
$parsed = json_decode($cleanContent, true);

// If direct parse fails, try to find JSON object using balanced brace matching
if (!$parsed || !is_array($parsed)) {
    $braceStart = strpos($cleanContent, '{');
    if ($braceStart !== false) {
        $depth = 0;
        $inString = false;
        $escape = false;
        $len = strlen($cleanContent);
        for ($i = $braceStart; $i < $len; $i++) {
            $ch = $cleanContent[$i];
            if ($escape) {
                $escape = false;
                continue;
            }
            if ($ch === '\\' && $inString) {
                $escape = true;
                continue;
            }
            if ($ch === '"') {
                $inString = !$inString;
                continue;
            }
            if ($inString) {
                continue;
            }
            if ($ch === '{') {
                $depth++;
            } elseif ($ch === '}') {
                $depth--;
                if ($depth === 0) {
                    $jsonCandidate = substr($cleanContent, $braceStart, $i - $braceStart + 1);
                    $parsed = json_decode($jsonCandidate, true);
                    break;
                }
            }
        }
    }
}

// If still no items array, try to find array
if (!$parsed || !isset($parsed['items']) || !is_array($parsed['items'])) {
    if (preg_match('/\[[\s\S]*\]/', $cleanContent, $jsonMatch)) {
        $arrayData = json_decode($jsonMatch[0], true);
        if (is_array($arrayData)) {
            $parsed = ['items' => $arrayData];
        }
    }
}

if (!is_array($parsed) || !isset($parsed['items']) || !is_array($parsed['items'])) {
    error_log('extract_assessment_items: Parse failed. Content: ' . substr($cleanContent, 0, 1000));
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Could not parse extracted items from AI response.',
    ]);
    exit;
}

$items = [];
$itemNo = 1;
foreach ($parsed['items'] as $item) {
    $content = trim((string)($item['question_content'] ?? ''));
    if ($content === '') {
        continue;
    }
    $score = floatval($item['suggested_score'] ?? 5.0);
    $score = max(0.5, min(10.0, $score));

    $items[] = [
        'item_no' => $itemNo,
        'question_type' => 'handwritten_algebra',
        'question_content' => $content,
        'max_score' => $score,
    ];
    $itemNo++;
}

error_log('extract_assessment_items: Extracted ' . count($items) . ' items successfully.');
echo json_encode([
    'status' => 'success',
    'items' => $items,
    'warnings' => !empty($errors) ? $errors : null,
]);
?>
