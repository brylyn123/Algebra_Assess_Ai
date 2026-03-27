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

function ensureStudentProfileColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

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

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $fkChecks = [
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

function ensureRegistrationLookupData(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

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
