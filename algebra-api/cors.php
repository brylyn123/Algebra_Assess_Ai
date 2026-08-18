<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '') {
    $parsedOrigin = parse_url($origin);
    $host = $parsedOrigin['host'] ?? '';
    $scheme = $parsedOrigin['scheme'] ?? '';

    $isAllowed = in_array($origin, [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://algebra-assess-ai.vercel.app',
    ], true) || str_ends_with($host, '.vercel.app') || str_ends_with($host, '.railway.app');

    if ($isAllowed && in_array($scheme, ['http', 'https'], true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header("Vary: Origin");
    }
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}
