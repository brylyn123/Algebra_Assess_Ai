<?php
require_once 'auth.php';

$user = getAuthenticatedUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated.']);
    exit();
}

$token = generateCsrfToken();
echo json_encode(['status' => 'success', 'csrf_token' => $token]);
