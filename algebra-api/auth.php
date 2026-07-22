<?php
require_once __DIR__ . '/cors.php';

function startApiSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('ALGEBRA_ASSESS_SESSION');
    $isProduction = !in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1', ''], true);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isProduction,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function generateCsrfToken(): string
{
    startApiSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCsrfToken(): void
{
    startApiSession();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Invalid or missing CSRF token.']);
        exit();
    }
}

function setAuthenticatedUser(array $user): void
{
    startApiSession();
    session_regenerate_id(true);
    $_SESSION['auth_user'] = [
        'user_id' => (int)$user['user_id'],
        'role' => strtolower((string)($user['role'] ?? '')),
        'email' => (string)($user['email'] ?? ''),
    ];
}

function getAuthenticatedUser(): ?array
{
    startApiSession();
    return isset($_SESSION['auth_user']) && is_array($_SESSION['auth_user'])
        ? $_SESSION['auth_user']
        : null;
}

function clearAuthenticatedUser(): void
{
    startApiSession();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }

    session_destroy();
}

function requireAuthenticatedUser(?string $requiredRole = null): array
{
    $user = getAuthenticatedUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Please log in again.']);
        exit();
    }

    if ($requiredRole !== null && strtolower((string)$user['role']) !== strtolower($requiredRole)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'You are not allowed to access this resource.']);
        exit();
    }

    return $user;
}
