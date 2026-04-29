<?php
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this seed script from the command line only.\n");
    exit(1);
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/schema_utils.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn->set_charset('utf8mb4');

function executeSeed(mysqli $conn, string $sql, string $types = '', array $params = []): void
{
    $stmt = $conn->prepare($sql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $stmt->close();
}

function insertSeed(mysqli $conn, string $sql, string $types = '', array $params = []): int
{
    executeSeed($conn, $sql, $types, $params);
    return (int)$conn->insert_id;
}

function fetchSeedScalar(mysqli $conn, string $sql, string $types = '', array $params = [])
{
    $stmt = $conn->prepare($sql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_row() : null;
    $stmt->close();
    return $row[0] ?? null;
}

function buildSeedFilesJson(array $paths): string
{
    $files = [];
    foreach ($paths as $path) {
        $files[] = [
            'original_name' => basename($path),
            'file_path' => $path,
            'type' => 'image',
        ];
    }

    return json_encode(['files' => $files], JSON_UNESCAPED_SLASHES);
}

function seedFeedback(string $studentName, string $assessmentTitle, int $score): string
{
    return "{$studentName} received {$score}% in {$assessmentTitle}. Review the final simplification and keep steps clear.";
}

try {
    $conn->begin_transaction();

    ensureAssessmentRubricColumn($conn);
    ensureScoreAiFeedbackColumn($conn);
    ensureScoreMetricsColumns($conn);
    ensureScoreReturnColumn($conn);
    ensureRegistrationLookupData($conn);

    $courseId = (int)fetchSeedScalar($conn, "SELECT course_id FROM Course WHERE course_code = 'BSMATH' LIMIT 1");
    $sectionId = (int)fetchSeedScalar($conn, "SELECT section_id FROM Section WHERE section_name = 'Section A' LIMIT 1");
    $yearId = (int)fetchSeedScalar($conn, "SELECT year_id FROM Year_Level WHERE year_level = 'Year 3' LIMIT 1");
    $collegeId = (int)fetchSeedScalar($conn, "SELECT college_id FROM Colleges WHERE college_name = 'College of Sciences' LIMIT 1");

    executeSeed($conn, "DELETE FROM Item_Scores");
    executeSeed($conn, "DELETE FROM Scores");
    executeSeed($conn, "DELETE FROM Captured_Solution");
    executeSeed($conn, "DELETE FROM item_rubric_mapping");
    executeSeed($conn, "DELETE FROM rubric_set_items");
    executeSeed($conn, "DELETE FROM Exercises_Problem");
    executeSeed($conn, "DELETE FROM rubric_sets");
    executeSeed($conn, "DELETE FROM Enrollment");
    executeSeed($conn, "DELETE FROM Subject");
    executeSeed($conn, "DELETE FROM Users WHERE email LIKE 'demo.%@algebra.local'");

    $teacherUserId = insertSeed(
        $conn,
        "INSERT INTO Users (
            institutional_id,
            first_name,
            middle_name,
            last_name,
            email,
            password,
            college_id,
            role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'teacher')",
        'ssssssi',
        [
            'T-1001',
            'Alicia',
            'Mae',
            'Santos',
            'demo.teacher@algebra.local',
            password_hash('DemoTeacher123!', PASSWORD_DEFAULT),
            $collegeId,
        ]
    );

    $studentSeeds = [
        ['S-2001', 'Mia', 'R.', 'Cruz', 'demo.student@algebra.local'],
        ['S-2002', 'Jasper', 'L.', 'Reyes', 'demo.student02@algebra.local'],
        ['S-2003', 'Luna', 'P.', 'Torres', 'demo.student03@algebra.local'],
        ['S-2004', 'Noah', 'A.', 'Santos', 'demo.student04@algebra.local'],
    ];

    $students = [];
    foreach ($studentSeeds as [$institutionalId, $firstName, $middleName, $lastName, $email]) {
        $studentUserId = insertSeed(
            $conn,
            "INSERT INTO Users (
                institutional_id,
                first_name,
                middle_name,
                last_name,
                email,
                password,
                college_id,
                course_id,
                section_id,
                year_id,
                role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student')",
            'ssssssiiii',
            [
                $institutionalId,
                $firstName,
                $middleName,
                $lastName,
                $email,
                password_hash('DemoStudent123!', PASSWORD_DEFAULT),
                $collegeId,
                $courseId,
                $sectionId,
                $yearId,
            ]
        );

        $students[] = [
            'user_id' => $studentUserId,
            'institutional_id' => $institutionalId,
            'name' => trim("{$firstName} {$middleName} {$lastName}"),
            'email' => $email,
        ];
    }

    $subjectId = insertSeed(
        $conn,
        "INSERT INTO Subject (
            teacher_user_id,
            course_id,
            section_id,
            year_id,
            subject_name,
            subject_code,
            semester,
            school_year,
            join_code,
            archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        'iiiisssss',
        [
            $teacherUserId,
            $courseId,
            $sectionId,
            $yearId,
            'College Algebra Demo',
            'ALG-DEMO',
            '1st Semester',
            '2025-2026',
            'DEMO42',
        ]
    );

    foreach ($students as $student) {
        executeSeed(
            $conn,
            "INSERT INTO Enrollment (student_user_id, subject_id, enrollment_status) VALUES (?, ?, 'enrolled')",
            'ii',
            [$student['user_id'], $subjectId]
        );
    }

    $rubricSetId = insertSeed(
        $conn,
        "INSERT INTO rubric_sets (teacher_user_id, rubric_name, criteria, ai_instructions)
         VALUES (?, ?, ?, ?)",
        'isss',
        [
            $teacherUserId,
            'Demo Algebra Rubric',
            'Score setup accuracy, algebraic process, and clarity of the final answer.',
            'Use short constructive feedback and keep grading aligned with the item score totals.',
        ]
    );

    $rubricItems = [
        ['Correct setup', 4.0],
        ['Valid algebraic steps', 3.0],
        ['Clear final answer', 3.0],
    ];
    foreach ($rubricItems as [$description, $points]) {
        executeSeed(
            $conn,
            "INSERT INTO rubric_set_items (rubric_set_id, description, points) VALUES (?, ?, ?)",
            'isd',
            [$rubricSetId, $description, $points]
        );
    }

    $exerciseId = insertSeed(
        $conn,
        "INSERT INTO Exercises_Problem (subject_id, rubric_set_id, title, description, topic, difficulty)
         VALUES (?, ?, ?, ?, ?, ?)",
        'iissss',
        [
            $subjectId,
            $rubricSetId,
            'Linear Equations Practice Set',
            'Solve and justify multi-step linear equations.',
            'Equation solving',
            'Medium',
        ]
    );

    $exerciseItems = [
        [1, 'Solve 3x + 7 = 25 and show your steps.', 'x = 6', 5.0],
        [2, 'Solve 2(x - 4) = 10 and justify the final answer.', 'x = 9', 5.0],
    ];
    $itemIds = [];
    foreach ($exerciseItems as [$itemNo, $questionContent, $modelSolution, $maxScore]) {
        $itemId = insertSeed(
            $conn,
            "INSERT INTO Exercise_Items (exercise_id, item_no, question_type, question_content, model_solution, max_score)
             VALUES (?, ?, 'handwritten_algebra', ?, ?, ?)",
            'iissd',
            [$exerciseId, $itemNo, $questionContent, $modelSolution, $maxScore]
        );
        $itemIds[] = ['item_id' => $itemId, 'item_no' => $itemNo, 'max_score' => $maxScore];
        executeSeed(
            $conn,
            "INSERT INTO item_rubric_mapping (item_id, rubric_set_id) VALUES (?, ?)",
            'ii',
            [$itemId, $rubricSetId]
        );
    }

    $samplePaths = [
        'uploads/captured_solutions/demo_submission_1.jpg',
        'uploads/captured_solutions/demo_submission_2.jpg',
    ];

    $returnedCount = 0;
    foreach ($students as $index => $student) {
        $scorePercent = 82 + ($index * 4);
        $rawScore = round(($scorePercent / 100) * 10, 2);
        $uploadedAt = (new DateTimeImmutable('2026-03-01 08:00:00'))
            ->modify("+{$index} day")
            ->format('Y-m-d H:i:s');
        $returnedAt = (new DateTimeImmutable($uploadedAt))
            ->modify('+8 hours')
            ->format('Y-m-d H:i:s');

        $solutionId = insertSeed(
            $conn,
            "INSERT INTO Captured_Solution (
                exercise_id,
                student_user_id,
                file_path,
                ocr_text,
                ai_status,
                ai_raw_json,
                date_uploaded
            ) VALUES (?, ?, ?, ?, 'completed', ?, ?)",
            'iissss',
            [
                $exerciseId,
                $student['user_id'],
                $samplePaths[$index % count($samplePaths)],
                "OCR text for {$student['name']} solving the demo assessment.",
                buildSeedFilesJson([$samplePaths[$index % count($samplePaths)]]),
                $uploadedAt,
            ]
        );

        executeSeed(
            $conn,
            "INSERT INTO Scores (
                solution_id,
                total_score_earned,
                raw_score_earned,
                max_score_possible,
                ai_feedback,
                date_scored,
                returned_at
            ) VALUES (?, ?, ?, 10.00, ?, ?, ?)",
            'iddsss',
            [
                $solutionId,
                (float)$scorePercent,
                $rawScore,
                seedFeedback($student['name'], 'Linear Equations Practice Set', $scorePercent),
                $returnedAt,
                $returnedAt,
            ]
        );

        foreach ($itemIds as $itemIndex => $item) {
            $itemScore = $itemIndex === 0 ? min(5.0, round($rawScore / 2 + 0.5, 2)) : max(0.0, round($rawScore - min(5.0, round($rawScore / 2 + 0.5, 2)), 2));
            executeSeed(
                $conn,
                "INSERT INTO Item_Scores (solution_id, item_id, score_earned, ai_feedback, is_manual_override)
                 VALUES (?, ?, ?, ?, 0)",
                'iids',
                [
                    $solutionId,
                    $item['item_id'],
                    $itemScore,
                    "Item {$item['item_no']} feedback for {$student['name']}.",
                ]
            );
        }

        $returnedCount++;
    }

    $conn->commit();

    echo "Demo data seeded successfully.\n";
    echo "Teacher: demo.teacher@algebra.local / DemoTeacher123!\n";
    echo "Student: demo.student@algebra.local / DemoStudent123!\n";
    echo "Students: " . count($students) . "\n";
    echo "Returned submissions: {$returnedCount}\n";
} catch (Throwable $e) {
    if ($conn->in_transaction) {
        $conn->rollback();
    }
    fwrite(STDERR, "Seed failed: " . $e->getMessage() . "\n");
    exit(1);
}

$conn->close();
