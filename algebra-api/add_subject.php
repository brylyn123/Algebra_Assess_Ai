<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php'; // Your XAMPP config

function ensureArchivedColumn($conn) {
    $columnCheck = $conn->query("SHOW COLUMNS FROM subject LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE subject ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

// 1. Get the data from React
$data = json_decode(file_get_contents("php://input"), true);

function generateJoinCode($length = 6) {
    $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= $characters[random_int(0, strlen($characters) - 1)];
    }
    return $code;
}

// 2. Extract and Validate
$subject_name = $data['subject_name'] ?? '';
$course       = $data['course'] ?? '';
$year         = $data['year'] ?? '';
$section      = $data['section'] ?? '';
$school_year  = $data['school_year'] ?? '';
$semester     = $data['semester'] ?? '';
$teacher_id   = $data['teacher_id'] ?? null;
$join_code    = trim($data['join_code'] ?? '');

if (empty($join_code)) {
    do {
        $join_code = generateJoinCode();
        $checkStmt = $conn->prepare("SELECT 1 FROM subject WHERE join_code = ? LIMIT 1");
        $checkStmt->bind_param("s", $join_code);
        $checkStmt->execute();
        $checkStmt->store_result();
        $exists = $checkStmt->num_rows > 0;
        $checkStmt->close();
    } while ($exists);
}

// Check if critical data is missing
if (empty($subject_name) || empty($teacher_id)) {
    echo json_encode(["status" => "error", "message" => "Subject name or Teacher ID missing."]);
    exit;
}

ensureArchivedColumn($conn);

// 3. Prepared Statement
try {
    // Note: seven string columns plus an integer teacher_id
$stmt = $conn->prepare("INSERT INTO subject (subject_name, course, year, section, school_year, semester, teacher_id, join_code, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)");

$stmt->bind_param("ssssssis", $subject_name, $course, $year, $section, $school_year, $semester, $teacher_id, $join_code);
    
    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success", 
                "message" => "Subject added!",
                "join_code" => $join_code,
                "school_year" => $school_year,
                "semester" => $semester
            ]); 
    } else {
        echo json_encode(["status" => "error", "message" => "Database error: " . $stmt->error]);
    }

    $stmt->close();
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Server error: " . $e->getMessage()]);
}

$conn->close();
?>
