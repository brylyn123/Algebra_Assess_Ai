<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://algebra-assess-ai.vercel.app',
];

$vercelAppUrl = getenv('VERCEL_APP_URL') ?: '';
if ($vercelAppUrl !== '') {
    $allowedOrigins[] = $vercelAppUrl;
}

if ($origin !== '') {
    $parsedOrigin = parse_url($origin);
    $host = $parsedOrigin['host'] ?? '';

    if (in_array($origin, $allowedOrigins, true) || str_ends_with($host, '.vercel.app')) {
        header("Access-Control-Allow-Origin: {$origin}");
        header("Vary: Origin");
    }
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if (PHP_SAPI !== 'cli' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}
