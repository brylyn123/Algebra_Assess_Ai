<?php
require_once 'cors.php';
require_once 'auth.php';

clearAuthenticatedUser();

echo json_encode([
    'status' => 'success',
    'message' => 'Logged out successfully.',
]);
?>
