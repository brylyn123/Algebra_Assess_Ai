<?php
require __DIR__ . '/db_connect.php';
require __DIR__ . '/ai_config.php';

$config = getAiConfig();
echo "DeepSeek Model: {$config['model']}\n";
echo "Base URL: {$config['base_url']}\n";

// Check submission 29
$result = $conn->query("SELECT solution_id, exercise_id, ai_status, LENGTH(ocr_text) as ocr_len, ai_raw_json FROM Captured_Solution WHERE solution_id = 29");
if ($row = $result->fetch_assoc()) {
    echo "\n=== Submission 29 ===\n";
    echo "ai_status: {$row['ai_status']}\n";
    echo "ocr_len: {$row['ocr_len']}\n";
    $existing = json_decode($row['ai_raw_json'] ?? '{}', true);
    if (isset($existing['grading_draft']['raw_response'])) {
        $raw = $existing['grading_draft']['raw_response'];
        echo "Existing raw_response length: " . strlen($raw) . "\n";
        echo "Existing raw_response (first 500): " . substr($raw, 0, 500) . "\n";
    }
    echo "ocr_preview: " . substr($row['ocr_text'], 0, 1000) . "\n";
}
$result->close();

// Check exercise 28
$result2 = $conn->query("SELECT exercise_id, title, rubric_set_id FROM Exercises_Problem WHERE exercise_id = 28");
if ($row2 = $result2->fetch_assoc()) {
    echo "\n=== Exercise 28 ===\n";
    echo "title: {$row2['title']}\n";
    echo "rubric_set_id: {$row2['rubric_set_id']}\n";
}
$result2->close();

// Check exercise items for exercise 28
$result3 = $conn->query("SELECT item_id, item_no, question_content, rubric_set_id, rubric_id FROM Exercise_Items WHERE exercise_id = 28 ORDER BY item_no");
echo "\n=== Exercise Items for Exercise 28 ===\n";
if ($result3) {
    while ($row3 = $result3->fetch_assoc()) {
        echo "item_no: {$row3['item_no']}, rubric_set_id: " . ($row3['rubric_set_id'] ?? 'NULL') . ", rubric_id: " . ($row3['rubric_id'] ?? 'NULL') . ", question: " . substr($row3['question_content'], 0, 80) . "\n";
    }
    $result3->close();
}

$conn->close();
