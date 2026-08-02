<?php
function ensureRateLimitTable(mysqli $conn): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $conn->query("CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint VARCHAR(100) NOT NULL,
        hit_count INT NOT NULL DEFAULT 1,
        window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_rate_limit (user_id, endpoint, window_start)
    )");
}

function checkRateLimit(mysqli $conn, int $userId, string $endpoint, int $maxHits, int $windowSeconds): bool {
    ensureRateLimitTable($conn);

    $windowStart = date('Y-m-d H:i:s', time() - $windowSeconds);

    $conn->query(
        "DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL {$windowSeconds} SECOND"
    );

    $stmt = $conn->prepare(
        "SELECT hit_count FROM rate_limits
         WHERE user_id = ? AND endpoint = ? AND window_start >= ?
         ORDER BY window_start DESC LIMIT 1"
    );
    $stmt->bind_param('iss', $userId, $endpoint, $windowStart);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($row && (int)$row['hit_count'] >= $maxHits) {
        return false;
    }

    if ($row) {
        $stmt = $conn->prepare(
            "UPDATE rate_limits SET hit_count = hit_count + 1
             WHERE user_id = ? AND endpoint = ? AND window_start >= ?"
        );
        $stmt->bind_param('iss', $userId, $endpoint, $windowStart);
        $stmt->execute();
        $stmt->close();
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO rate_limits (user_id, endpoint, hit_count, window_start)
             VALUES (?, ?, 1, NOW())"
        );
        $stmt->bind_param('is', $userId, $endpoint);
        $stmt->execute();
        $stmt->close();
    }

    return true;
}

function rateLimitOrDie(mysqli $conn, int $userId, string $endpoint, int $maxHits, int $windowSeconds): void {
    if (!checkRateLimit($conn, $userId, $endpoint, $maxHits, $windowSeconds)) {
        http_response_code(429);
        header('Content-Type: application/json');
        header('Retry-After: ' . $windowSeconds);
        echo json_encode([
            'status' => 'error',
            'message' => 'Too many requests. Please try again later.',
        ]);
        exit();
    }
}
