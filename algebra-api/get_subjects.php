<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
include 'db_connect.php';

function ensureArchivedColumn($conn) {
    $columnCheck = $conn->query("SHOW COLUMNS FROM subject LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE subject ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

// Get the teacher_id from the URL (e.g., get_subjects.php?teacher_id=809218)
$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "No teacher ID provided"]);
    exit;
}

try {
    ensureArchivedColumn($conn);
    // Select subjects for this specific teacher
    $stmt = $conn->prepare("SELECT * FROM subject WHERE teacher_id = ? AND archived = 0 ORDER BY subject_id DESC");
    $stmt->bind_param("s", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $subjects = $result->fetch_all(MYSQLI_ASSOC);
    echo json_encode($subjects);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
