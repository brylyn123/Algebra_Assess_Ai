<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

include 'db_connect.php';

$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    $candidateTables = ['archieve_subject', 'archive_subject', 'subject_archive'];
    $archiveTable = null;
    foreach ($candidateTables as $table) {
        $result = $conn->query("SHOW TABLES LIKE '{$table}'");
        if ($result && $result->num_rows > 0) {
            $archiveTable = $table;
            break;
        }
    }

    if (!$archiveTable) {
        throw new Exception('Archive table not found.');
    }

    $stmt = $conn->prepare("SELECT * FROM {$archiveTable} WHERE teacher_id = ? ORDER BY archived_at DESC");
    $stmt->bind_param("s", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $archived = $result->fetch_all(MYSQLI_ASSOC);
    echo json_encode($archived);
    $stmt->close();
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
