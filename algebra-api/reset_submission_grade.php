<?php
require_once 'cors.php';
require_once 'db_connect.php';

header('Content-Type: application/json');

$teacher_id = isset($_GET['teacher_id']) ? (int)$_GET['teacher_id'] : 0;
$exercise_id = isset($_GET['exercise_id']) ? (int)$_GET['exercise_id'] : 0;

if (!$teacher_id || !$exercise_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'teacher_id and exercise_id are required.']);
    exit();
}

try {
    // Verify teacher owns this exercise
    $checkStmt = $conn->prepare(
        "SELECT ep.exercise_id
         FROM Exercises_Problem ep
         INNER JOIN Subject s ON s.subject_id = ep.subject_id
         WHERE ep.exercise_id = ? AND s.teacher_user_id = ?"
    );
    $checkStmt->bind_param('ii', $exercise_id, $teacher_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $exists = $checkResult->fetch_assoc();
    $checkStmt->close();

    if (!$exists) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Exercise not found or not owned by this teacher.']);
        exit();
    }

    // Find all solution_ids for this exercise
    $findStmt = $conn->prepare(
        "SELECT solution_id FROM Captured_Solution WHERE exercise_id = ?"
    );
    $findStmt->bind_param('i', $exercise_id);
    $findStmt->execute();
    $findResult = $findStmt->get_result();
    $solutionIds = [];
    while ($row = $findResult->fetch_assoc()) {
        $solutionIds[] = (int)$row['solution_id'];
    }
    $findStmt->close();

    if (count($solutionIds) === 0) {
        echo json_encode([
            'status' => 'success',
            'message' => "No submissions found for exercise #{$exercise_id}.",
            'reset' => 0,
        ]);
        exit();
    }

    $placeholders = implode(',', array_fill(0, count($solutionIds), '?'));
    $types = str_repeat('i', count($solutionIds));

    // Delete Item_Scores
    $delItem = $conn->prepare("DELETE FROM Item_Scores WHERE solution_id IN ($placeholders)");
    $delItem->bind_param($types, ...$solutionIds);
    $delItem->execute();
    $itemDeleted = $delItem->affected_rows;
    $delItem->close();

    // Delete Scores
    $delScore = $conn->prepare("DELETE FROM Scores WHERE solution_id IN ($placeholders)");
    $delScore->bind_param($types, ...$solutionIds);
    $delScore->execute();
    $scoreDeleted = $delScore->affected_rows;
    $delScore->close();

    // Reset Captured_Solution - also clear ocr_text so OCR can be re-run with better provider
    $resetStmt = $conn->prepare(
        "UPDATE Captured_Solution
         SET ai_status = 'pending',
             ai_raw_json = NULL,
             ocr_text = NULL
         WHERE solution_id IN ($placeholders)"
    );
    $resetStmt->bind_param($types, ...$solutionIds);
    $resetStmt->execute();
    $resetCount = $resetStmt->affected_rows;
    $resetStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => "Reset complete for exercise #{$exercise_id}.",
        'exercise_id' => $exercise_id,
        'solutions_reset' => count($solutionIds),
        'scores_deleted' => $scoreDeleted,
        'item_scores_deleted' => $itemDeleted,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to reset submission grade.']);
}

$conn->close();
?>
