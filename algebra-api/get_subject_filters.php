<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';

$teacher_id = $_GET['teacher_id'] ?? null;

if (!$teacher_id) {
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    $filters = [
        'school_years' => [],
        'years' => [],
        'sections' => [],
        'semesters' => []
    ];

    $queries = [
        'school_years' => "SELECT DISTINCT school_year FROM subject WHERE teacher_id = ? AND school_year <> '' ORDER BY school_year DESC",
        'years' => "SELECT DISTINCT year FROM subject WHERE teacher_id = ? AND year <> '' ORDER BY year",
        'sections' => "SELECT DISTINCT section FROM subject WHERE teacher_id = ? AND section <> '' ORDER BY section",
        'semesters' => "SELECT DISTINCT semester FROM subject WHERE teacher_id = ? AND semester <> '' ORDER BY semester"
    ];

    foreach ($queries as $key => $query) {
        $stmt = $conn->prepare($query);
        $stmt->bind_param("s", $teacher_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result) {
            while ($row = $result->fetch_array(MYSQLI_NUM)) {
                $value = $row[0];
                if ($value !== null && $value !== '') {
                    $filters[$key][] = $value;
                }
            }
        }
        $stmt->close();
    }

    echo json_encode(array_merge(['status' => 'success'], $filters));
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
