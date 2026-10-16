<?php
require 'algebra-api/ai_client.php';
require 'algebra-api/db_connect.php';
require 'algebra-api/schema_utils.php';

$conn = $conn ?? null;

$config = getAiConfig();

// Build a realistic grading prompt
$submission = [
    'ocr_text' => '[IMAGE_1]
1. 2x + 4 = 10
Solution:
1. 2x + 4 = 10
2x = 10 - 4
2x = 6
x = 3
2x + 4 = 10
2(3) + 4 = 10
6 + 4 = 10

2. 5x - 2 = 13
Solution:
2. 5x - 2 = 13
5x = 13 + 2
5x = 15
x = 3
5x - 2 = 13
5(3) - 2 = 13
15 - 2 = 13

[IMAGE_2]
3. x^2 - 5x + 6 = 0
Solution:
3. x^2 - 5x + 6 = 0
(x - 3)(x - 2) = 0
x^2 - 2x - 3x + 6 = 0
x^2 - 5x + 6 = 0

4. 2/x + 3/(x+1)
Solution:
2/x + 3/(x+1)
= 2(x+1)/(x(x+1)) + 3(x)/(x(x+1))
= 2(x+1) + 3(x) / x(x+1)
= 2x + 2 + 3x / x(x+1)
= 5x + 2 / x(x+1)
= 5x + 2 / x^2 + x

[IMAGE_3]
5. In 2018, a car was purchased for $32,000 and depreciate 20% per year. When will the car be worth $8,000?
Solution:
Given:
Car A = 32,000 ↓ 20% per year. (2018)
Car A = ? ∴ car A in x years

Solution:
32,000 x 0.20 = 6,400
Per year
Car A in 2018 = 32,000 - 6,400
Car A in 2019 = 25,600 - 6,400
Car A in 2020 = 19,200 - 6,400
Car A in 2021 = 12,800 - 6,400
Car A in 2022 =

6,400 ÷ 12 = 533.33
Per Month:
1 month = 12,800 - 533
2 month = 12,267 - 533
3 month = 11,734 - 533
4 month = 11,201 - 533
9 month = 8,003

533 x 9 = 4,797
12,800 - 4797 = 8,003

∴ Car A in 3 years and 9 months = 8,003 $ (Year 2021) + 9 month

6. College A is charging $40,000 tuition in 2019 and it is increasing at a continuous rate of 7% per year. College B charges $45,000 in 2019, but it is increasing at 4% per year. When will college A cost more than college B?
Solution:
Given: College A = 40,000 in 2019 ↑ 7% per year (0.07)
College B = 45,000 in 2019 ↑ 4% per year. (1 + 0.04)

Solution: College A (t) = College B (t)
40,000 (0.07t) = 45,000 (1 + 0.04t)
40,000 / 40,000 = 45,000 / 40,000 (1 + 0.04t)
0.07t = 1.125 (1.04t)
0.07t = 1.125 (1.04t)
1.125 = (1.04t) - 0.07t
1.125 = 0.97t
1.125 / 0.97 = 0.97t / 0.97
t = 1.125 / 0.97
t = 1.1597
t = 1.2 years',
    'items' => [
        ['item_no' => 1, 'question_content' => '2x + 4 = 10', 'max_score' => 5.0, 'rubric_set_id' => 5],
        ['item_no' => 2, 'question_content' => '5x - 2 = 13', 'max_score' => 5.0, 'rubric_set_id' => 5],
        ['item_no' => 3, 'question_content' => 'x^2 - 5x + 6 = 0', 'max_score' => 5.0, 'rubric_set_id' => 5],
        ['item_no' => 4, 'question_content' => '2/x + 3/(x+1)', 'max_score' => 5.0, 'rubric_set_id' => 5],
        ['item_no' => 5, 'question_content' => 'Car depreciation', 'max_score' => 5.0, 'rubric_set_id' => 6],
        ['item_no' => 6, 'question_content' => 'College tuition comparison', 'max_score' => 5.0, 'rubric_set_id' => 6],
    ],
    'assessment_title' => 'Quiz 14',
    'student_name' => 'Test Student',
];

$submission['items'] = [
    ['item_no' => 1, 'question_content' => '2x + 4 = 10', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 5, 'rubric_name' => 'Procedural Algebra', 'rubric_items' => [
        ['description' => 'Algebraic Process / Logical Steps', 'points' => 60, 'min_points' => 15],
        ['description' => 'Accuracy of Computation / Algebraic Operations', 'points' => 20, 'min_points' => 5],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
    ['item_no' => 2, 'question_content' => '5x - 2 = 13', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 5, 'rubric_name' => 'Procedural Algebra', 'rubric_items' => [
        ['description' => 'Algebraic Process / Logical Steps', 'points' => 60, 'min_points' => 15],
        ['description' => 'Accuracy of Computation / Algebraic Operations', 'points' => 20, 'min_points' => 5],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
    ['item_no' => 3, 'question_content' => 'x^2 - 5x + 6 = 0', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 5, 'rubric_name' => 'Procedural Algebra', 'rubric_items' => [
        ['description' => 'Algebraic Process / Logical Steps', 'points' => 60, 'min_points' => 15],
        ['description' => 'Accuracy of Computation / Algebraic Operations', 'points' => 20, 'min_points' => 5],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
    ['item_no' => 4, 'question_content' => '2/x + 3/(x+1)', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 5, 'rubric_name' => 'Procedural Algebra', 'rubric_items' => [
        ['description' => 'Algebraic Process / Logical Steps', 'points' => 60, 'min_points' => 15],
        ['description' => 'Accuracy of Computation / Algebraic Operations', 'points' => 20, 'min_points' => 5],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
    ['item_no' => 5, 'question_content' => 'Car depreciation', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 6, 'rubric_name' => 'Problem-Solving', 'rubric_items' => [
        ['description' => 'Understanding of the Problem', 'points' => 20, 'min_points' => 5],
        ['description' => 'Algebraic Method / Mathematical Model', 'points' => 20, 'min_points' => 5],
        ['description' => 'Solution Process, Computation and Completeness', 'points' => 40, 'min_points' => 10],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
    ['item_no' => 6, 'question_content' => 'College tuition comparison', 'max_score' => 5.0, 'rubric' => ['rubric_set_id' => 6, 'rubric_name' => 'Problem-Solving', 'rubric_items' => [
        ['description' => 'Understanding of the Problem', 'points' => 20, 'min_points' => 5],
        ['description' => 'Algebraic Method / Mathematical Model', 'points' => 20, 'min_points' => 5],
        ['description' => 'Solution Process, Computation and Completeness', 'points' => 40, 'min_points' => 10],
        ['description' => 'Final Answer', 'points' => 20, 'min_points' => 5],
    ]]],
];

echo "Testing grading request...\n";
try {
    $result = generateDeepSeekGrade($submission);
    echo "SUCCESS!\n";
    echo "Overall score: " . $result['overall_score'] . "\n";
    echo "Item scores count: " . count($result['item_scores']) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}