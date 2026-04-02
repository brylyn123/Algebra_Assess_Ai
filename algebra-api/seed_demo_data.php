<?php
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this seed script from the command line only.\n");
    exit(1);
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/schema_utils.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn->set_charset('utf8mb4');

ensureAssessmentRubricColumn($conn);
ensureScoreAiFeedbackColumn($conn);
ensureStudentProfileColumns($conn);
ensureRegistrationLookupData($conn);

$demoTeacherEmail = 'demo.teacher@algebra.local';
$demoStudentEmail = 'demo.student@algebra.local';
$demoTeacherPassword = 'DemoTeacher123!';
$demoStudentPassword = 'DemoStudent123!';
$teacherNames = [
    ['Alicia', 'Mae', 'Santos'],
    ['Daniel', 'J.', 'Cruz'],
    ['Mara', 'Lynn', 'Reyes'],
    ['Noel', 'P.', 'Gomez'],
    ['Isabella', 'R.', 'Torres'],
];
$teacherName = $teacherNames[random_int(0, count($teacherNames) - 1)];
$demoTeacherUsername = $demoTeacherEmail;
$studentEmailPrefix = 'demo.student';
$demoCourseName = 'BS Mathematics';
$demoSection = 'Section A';
$demoSemester = '1st Semester';
$demoSchoolYear = '2025-2026';
$demoSubjectPrefix = 'DEMO-ALG-';
$demoJoinPrefix = 'DEMO-JOIN-';
$baseDate = new DateTimeImmutable('2026-03-01 08:00:00');
$imageA = 'uploads/captured_solutions/student_123456_exercise_4_69c2c6edac7025.94804699_0.jpg';
$imageB = 'uploads/captured_solutions/student_123456_exercise_5_69c62f2ac0bf22.15995304_0.jpg';
$subjectPool = [
    ['name' => 'Linear Equations', 'description' => 'Solve and interpret one-variable and two-variable equations.'],
    ['name' => 'Quadratic Functions', 'description' => 'Analyze parabolas, roots, and vertex behavior.'],
    ['name' => 'Polynomial Expressions', 'description' => 'Expand, factor, and simplify polynomial expressions.'],
    ['name' => 'Rational Expressions', 'description' => 'Simplify and operate on rational expressions.'],
    ['name' => 'Systems of Equations', 'description' => 'Solve systems using algebraic and graphical methods.'],
    ['name' => 'Function Analysis', 'description' => 'Interpret domain, range, and transformations.'],
    ['name' => 'Inequalities', 'description' => 'Solve and graph linear and compound inequalities.'],
    ['name' => 'Exponents and Radicals', 'description' => 'Work with exponent rules and radical expressions.'],
    ['name' => 'Sequences and Series', 'description' => 'Identify patterns and compute terms in sequences.'],
    ['name' => 'Matrices and Determinants', 'description' => 'Perform matrix operations and determinant calculations.'],
];
$assessmentTitlePool = [
    'Diagnostic Quiz',
    'Practice Set',
    'Problem Set',
    'Mid-Unit Check',
    'Challenge Quiz',
    'Applied Task',
    'Mixed Review',
    'Reflection Exercise',
    'Cumulative Check',
    'Final Review',
    'Skill Sprint',
    'Concept Check',
    'Performance Task',
    'Independent Work',
];
$studentFirstNames = [
    'Jasper',
    'Mia',
    'Ethan',
    'Sofia',
    'Liam',
    'Ava',
    'Noah',
    'Luna',
    'Caleb',
    'Zoe',
    'Harper',
    'Miles',
    'Camila',
    'Julian',
];
$studentMiddleNames = [
    'A.',
    'B.',
    'C.',
    'D.',
    'E.',
    'F.',
    'G.',
    'H.',
];
$studentLastNames = [
    'Delgado',
    'Castillo',
    'Navarro',
    'Mendoza',
    'Fernandez',
    'Ramos',
    'Salazar',
    'Vargas',
    'Torres',
    'Morales',
    'Santos',
    'Reyes',
    'Guzman',
    'Cruz',
];
$topicPool = [
    'Core skills',
    'Symbolic manipulation',
    'Equation solving',
    'Word problem reasoning',
    'Graph interpretation',
    'Functions and mapping',
    'Factoring',
    'Transformations',
    'Mixed practice',
    'Summative review',
];
$aiFeedbackOpeners = [
    'AI review for %s in %s suggests',
    'Model analysis for %s under %s indicates',
    'Automated feedback for %s in %s shows',
    'AI scoring for %s in %s finds',
    'Draft review for %s in %s notes',
];
$teacherFeedbackOpeners = [
    'Reviewed and returned for %s in %s.',
    'Final check for %s under %s is complete.',
    'Teacher review for %s in %s is complete.',
    'Returned after review for %s in %s.',
    'Finalized result for %s under %s.',
];

function pickRandom(array $values)
{
    return $values[random_int(0, count($values) - 1)];
}

function pickUniqueRandom(array $values, int $count): array
{
    $pool = array_values($values);
    shuffle($pool);
    return array_slice($pool, 0, min($count, count($pool)));
}

function buildStudentRoster(
    string $primaryEmail,
    string $emailPrefix,
    int $count,
    array $firstNames,
    array $middleNames,
    array $lastNames
): array {
    $combinations = [];

    foreach ($firstNames as $firstName) {
        foreach ($middleNames as $middleName) {
            foreach ($lastNames as $lastName) {
                $combinations[] = [$firstName, $middleName, $lastName];
            }
        }
    }

    shuffle($combinations);
    if ($count > count($combinations)) {
        throw new RuntimeException('Not enough unique student name combinations for the requested roster size.');
    }

    $roster = [];
    for ($index = 0; $index < $count; $index += 1) {
        $name = $combinations[$index];
        $email = $index === 0
            ? $primaryEmail
            : sprintf('%s%02d@algebra.local', $emailPrefix, $index + 1);

        $roster[] = [
            'first_name' => $name[0],
            'middle_name' => $name[1],
            'last_name' => $name[2],
            'email' => $email,
        ];
    }

    return $roster;
}

function fetchScalar(mysqli $conn, string $sql, string $types = '', array $params = [])
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

function fetchColumnValues(mysqli $conn, string $sql, string $types = '', array $params = []): array
{
    $stmt = $conn->prepare($sql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $values = [];
    while ($row = $result->fetch_row()) {
        $values[] = $row[0];
    }
    $stmt->close();
    return $values;
}

function executeStatement(mysqli $conn, string $sql, string $types = '', array $params = []): void
{
    $stmt = $conn->prepare($sql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $stmt->close();
}

function tableHasColumn(mysqli $conn, string $table, string $column): bool
{
    $escapedColumn = $conn->real_escape_string($column);
    foreach (array_unique([$table, strtolower($table), strtoupper($table)]) as $candidate) {
        $result = $conn->query("SHOW COLUMNS FROM {$candidate} LIKE '{$escapedColumn}'");
        $exists = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }
        if ($exists) {
            return true;
        }
    }
    return false;
}

function tableExists(mysqli $conn, string $table): bool
{
    foreach (array_unique([$table, strtolower($table), strtoupper($table)]) as $candidate) {
        $escapedTable = $conn->real_escape_string($candidate);
        $result = $conn->query("SHOW TABLES LIKE '{$escapedTable}'");
        $exists = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }
        if ($exists) {
            return true;
        }
    }
    return false;
}

function insertAndGetId(mysqli $conn, string $sql, string $types = '', array $params = []): int
{
    executeStatement($conn, $sql, $types, $params);
    return (int)$conn->insert_id;
}

function deleteByIds(mysqli $conn, string $table, string $column, array $ids): void
{
    if (!tableExists($conn, $table)) {
        return;
    }

    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (count($ids) === 0) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));
    executeStatement($conn, "DELETE FROM {$table} WHERE {$column} IN ({$placeholders})", $types, $ids);
}

function getOrCreateCollegeIdLocal(mysqli $conn, string $tableName, string $name): int
{
    $existing = fetchScalar($conn, "SELECT college_id FROM {$tableName} WHERE college_name = ? LIMIT 1", 's', [$name]);
    if ($existing !== null) {
        return (int)$existing;
    }

    return insertAndGetId($conn, "INSERT INTO {$tableName} (college_name) VALUES (?)", 's', [$name]);
}

function getOrCreateLookupId(mysqli $conn, string $table, string $idColumn, string $nameColumn, string $name): int
{
    $existing = fetchScalar(
        $conn,
        "SELECT {$idColumn} FROM {$table} WHERE {$nameColumn} = ? LIMIT 1",
        's',
        [$name]
    );
    if ($existing !== null) {
        return (int)$existing;
    }

    return insertAndGetId($conn, "INSERT INTO {$table} ({$nameColumn}) VALUES (?)", 's', [$name]);
}

function getOrCreateCourseId(mysqli $conn, string $tableName, string $courseName, string $courseCode): int
{
    $existing = fetchScalar(
        $conn,
        "SELECT course_id FROM {$tableName} WHERE course_code = ? LIMIT 1",
        's',
        [$courseCode]
    );
    if ($existing !== null) {
        return (int)$existing;
    }

    return insertAndGetId(
        $conn,
        "INSERT INTO {$tableName} (course_name, course_code) VALUES (?, ?)",
        'ss',
        [$courseName, $courseCode]
    );
}

function buildFilesJson(array $paths): string
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

function buildAssessmentItems(string $subjectName, string $assessmentTitle): array
{
    return [
        [
            'item_no' => 1,
            'question_type' => 'handwritten_algebra',
            'question_content' => "Solve the core problem set for {$assessmentTitle} under {$subjectName}.",
            'options' => null,
            'max_score' => 5.0,
        ],
        [
            'item_no' => 2,
            'question_type' => 'handwritten_algebra',
            'question_content' => "Explain your steps and justify the answer for {$assessmentTitle} under {$subjectName}.",
            'options' => null,
            'max_score' => 5.0,
        ],
    ];
}

function generatedAiFeedback(string $subjectName, string $assessmentTitle, int $score): string
{
    global $aiFeedbackOpeners;

    $descriptor = pickRandom([
        'a strong grasp of the core steps',
        'good structure with room for cleaner notation',
        'solid reasoning and mostly accurate algebra',
        'clear progress with a few simplification slips',
        'careful work that needs a final accuracy check',
    ]);
    $nextStep = pickRandom([
        'Focus on presenting each transformation more explicitly.',
        'Double-check the final arithmetic before submitting.',
        'Keep your line-by-line reasoning visible on the page.',
        'Work on tightening the last simplification step.',
        'Use clearer annotations for multi-step responses.',
    ]);

    $opener = sprintf(pickRandom($aiFeedbackOpeners), $assessmentTitle, $subjectName);

    return sprintf(
        '%s %s. Estimated score: %d%%. %s',
        $opener,
        $descriptor,
        $score,
        $nextStep
    );
}

function teacherFeedback(string $subjectName, string $assessmentTitle, int $score): string
{
    global $teacherFeedbackOpeners;

    $strength = pickRandom([
        'You handled the algebraic setup well.',
        'Your reasoning is mostly correct and easy to follow.',
        'Good effort on the problem-solving process.',
        'The solution shows steady understanding of the topic.',
        'You showed good command of the core method.',
    ]);
    $improvement = pickRandom([
        'Keep showing each step more clearly on the page.',
        'Watch for sign errors in the final step.',
        'A little more notation detail would improve the work.',
        'Be careful with the last simplification.',
        'Check the final answer format before returning it.',
    ]);

    $opener = sprintf(pickRandom($teacherFeedbackOpeners), $assessmentTitle, $subjectName);

    return sprintf(
        '%s Final score: %d%%. %s %s',
        $opener,
        $score,
        $strength,
        $improvement
    );
}

function buildItemFeedback(string $subjectName, string $assessmentTitle, int $itemNumber, float $scoreEarned, float $maxScore): string
{
    $status = $scoreEarned >= $maxScore
        ? 'Full credit earned.'
        : ($scoreEarned >= ($maxScore / 2) ? 'Partial credit awarded.' : 'Needs more work.');

    return sprintf(
        'Item %d feedback for %s in %s: %s',
        $itemNumber,
        $assessmentTitle,
        $subjectName,
        $status
    );
}

try {
    $conn->begin_transaction();

    $demoSubjectIds = fetchColumnValues(
        $conn,
        'SELECT subject_id FROM Subject WHERE join_code LIKE ?',
        's',
        [$demoJoinPrefix . '%']
    );
    $demoRubricIds = fetchColumnValues(
        $conn,
        'SELECT rubric_set_id FROM rubric_sets WHERE rubric_name LIKE ?',
        's',
        ['Demo Rubric %']
    );

    if (count($demoSubjectIds) > 0) {
        $exerciseIds = fetchColumnValues(
            $conn,
            'SELECT exercise_id FROM Exercises_Problem WHERE subject_id IN (' . implode(',', array_fill(0, count($demoSubjectIds), '?')) . ')',
            str_repeat('i', count($demoSubjectIds)),
            $demoSubjectIds
        );
        $solutionIds = count($exerciseIds) > 0
            ? fetchColumnValues(
                $conn,
                'SELECT solution_id FROM Captured_Solution WHERE exercise_id IN (' . implode(',', array_fill(0, count($exerciseIds), '?')) . ')',
                str_repeat('i', count($exerciseIds)),
                $exerciseIds
            )
            : [];

        deleteByIds($conn, 'Item_Scores', 'solution_id', $solutionIds);
        deleteByIds($conn, 'Scores', 'solution_id', $solutionIds);
        deleteByIds($conn, 'Captured_Solution', 'exercise_id', $exerciseIds);
        deleteByIds($conn, 'Exercise_Items', 'exercise_id', $exerciseIds);
        deleteByIds($conn, 'Enrollment', 'subject_id', $demoSubjectIds);
        deleteByIds($conn, 'Exercises_Problem', 'subject_id', $demoSubjectIds);
        deleteByIds($conn, 'item_rubric_mapping', 'rubric_set_id', $demoRubricIds);
        deleteByIds($conn, 'rubric_set_items', 'rubric_set_id', $demoRubricIds);
        deleteByIds($conn, 'rubric_sets', 'rubric_set_id', $demoRubricIds);
        deleteByIds($conn, 'Subject', 'subject_id', $demoSubjectIds);
    }

    $demoTeacherId = fetchScalar($conn, 'SELECT teacher_id FROM Teacher WHERE email = ? LIMIT 1', 's', [$demoTeacherEmail]);
    $demoTeacherUserId = fetchScalar($conn, 'SELECT user_id FROM Users WHERE email = ? LIMIT 1', 's', [$demoTeacherEmail]);
    $existingDemoStudentIds = fetchColumnValues($conn, 'SELECT student_id FROM Student WHERE email LIKE ?', 's', [$studentEmailPrefix . '%@algebra.local']);
    $existingDemoStudentUserIds = fetchColumnValues($conn, 'SELECT user_id FROM Users WHERE email LIKE ?', 's', [$studentEmailPrefix . '%@algebra.local']);

    if ($demoTeacherId !== null) {
        deleteByIds($conn, 'rubric_set_items', 'rubric_set_id', fetchColumnValues($conn, 'SELECT rubric_set_id FROM rubric_sets WHERE teacher_id = ?', 'i', [(int)$demoTeacherId]));
        deleteByIds($conn, 'item_rubric_mapping', 'rubric_set_id', fetchColumnValues($conn, 'SELECT rubric_set_id FROM rubric_sets WHERE teacher_id = ?', 'i', [(int)$demoTeacherId]));
        deleteByIds($conn, 'rubric_sets', 'rubric_set_id', fetchColumnValues($conn, 'SELECT rubric_set_id FROM rubric_sets WHERE teacher_id = ?', 'i', [(int)$demoTeacherId]));
    }

    deleteByIds($conn, 'Enrollment', 'student_id', $existingDemoStudentIds);
    deleteByIds($conn, 'Captured_Solution', 'student_id', $existingDemoStudentIds);

    executeStatement($conn, 'DELETE FROM student WHERE email LIKE ?', 's', [$studentEmailPrefix . '%@algebra.local']);
    executeStatement($conn, 'DELETE FROM users WHERE email LIKE ?', 's', [$studentEmailPrefix . '%@algebra.local']);

    if ($demoTeacherId !== null) {
        executeStatement($conn, 'DELETE FROM Teacher WHERE teacher_id = ?', 'i', [(int)$demoTeacherId]);
    }
    if ($demoTeacherUserId !== null) {
        executeStatement($conn, 'DELETE FROM Users WHERE user_id = ?', 'i', [(int)$demoTeacherUserId]);
    }
    executeStatement($conn, 'DELETE FROM teacher WHERE email = ?', 's', [$demoTeacherEmail]);
    executeStatement($conn, 'DELETE FROM users WHERE email = ?', 's', [$demoTeacherEmail]);
    deleteByIds($conn, 'Student', 'student_id', $existingDemoStudentIds);
    deleteByIds($conn, 'Users', 'user_id', $existingDemoStudentUserIds);

    $userHasUsername = tableHasColumn($conn, 'Users', 'username');
    if ($userHasUsername) {
        $teacherUserId = insertAndGetId(
            $conn,
            'INSERT INTO Users (username, email, password, role) VALUES (?, ?, ?, ?)',
            'ssss',
            [$demoTeacherUsername, $demoTeacherEmail, password_hash($demoTeacherPassword, PASSWORD_DEFAULT), 'teacher']
        );
    } else {
        $teacherUserId = insertAndGetId(
            $conn,
            'INSERT INTO Users (email, password, role) VALUES (?, ?, ?)',
            'sss',
            [$demoTeacherEmail, password_hash($demoTeacherPassword, PASSWORD_DEFAULT), 'teacher']
        );
    }

    $teacherId = insertAndGetId(
        $conn,
        'INSERT INTO Teacher (first_name, middle_name, last_name, email, college_id, user_id) VALUES (?, ?, ?, ?, NULL, ?)',
        'ssssi',
        [$teacherName[0], $teacherName[1], $teacherName[2], $demoTeacherEmail, $teacherUserId]
    );

    $studentRoster = buildStudentRoster(
        $demoStudentEmail,
        $studentEmailPrefix,
        100,
        $studentFirstNames,
        $studentMiddleNames,
        $studentLastNames
    );

    $students = [];
    foreach ($studentRoster as $index => $student) {
        $studentUserId = insertAndGetId(
            $conn,
            'INSERT INTO Users (email, password, role) VALUES (?, ?, ?)',
            'sss',
            [$student['email'], password_hash($demoStudentPassword, PASSWORD_DEFAULT), 'student']
        );

        $studentId = insertAndGetId(
            $conn,
            'INSERT INTO Student (first_name, middle_name, last_name, email, course_id, section_id, year_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            'ssssiiii',
            [$student['first_name'], $student['middle_name'], $student['last_name'], $student['email'], 3, 1, 3, $studentUserId]
        );

        $students[] = [
            'student_id' => $studentId,
            'email' => $student['email'],
            'name' => trim($student['first_name'] . ' ' . $student['middle_name'] . ' ' . $student['last_name']),
        ];
    }

    $subjects = [];
    foreach (pickUniqueRandom($subjectPool, 5) as $index => $subjectInfo) {
        $subjects[] = [
            'subject_name' => $subjectInfo['name'],
            'join_code' => $demoJoinPrefix . str_pad((string)($index + 1), 2, '0', STR_PAD_LEFT),
            'rubric_name' => 'Demo Rubric - ' . $subjectInfo['name'],
            'description' => $subjectInfo['description'],
        ];
    }

    $subjectRecordCount = 0;
    $returnedCount = 0;
    $pendingCount = 0;
    $assessmentCount = 0;

    foreach ($subjects as $subjectIndex => $subject) {
        $assessmentLabels = pickUniqueRandom($assessmentTitlePool, 10);
        $rubricId = insertAndGetId(
            $conn,
            'INSERT INTO rubric_sets (teacher_id, rubric_name, criteria, ai_instructions) VALUES (?, ?, ?, ?)',
            'isss',
            [
                $teacherId,
                $subject['rubric_name'],
                'Demo rubric for ' . $subject['subject_name'] . '. Score based on algebraic accuracy, reasoning, and presentation.',
                'Use the rubric to estimate the model score and draft feedback for each captured solution.'
            ]
        );

        foreach ([
            ['description' => 'Shows a correct setup and mostly accurate computation.', 'points' => 4.0],
            ['description' => 'Explains steps clearly and uses correct algebraic notation.', 'points' => 3.0],
            ['description' => 'Provides a final answer and a short justification.', 'points' => 3.0],
        ] as $rubricItem) {
            insertAndGetId(
                $conn,
                'INSERT INTO rubric_set_items (rubric_set_id, description, points) VALUES (?, ?, ?)',
                'isd',
                [$rubricId, $rubricItem['description'], $rubricItem['points']]
            );
        }

        $subjectId = insertAndGetId(
            $conn,
            'INSERT INTO Subject (teacher_id, course_id, section_id, year_id, subject_name, semester, school_year, join_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            'iiiissss',
            [
                $teacherId,
                3,
                1,
                3,
                $subject['subject_name'],
                $demoSemester,
                $demoSchoolYear,
                $subject['join_code'],
            ]
        );

        foreach ($students as $student) {
            executeStatement(
                $conn,
                'INSERT INTO Enrollment (student_id, subject_id) VALUES (?, ?)',
                'ii',
                [$student['student_id'], $subjectId]
            );
        }

        foreach ($assessmentLabels as $assessmentIndex => $assessmentLabel) {
            $assessmentCount++;
            $assessmentTitle = $subject['subject_name'] . ' - ' . $assessmentLabel . ' ' . str_pad((string)($assessmentIndex + 1), 2, '0', STR_PAD_LEFT);
            $topic = pickRandom($topicPool);
            $assessmentCreated = $baseDate->modify('+' . (($subjectIndex * 10) + $assessmentIndex) . ' days')->format('Y-m-d H:i:s');
            $isReturned = $assessmentIndex < 8;
            $solutionStatus = $isReturned ? 'completed' : ($assessmentIndex % 2 === 0 ? 'processing' : 'pending');
            $uploadedAt = $baseDate->modify('+' . (($subjectIndex * 10) + $assessmentIndex) . ' days +12 hours')->format('Y-m-d H:i:s');
            $scoreDate = $baseDate->modify('+' . (($subjectIndex * 10) + $assessmentIndex) . ' days +18 hours')->format('Y-m-d H:i:s');
            $chosenFiles = ($assessmentIndex % 3 === 0) ? [$imageA, $imageB] : [($assessmentIndex % 2 === 0 ? $imageA : $imageB)];
            $filePath = $chosenFiles[0];
            $rawJson = buildFilesJson($chosenFiles);

            $exerciseId = insertAndGetId(
                $conn,
                'INSERT INTO Exercises_Problem (subject_id, rubric_set_id, title, description, topic, date_created) VALUES (?, ?, ?, ?, ?, ?)',
                'iissss',
                [
                    $subjectId,
                    $rubricId,
                    $assessmentTitle,
                    'Demo assessment for ' . $subject['subject_name'] . '.',
                    $topic,
                    $assessmentCreated,
                ]
            );

            $createdItems = [];
            foreach (buildAssessmentItems($subject['subject_name'], $assessmentTitle) as $itemIndex => $item) {
                $itemId = insertAndGetId(
                    $conn,
                    'INSERT INTO Exercise_Items (exercise_id, item_no, question_type, question_content, options, max_score) VALUES (?, ?, ?, ?, NULL, ?)',
                    'iissd',
                    [
                        $exerciseId,
                        $item['item_no'],
                        $item['question_type'],
                        $item['question_content'],
                        $item['max_score'],
                    ]
                );

                $createdItems[] = [
                    'item_id' => $itemId,
                    'item_no' => (int)$item['item_no'],
                    'max_score' => (float)$item['max_score'],
                ];

                executeStatement(
                    $conn,
                    'INSERT INTO item_rubric_mapping (item_id, rubric_set_id) VALUES (?, ?)',
                    'ii',
                    [$itemId, $rubricId]
                );
            }

            foreach ($students as $studentIndex => $student) {
                $studentFilePath = (($studentIndex + $assessmentIndex) % 3 === 0) ? $imageA : $imageB;
                $studentRawJson = buildFilesJson([$studentFilePath]);
                $studentUploadedAt = $baseDate
                    ->modify('+' . (($subjectIndex * 300) + ($assessmentIndex * 10) + $studentIndex) . ' minutes')
                    ->format('Y-m-d H:i:s');

                $solutionId = insertAndGetId(
                    $conn,
                    'INSERT INTO Captured_Solution (exercise_id, student_id, file_path, ocr_text, ai_status, ai_raw_json, date_uploaded) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    'iisssss',
                    [
                        $exerciseId,
                        $student['student_id'],
                        $studentFilePath,
                        'OCR text for ' . $assessmentTitle . ' showing a full student solution.',
                        $solutionStatus,
                        $studentRawJson,
                        $studentUploadedAt,
                    ]
                );

                if ($isReturned) {
                    $aiScore = 72 + ((($subjectIndex * 9) + ($assessmentIndex * 3) + $studentIndex) % 25);
                    $teacherScore = min(100, $aiScore + (($assessmentIndex % 3) - 1));
                    $maxScorePossible = 10.0;
                    $rawScoreEarned = round(($teacherScore / 100) * $maxScorePossible, 2);
                    executeStatement(
                        $conn,
                        'INSERT INTO Scores (solution_id, total_score_earned, raw_score_earned, max_score_possible, ai_feedback, date_scored) VALUES (?, ?, ?, ?, ?, ?)',
                        'idddss',
                        [
                            $solutionId,
                            $teacherScore,
                            $rawScoreEarned,
                            $maxScorePossible,
                            teacherFeedback($subject['subject_name'], $assessmentTitle, $teacherScore),
                            $scoreDate,
                        ]
                    );

                    $itemCount = count($createdItems);
                    $remainingRawScore = $rawScoreEarned;
                    foreach ($createdItems as $createdItemIndex => $createdItem) {
                        $itemMaxScore = (float)$createdItem['max_score'];
                        if ($createdItemIndex === $itemCount - 1) {
                            $itemScoreEarned = max(0.0, min($itemMaxScore, round($remainingRawScore, 2)));
                        } else {
                            $suggestedScore = round($rawScoreEarned / max(1, $itemCount), 2);
                            $itemScoreEarned = max(0.0, min($itemMaxScore, $suggestedScore));
                            $remainingRawScore = round($remainingRawScore - $itemScoreEarned, 2);
                        }

                        executeStatement(
                            $conn,
                            'INSERT INTO Item_Scores (solution_id, item_id, score_earned, ai_feedback, is_manual_override) VALUES (?, ?, ?, ?, ?)',
                            'iidsi',
                            [
                                $solutionId,
                                $createdItem['item_id'],
                                $itemScoreEarned,
                                buildItemFeedback(
                                    $subject['subject_name'],
                                    $assessmentTitle,
                                    $createdItem['item_no'],
                                    $itemScoreEarned,
                                    $itemMaxScore
                                ),
                                0,
                            ]
                        );
                    }
                    $returnedCount++;
                } else {
                    $pendingCount++;
                }
                $subjectRecordCount++;
            }
        }
    }

    $conn->commit();

    echo "Demo data seeded successfully.\n";
    echo "Teacher name: {$teacherName[0]} {$teacherName[1]} {$teacherName[2]}\n";
    $primaryStudent = $students[0];
    echo "Student name: {$primaryStudent['name']}\n";
    echo "Teacher: {$demoTeacherEmail} / {$demoTeacherPassword}\n";
    echo "Student: {$demoStudentEmail} / {$demoStudentPassword}\n";
    echo "Class roster: " . count($students) . " students\n";
    echo "Subjects: " . count($subjects) . "\n";
    echo "Assessments: {$assessmentCount}\n";
    echo "Submissions: {$subjectRecordCount}\n";
    echo "Returned assessments: {$returnedCount}\n";
    echo "Pending submissions: {$pendingCount}\n";
} catch (Throwable $e) {
    $conn->rollback();
    fwrite(STDERR, "Seed failed: " . $e->getMessage() . "\n");
    exit(1);
}

$conn->close();
