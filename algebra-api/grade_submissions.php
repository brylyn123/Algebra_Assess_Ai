<?php
require_once 'cors.php';
require_once 'db_connection.php';

// Ensure table exists before querying.
$ensureTable = "
CREATE TABLE IF NOT EXISTS grade_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(200) NOT NULL,
    student_id VARCHAR(64) NOT NULL DEFAULT 'STU000',
    assessment_title VARCHAR(200) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    submission_date DATE NOT NULL,
    status ENUM('Pending','Graded','Needs Review') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if (!$conn->query($ensureTable)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to prepare grade submissions table: ' . $conn->error]);
    exit();
}

$countResult = $conn->query("SELECT COUNT(*) AS total FROM grade_submissions");
if ($countResult) {
    $row = $countResult->fetch_assoc();
    $countResult->free();
    if ((int)$row['total'] === 0) {
        $sampleData = [
            ['Sarah Johnson', 'STU001', 'Linear Equations Quiz', 'Algebra I - Period 3', '2026-03-06', 'Pending'],
            ['Michael Chen', 'STU002', 'Quadratic Functions Test', 'Algebra I - Period 3', '2026-03-05', 'Pending'],
            ['Emma Davis', 'STU003', 'Linear Equations Quiz', 'Algebra II - Period 1', '2026-03-04', 'Graded'],
        ];

        $stmt = $conn->prepare("INSERT INTO grade_submissions (student_name, student_id, assessment_title, subject, submission_date, status) VALUES (?, ?, ?, ?, ?, ?)");
        if ($stmt) {
            foreach ($sampleData as $entry) {
                [$student, $studentId, $assessment, $subject, $date, $status] = $entry;
                $stmt->bind_param('ssssss', $student, $studentId, $assessment, $subject, $date, $status);
                $stmt->execute();
            }
            $stmt->close();
        }
    }
} else {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to count grade submissions: ' . $conn->error]);
    exit();
}

$result = $conn->query(
    "SELECT id, student_name, student_id, assessment_title, subject,
            DATE_FORMAT(submission_date, '%b %e, %Y') AS submission_date,
            status
     FROM grade_submissions
     ORDER BY submission_date DESC, id DESC"
);

if (!$result) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load grade submissions: ' . $conn->error]);
    exit();
}

$submissions = [];
while ($row = $result->fetch_assoc()) {
    $submissions[] = $row;
}
$result->free();

echo json_encode([
    'status' => 'success',
    'submissions' => $submissions,
]);
