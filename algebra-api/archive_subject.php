<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

function ensureArchivedColumn($conn) {
    $columnCheck = $conn->query("SHOW COLUMNS FROM subject LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE subject ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

$data = json_decode(file_get_contents("php://input"), true);

$subject_id = $data['subject_id'] ?? null;
$teacher_id = $data['teacher_id'] ?? null;

if (!$subject_id || !$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Subject ID and teacher ID are required."]);
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

    ensureArchivedColumn($conn);
    $conn->begin_transaction();

    $stmt = $conn->prepare(
        "INSERT INTO {$archiveTable} (subject_id, teacher_id, subject_name, course, year, section, school_year, semester, join_code)
         SELECT subject_id, teacher_id, subject_name, course, year, section, school_year, semester, join_code
         FROM subject
         WHERE subject_id = ? AND teacher_id = ?"
    );
    $stmt->bind_param("ii", $subject_id, $teacher_id);

    if ($stmt->execute()) {
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        $updateStmt = $conn->prepare("UPDATE subject SET archived = 1 WHERE subject_id = ? AND teacher_id = ?");
        $updateStmt->bind_param("ii", $subject_id, $teacher_id);
        $updateStmt->execute();
        $updateStmt->close();

        $conn->commit();

        if ($affectedRows === 0) {
            echo json_encode(["status" => "error", "message" => "No matching subject found."]);
        } else {
            echo json_encode(["status" => "success", "message" => "Subject archived."]);
        }
        return;
    }
    $stmt->close();

    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Archive failed: " . $stmt->error]);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Server error: " . $e->getMessage()]);
}

$conn->close();
?>
