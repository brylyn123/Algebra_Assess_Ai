<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
];

$vercelAppUrl = getenv('VERCEL_APP_URL') ?: '';
if ($vercelAppUrl !== '') {
    $allowedOrigins[] = $vercelAppUrl;
}

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Vary: Origin");
} elseif ($origin !== '') {
    $parsedOrigin = parse_url($origin);
    $host = $parsedOrigin['host'] ?? '';
    $scheme = $parsedOrigin['scheme'] ?? '';
    if (in_array($scheme, ['http', 'https'], true) && in_array($host, ['localhost', '127.0.0.1'], true)) {
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
