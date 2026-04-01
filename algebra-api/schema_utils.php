<?php
function getEnrollmentSubjectColumn(mysqli $conn): string {
    static $column = null;

    if ($column !== null) {
        return $column;
    }

    $preferred = 'subject_id';
    $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$preferred'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        $column = $preferred;
        return $column;
    }

    $fallback = 'offering_id';
    $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$fallback'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        $column = $fallback;
        return $column;
    }

    throw new Exception('Enrollment table is missing the subject identifier column.');
}

function resolveExistingTableName(mysqli $conn, array $candidates): string {
    static $cache = [];

    foreach ($candidates as $candidate) {
        if (isset($cache[$candidate])) {
            return $cache[$candidate];
        }
    }

    foreach ($candidates as $candidate) {
        $escaped = $conn->real_escape_string($candidate);
        $result = $conn->query("SHOW TABLES LIKE '{$escaped}'");
        if ($result && $result->num_rows > 0) {
            $result->free();
            $cache[$candidate] = $candidate;
            return $candidate;
        }
        if ($result) {
            $result->free();
        }
    }

    throw new Exception('Unable to find any of these tables: ' . implode(', ', $candidates));
}

function ensureAssessmentRubricColumn(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    $result = $conn->query("SHOW COLUMNS FROM Exercises_Problem LIKE 'rubric_set_id'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        return;
    }

    if ($result) {
        $result->free();
    }

    if (!$conn->query("ALTER TABLE Exercises_Problem ADD COLUMN rubric_set_id INT NULL AFTER subject_id")) {
        throw new Exception('Unable to add rubric support to assessments: ' . $conn->error);
    }
}

function ensureScoreAiFeedbackColumn(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    $result = $conn->query("SHOW COLUMNS FROM Scores LIKE 'ai_feedback'");
    $hasAiFeedback = $result && $result->num_rows > 0;
    if ($result) {
        $result->free();
    }

    if (!$hasAiFeedback) {
        if (!$conn->query("ALTER TABLE Scores ADD COLUMN ai_feedback TEXT NULL AFTER total_score_earned")) {
            throw new Exception('Unable to add AI feedback support to Scores: ' . $conn->error);
        }
    }

    $teacherFeedbackResult = $conn->query("SHOW COLUMNS FROM Scores LIKE 'teacher_feedback'");
    $hasTeacherFeedback = $teacherFeedbackResult && $teacherFeedbackResult->num_rows > 0;
    if ($teacherFeedbackResult) {
        $teacherFeedbackResult->free();
    }

    if ($hasTeacherFeedback) {
        if (
            !$conn->query(
                "UPDATE Scores
                 SET ai_feedback = teacher_feedback
                 WHERE teacher_feedback IS NOT NULL
                   AND TRIM(teacher_feedback) <> ''"
            )
        ) {
            throw new Exception('Unable to migrate teacher feedback into ai_feedback: ' . $conn->error);
        }

        if (!$conn->query("ALTER TABLE Scores DROP COLUMN teacher_feedback")) {
            throw new Exception('Unable to remove teacher_feedback from Scores: ' . $conn->error);
        }
    }
}

function ensureScoreMetricsColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    $rawScoreResult = $conn->query("SHOW COLUMNS FROM Scores LIKE 'raw_score_earned'");
    $hasRawScore = $rawScoreResult && $rawScoreResult->num_rows > 0;
    if ($rawScoreResult) {
        $rawScoreResult->free();
    }

    $maxScoreResult = $conn->query("SHOW COLUMNS FROM Scores LIKE 'max_score_possible'");
    $hasMaxScore = $maxScoreResult && $maxScoreResult->num_rows > 0;
    if ($maxScoreResult) {
        $maxScoreResult->free();
    }

    $alterStatements = [];
    if (!$hasRawScore) {
        $alterStatements[] = "ADD COLUMN raw_score_earned DECIMAL(10,2) NULL AFTER total_score_earned";
    }
    if (!$hasMaxScore) {
        $alterStatements[] = "ADD COLUMN max_score_possible DECIMAL(10,2) NULL AFTER raw_score_earned";
    }

    if (empty($alterStatements)) {
        return;
    }

    $sql = "ALTER TABLE Scores " . implode(', ', $alterStatements);
    if (!$conn->query($sql)) {
        throw new Exception('Unable to add score metric support to Scores: ' . $conn->error);
    }
}

function ensureStudentProfileColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    $studentTable = resolveExistingTableName($conn, ['Student', 'student']);
    $teacherTable = resolveExistingTableName($conn, ['Teacher', 'teacher']);
    ensureCollegeForeignKeyForTable($conn, $studentTable);
    ensureCollegeForeignKeyForTable($conn, $teacherTable);

    $columns = [
        'course_id' => "ALTER TABLE Student ADD COLUMN course_id INT NULL AFTER college_id",
        'section_id' => "ALTER TABLE Student ADD COLUMN section_id INT NULL AFTER course_id",
        'year_id' => "ALTER TABLE Student ADD COLUMN year_id INT NULL AFTER section_id",
    ];

    foreach ($columns as $column => $statement) {
        $result = $conn->query("SHOW COLUMNS FROM Student LIKE '$column'");
        if ($result && $result->num_rows > 0) {
            $result->free();
            continue;
        }

        if ($result) {
            $result->free();
        }

        if (!$conn->query($statement)) {
            throw new Exception("Unable to add $column to Student: " . $conn->error);
        }
    }

    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $fkChecks = [
        "student_college_fk" => "ALTER TABLE Student ADD CONSTRAINT student_college_fk FOREIGN KEY (college_id) REFERENCES {$collegeTable}(college_id)",
        "student_course_fk" => "ALTER TABLE Student ADD CONSTRAINT student_course_fk FOREIGN KEY (course_id) REFERENCES {$courseTable}(course_id)",
        "student_section_fk" => "ALTER TABLE Student ADD CONSTRAINT student_section_fk FOREIGN KEY (section_id) REFERENCES {$sectionTable}(section_id)",
        "student_year_fk" => "ALTER TABLE Student ADD CONSTRAINT student_year_fk FOREIGN KEY (year_id) REFERENCES {$yearTable}(year_id)",
    ];

    foreach ($fkChecks as $constraint => $statement) {
        $check = $conn->prepare(
            "SELECT CONSTRAINT_NAME
             FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'Student'
               AND CONSTRAINT_NAME = ?
             LIMIT 1"
        );
        $check->bind_param('s', $constraint);
        $check->execute();
        $result = $check->get_result();
        $exists = $result && $result->num_rows > 0;
        $check->close();

        if ($exists) {
            continue;
        }

        if (!$conn->query($statement)) {
            throw new Exception("Unable to add $constraint: " . $conn->error);
        }
    }
}

function ensureCollegeForeignKeyForTable(mysqli $conn, string $tableName): void {
    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);

    $constraintStmt = $conn->prepare(
        "SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND COLUMN_NAME = 'college_id'
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    $constraintStmt->bind_param('s', $tableName);
    $constraintStmt->execute();
    $constraintResult = $constraintStmt->get_result();
    $constraintStmt->close();

    $hasCorrectConstraint = false;
    $constraintsToDrop = [];

    if ($constraintResult) {
        while ($constraintRow = $constraintResult->fetch_assoc()) {
            $constraintName = preg_replace('/[^A-Za-z0-9_]/', '', (string)($constraintRow['CONSTRAINT_NAME'] ?? ''));
            $referencedTable = (string)($constraintRow['REFERENCED_TABLE_NAME'] ?? '');

            if ($constraintName === '') {
                continue;
            }

            if (strcasecmp($referencedTable, $collegeTable) === 0) {
                $hasCorrectConstraint = true;
                continue;
            }

            $constraintsToDrop[] = $constraintName;
        }
    }

    foreach (array_unique($constraintsToDrop) as $constraintName) {
        if (!$conn->query("ALTER TABLE {$tableName} DROP FOREIGN KEY {$constraintName}")) {
            throw new Exception("Unable to repair {$tableName}.college_id foreign key: " . $conn->error);
        }
    }

    $newConstraintName = strtolower($tableName) . '_college_fk';
    if (!$hasCorrectConstraint && !$conn->query("ALTER TABLE {$tableName} ADD CONSTRAINT {$newConstraintName} FOREIGN KEY (college_id) REFERENCES {$collegeTable}(college_id)")) {
        if (stripos($conn->error, 'Duplicate') === false) {
            throw new Exception("Unable to link {$tableName}.college_id to {$collegeTable}: " . $conn->error);
        }
    }
}

function ensureCourseCollegeForeignKey(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    ensureCollegeForeignKeyForTable($conn, $courseTable);
}

function ensureRegistrationLookupData(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureCourseCollegeForeignKey($conn);

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $courseValues = [
        ['BSCS', 'BSCS'],
        ['BSMATH', 'BSMATH'],
    ];
    foreach ($courseValues as [$name, $code]) {
        $stmt = $conn->prepare(
            "SELECT course_id FROM {$courseTable} WHERE course_name = ? OR course_code = ? LIMIT 1"
        );
        $stmt->bind_param('ss', $name, $code);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result && $result->num_rows > 0;
        $stmt->close();

        if (!$exists) {
            $insert = $conn->prepare(
                "INSERT IGNORE INTO {$courseTable} (course_name, course_code) VALUES (?, ?)"
            );
            $insert->bind_param('ss', $name, $code);
            $insert->execute();
            $insert->close();
        }
    }

    $yearValues = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];
    foreach ($yearValues as $value) {
        $stmt = $conn->prepare("SELECT year_id FROM {$yearTable} WHERE year_level = ? LIMIT 1");
        $stmt->bind_param('s', $value);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result && $result->num_rows > 0;
        $stmt->close();

        if (!$exists) {
            $insert = $conn->prepare("INSERT INTO {$yearTable} (year_level) VALUES (?)");
            $insert->bind_param('s', $value);
            $insert->execute();
            $insert->close();
        }
    }

    $sectionValues = ['Section A', 'Section B', 'Section C'];
    foreach ($sectionValues as $value) {
        $stmt = $conn->prepare("SELECT section_id FROM {$sectionTable} WHERE section_name = ? LIMIT 1");
        $stmt->bind_param('s', $value);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result && $result->num_rows > 0;
        $stmt->close();

        if (!$exists) {
            $insert = $conn->prepare("INSERT INTO {$sectionTable} (section_name) VALUES (?)");
            $insert->bind_param('s', $value);
            $insert->execute();
            $insert->close();
        }
    }
}

function parseYearNumber($value): ?int {
    if ($value === null) {
        return null;
    }

    $trimmed = trim((string)$value);
    if ($trimmed === '') {
        return null;
    }

    if (preg_match('/(\d+)/', $trimmed, $matches)) {
        $yearNumber = (int)$matches[1];
        return $yearNumber > 0 ? $yearNumber : null;
    }

    return null;
}

function normalizeYearLabel($value): string {
    $yearNumber = parseYearNumber($value);
    return $yearNumber !== null ? 'Year ' . $yearNumber : trim((string)$value);
}

function normalizeSectionLabel(?string $value): string {
    $trimmed = trim((string)$value);
    if ($trimmed === '') {
        return '';
    }

    if (stripos($trimmed, 'Section ') === 0) {
        return $trimmed;
    }

    return 'Section ' . strtoupper($trimmed);
}

function getOrCreateCollegeId(mysqli $conn, string $collegeName): ?int {
    $collegeName = trim($collegeName);
    if ($collegeName === '') {
        return null;
    }

    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $lookup = $conn->prepare("SELECT college_id FROM {$collegeTable} WHERE college_name = ? LIMIT 1");
    $lookup->bind_param('s', $collegeName);
    $lookup->execute();
    $result = $lookup->get_result();
    $existing = $result ? $result->fetch_assoc() : null;
    $lookup->close();

    if ($existing && isset($existing['college_id'])) {
        return (int)$existing['college_id'];
    }

    $insert = $conn->prepare("INSERT INTO {$collegeTable} (college_name) VALUES (?)");
    $insert->bind_param('s', $collegeName);
    $insert->execute();
    $newId = $conn->insert_id;
    $insert->close();

    return $newId > 0 ? (int)$newId : null;
}

function ensureSubjectLookupColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureRegistrationLookupData($conn);

    $columns = [
        'college_id' => "ALTER TABLE Subject ADD COLUMN college_id INT NULL AFTER teacher_id",
        'course_id' => "ALTER TABLE Subject ADD COLUMN course_id INT NULL AFTER college_id",
        'section_id' => "ALTER TABLE Subject ADD COLUMN section_id INT NULL AFTER course_id",
        'year_id' => "ALTER TABLE Subject ADD COLUMN year_id INT NULL AFTER section_id",
    ];

    foreach ($columns as $column => $statement) {
        $result = $conn->query("SHOW COLUMNS FROM Subject LIKE '$column'");
        if ($result && $result->num_rows > 0) {
            $result->free();
            continue;
        }

        if ($result) {
            $result->free();
        }

        if (!$conn->query($statement)) {
            throw new Exception("Unable to add $column to Subject: " . $conn->error);
        }
    }

    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $fkChecks = [
        'subject_college_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_college_fk FOREIGN KEY (college_id) REFERENCES {$collegeTable}(college_id)",
        'subject_course_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_course_fk FOREIGN KEY (course_id) REFERENCES {$courseTable}(course_id)",
        'subject_section_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_section_fk FOREIGN KEY (section_id) REFERENCES {$sectionTable}(section_id)",
        'subject_year_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_year_fk FOREIGN KEY (year_id) REFERENCES {$yearTable}(year_id)",
    ];

    foreach ($fkChecks as $constraint => $statement) {
        $check = $conn->prepare(
            "SELECT CONSTRAINT_NAME
             FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'Subject'
               AND CONSTRAINT_NAME = ?
             LIMIT 1"
        );
        $check->bind_param('s', $constraint);
        $check->execute();
        $result = $check->get_result();
        $exists = $result && $result->num_rows > 0;
        $check->close();

        if ($exists) {
            continue;
        }

        if (!$conn->query($statement)) {
            throw new Exception("Unable to add $constraint: " . $conn->error);
        }
    }

    $legacyColumns = [];
    foreach (['course', 'section', 'year'] as $columnName) {
        $result = $conn->query("SHOW COLUMNS FROM Subject LIKE '{$columnName}'");
        $legacyColumns[$columnName] = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }
    }

    if ($legacyColumns['course'] || $legacyColumns['section'] || $legacyColumns['year']) {
        $selectColumns = [
            'subject_id',
            'teacher_id',
            'college_id',
            'course_id',
            'section_id',
            'year_id',
        ];
        if ($legacyColumns['course']) {
            $selectColumns[] = 'course';
        }
        if ($legacyColumns['section']) {
            $selectColumns[] = 'section';
        }
        if ($legacyColumns['year']) {
            $selectColumns[] = 'year';
        }

        $subjectResult = $conn->query(
            "SELECT " . implode(', ', $selectColumns) . " FROM Subject"
        );

        if (!$subjectResult) {
            throw new Exception('Unable to inspect subjects for lookup backfill: ' . $conn->error);
        }

        $teacherCollegeStmt = $conn->prepare("SELECT college_id FROM Teacher WHERE teacher_id = ? LIMIT 1");
        $courseLookupStmt = $conn->prepare(
            "SELECT course_id, course_code, course_name
             FROM {$courseTable}
             WHERE course_id = ? OR course_name = ? OR course_code = ?
             LIMIT 1"
        );
        $sectionLookupStmt = $conn->prepare(
            "SELECT section_id, section_name
             FROM {$sectionTable}
             WHERE section_name = ?
             LIMIT 1"
        );
        $yearLookupStmt = $conn->prepare(
            "SELECT year_id, year_level
             FROM {$yearTable}
             WHERE year_level = ?
             LIMIT 1"
        );
        $updateStmt = $conn->prepare(
            "UPDATE Subject
             SET college_id = ?, course_id = ?, section_id = ?, year_id = ?
             WHERE subject_id = ?"
        );

        while ($row = $subjectResult->fetch_assoc()) {
            $subjectId = (int)$row['subject_id'];
            $collegeId = $row['college_id'] !== null ? (int)$row['college_id'] : null;
            $courseId = $row['course_id'] !== null ? (int)$row['course_id'] : null;
            $sectionId = $row['section_id'] !== null ? (int)$row['section_id'] : null;
            $yearId = $row['year_id'] !== null ? (int)$row['year_id'] : null;

            $courseValue = trim((string)($row['course'] ?? ''));
            $sectionValue = trim((string)($row['section'] ?? ''));

            if ($collegeId === null && !empty($row['teacher_id'])) {
                $teacherId = (int)$row['teacher_id'];
                $teacherCollegeStmt->bind_param('i', $teacherId);
                $teacherCollegeStmt->execute();
                $teacherCollegeResult = $teacherCollegeStmt->get_result();
                $teacherRow = $teacherCollegeResult ? $teacherCollegeResult->fetch_assoc() : null;
                if ($teacherRow && $teacherRow['college_id'] !== null) {
                    $collegeId = (int)$teacherRow['college_id'];
                }
            }

            if ($courseId === null && $courseValue !== '') {
                $lookupCourseId = 0;
                $courseLookupStmt->bind_param('iss', $lookupCourseId, $courseValue, $courseValue);
                $courseLookupStmt->execute();
                $courseResult = $courseLookupStmt->get_result();
                $courseRow = $courseResult ? $courseResult->fetch_assoc() : null;
                if ($courseRow) {
                    $courseId = (int)$courseRow['course_id'];
                }
            }

            if ($sectionId === null && $sectionValue !== '') {
                $normalizedSection = normalizeSectionLabel($sectionValue);
                $sectionLookupStmt->bind_param('s', $normalizedSection);
                $sectionLookupStmt->execute();
                $sectionResult = $sectionLookupStmt->get_result();
                $sectionRow = $sectionResult ? $sectionResult->fetch_assoc() : null;
                if ($sectionRow) {
                    $sectionId = (int)$sectionRow['section_id'];
                }
            }

            if ($yearId === null && isset($row['year']) && $row['year'] !== null && trim((string)$row['year']) !== '') {
                $normalizedYear = normalizeYearLabel($row['year']);
                $yearLookupStmt->bind_param('s', $normalizedYear);
                $yearLookupStmt->execute();
                $yearResult = $yearLookupStmt->get_result();
                $yearRow = $yearResult ? $yearResult->fetch_assoc() : null;
                if ($yearRow) {
                    $yearId = (int)$yearRow['year_id'];
                }
            }

            $courseIdValue = $courseId ?? null;
            $sectionIdValue = $sectionId ?? null;
            $yearIdValue = $yearId ?? null;
            $collegeIdValue = $collegeId ?? null;

            $updateStmt->bind_param(
                'iiiii',
                $collegeIdValue,
                $courseIdValue,
                $sectionIdValue,
                $yearIdValue,
                $subjectId
            );
            $updateStmt->execute();
        }

        $teacherCollegeStmt->close();
        $courseLookupStmt->close();
        $sectionLookupStmt->close();
        $yearLookupStmt->close();
        $updateStmt->close();
        $subjectResult->free();

        foreach (['course', 'section', 'year'] as $columnName) {
            if ($legacyColumns[$columnName]) {
                if (!$conn->query("ALTER TABLE Subject DROP COLUMN {$columnName}")) {
                    throw new Exception("Unable to drop Subject.{$columnName}: " . $conn->error);
                }
            }
        }
    }
}

function backfillStudentCollegeIds(mysqli $conn): array {
    ensureStudentProfileColumns($conn);
    ensureSubjectLookupColumns($conn);

    $summary = [
        'updated_course_links' => 0,
        'updated_from_course' => 0,
        'remaining_null' => 0,
    ];

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);

    $courseLinkStmt = $conn->prepare(
        "UPDATE {$courseTable} c
         INNER JOIN (
             SELECT course_id, MIN(college_id) AS inferred_college_id
             FROM Subject
             WHERE course_id IS NOT NULL
               AND college_id IS NOT NULL
             GROUP BY course_id
             HAVING COUNT(DISTINCT college_id) = 1
         ) resolved ON resolved.course_id = c.course_id
         SET c.college_id = resolved.inferred_college_id
         WHERE c.college_id IS NULL"
    );
    $courseLinkStmt->execute();
    $summary['updated_course_links'] = $courseLinkStmt->affected_rows > 0 ? $courseLinkStmt->affected_rows : 0;
    $courseLinkStmt->close();

    $updateStmt = $conn->prepare(
        "UPDATE Student st
         INNER JOIN {$courseTable} c ON c.course_id = st.course_id
         SET st.college_id = c.college_id
         WHERE st.college_id IS NULL
           AND st.course_id IS NOT NULL
           AND c.college_id IS NOT NULL"
    );
    $updateStmt->execute();
    $summary['updated_from_course'] = $updateStmt->affected_rows > 0 ? $updateStmt->affected_rows : 0;
    $updateStmt->close();

    $remainingStmt = $conn->prepare("SELECT COUNT(*) AS total FROM Student WHERE college_id IS NULL");
    $remainingStmt->execute();
    $remainingResult = $remainingStmt->get_result();
    $remainingRow = $remainingResult ? $remainingResult->fetch_assoc() : null;
    $summary['remaining_null'] = $remainingRow ? (int)$remainingRow['total'] : 0;
    $remainingStmt->close();

    return $summary;
}
