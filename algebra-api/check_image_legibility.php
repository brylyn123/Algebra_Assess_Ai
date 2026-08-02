<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'ai_config.php';
require_once 'rate_limiter.php';

$authUser = requireAuthenticatedUser('student');
validateCsrfToken();
$student_id = (int)$authUser['user_id'];

rateLimitOrDie($conn, $student_id, 'check_image_legibility', 30, 3600);

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No file provided.']);
    exit();
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'File upload failed.']);
    exit();
}

$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png'];
if (!in_array($extension, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Only JPG, JPEG, and PNG images are supported for legibility checks.']);
    exit();
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);
$allowedMimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];
if ($mimeType !== ($allowedMimes[$extension] ?? '')) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'File type does not match its content.']);
    exit();
}

$config = getAiConfig();
$apiKey = trim((string)($config['gemini_api_key'] ?? ''));
if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gemini API key is not configured.']);
    exit();
}

$model = trim((string)($config['gemini_model'] ?? 'gemini-2.0-flash'));
$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

$imageData = file_get_contents($file['tmp_name']);
if ($imageData === false) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to read the uploaded file.']);
    exit();
}

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
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('Gemini vision request failed: ' . $error);
    }

    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decodedResponse = json_decode($rawResponse, true);
    if ($httpCode >= 400) {
        $message = $decodedResponse['error']['message'] ?? $rawResponse;
        throw new Exception('Gemini API error (HTTP ' . $httpCode . '): ' . $message);
    }

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
    $isValidContent = true;
    $friendlyName = '';
    foreach ($invalidTypes as $bad) {
        if (str_contains($contentType, $bad)) {
            $isValidContent = false;
            $friendlyNames = [
                'PERSON_SELFIE' => 'photo of a person/selfie',
                'PHOTO_OBJECT' => 'photo of an object (not a math solution)',
                'SCREENSHOT' => 'screenshot (not handwritten work)',
                'PRINTED_TEXT' => 'printed/typed text (not handwritten)',
                'BLANK' => 'blank or empty image',
            ];
            $friendlyName = $friendlyNames[$bad] ?? $contentType;
            break;
        }
    }

    if (!$isValidContent) {
        echo json_encode([
            'status' => 'success',
            'readable' => false,
            'content_type' => $contentType,
            'reason' => "This appears to be a {$friendlyName}. Please upload a photo of your handwritten math solution.",
        ]);
        exit();
    }

    // Check legibility for valid content
    $readable = str_starts_with($legibilityLine, 'YES') || str_starts_with($contentType, 'HANDWRITTEN_MATH');

    echo json_encode([
        'status' => 'success',
        'readable' => $readable,
        'content_type' => $contentType,
        'reason' => $reason,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
