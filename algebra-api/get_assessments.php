<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;

if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    $stmt = $conn->prepare(
        "SELECT ep.exercise_id, ep.title, ep.description, ep.topic, ep.date_created, s.subject_name
         FROM exercises_problem ep
         INNER JOIN subject s ON ep.subject_id = s.subject_id
         WHERE s.teacher_id = ?
         ORDER BY ep.date_created DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $assessments = [];
    while ($row = $result->fetch_assoc()) {
        $assessments[] = [
            "exercise_id" => (int)$row["exercise_id"],
            "title" => $row["title"],
            "description" => $row["description"],
            "topic" => $row["topic"],
            "subject" => $row["subject_name"],
            "date_created" => $row["date_created"],
        ];
    }

    $stmt->close();
    echo json_encode(["status" => "success", "assessments" => $assessments]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
