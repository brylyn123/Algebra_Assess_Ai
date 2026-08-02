<?php
function setCacheHeaders(int $maxAge = 60, bool $private = true): void {
    $scope = $private ? 'private' : 'public';
    header("Cache-Control: {$scope}, max-age={$maxAge}, must-revalidate");
    header('Expires: ' . gmdate('D, d M Y H:i:s', time() + $maxAge) . ' GMT');
    header('Vary: Authorization, Content-Type');
}
