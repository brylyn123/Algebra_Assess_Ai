<?php
require_once 'cors.php';
require_once 'auth.php';

$user = getAuthenticatedUser();

if (!$user) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'No active session.',
    ]);
    exit();
}

echo json_encode([
    'status' => 'success',
    'user' => $user,
]);
?>
