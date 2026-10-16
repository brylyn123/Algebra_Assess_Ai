<?php
require 'algebra-api/ai_client.php';
require 'algebra-api/db_connect.php';
require 'algebra-api/schema_utils.php';

$conn = $conn ?? null;

$config = getAiConfig();
echo "Model: " . ($config['model'] ?? 'none') . "\n";
echo "API Key: " . (empty($config['api_key']) ? 'MISSING' : 'present (' . strlen($config['api_key']) . ' chars)') . "\n";
echo "Base URL: " . ($config['base_url'] ?? 'none') . "\n";
echo "Timeout: " . ($config['timeout_seconds'] ?? 60) . "\n";

// Test a simple request
$endpoint = rtrim((string)$config['base_url'], '/') . '/chat/completions';
$payload = [
    'model' => $config['model'] ?? 'deepseek-chat',
    'temperature' => 0.0,
    'max_tokens' => 8192,
    'messages' => [
        [
            'role' => 'system',
            'content' => 'You are a test assistant. Respond with "OK".',
        ],
        [
            'role' => 'user',
            'content' => 'Test',
        ],
    ],
];

echo "\nTesting simple request...\n";
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
    echo "CURL ERROR: " . $error . "\n";
} else {
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "HTTP Code: $httpCode\n";
    echo "Response: " . substr($rawResponse, 0, 500) . "\n";
}