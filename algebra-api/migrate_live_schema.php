<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . '/db_connect.php';

function out(string $message): void
{
    echo $message . PHP_EOL;
}

function tableExists(mysqli $conn, string $table): bool
{
    $stmt = $conn->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(?) LIMIT 1");
    $stmt->bind_param('s', $table);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result && $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

function columnExists(mysqli $conn, string $table, string $column): bool
{
    $stmt = $conn->prepare(
        "SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(COLUMN_NAME) = LOWER(?)
         LIMIT 1"
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result && $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

function indexExists(mysqli $conn, string $table, string $indexName): bool
{
    $stmt = $conn->prepare(
        "SELECT 1
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(INDEX_NAME) = LOWER(?)
         LIMIT 1"
    );
    $stmt->bind_param('ss', $table, $indexName);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result && $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

function fetchScalar(mysqli $conn, string $sql)
{
    $result = $conn->query($sql);
    if (!$result) {
        return null;
    }

    $row = $result->fetch_row();
    $result->free();
    return $row[0] ?? null;
}

function runSql(mysqli $conn, string $sql, string $label): void
{
    $conn->query($sql);
    out('[ok] ' . $label);
}

function addColumnIfMissing(mysqli $conn, string $table, string $column, string $definition, string $label): void
{
    if (columnExists($conn, $table, $column)) {
        out('[skip] ' . $label);
        return;
    }

    runSql($conn, "ALTER TABLE {$table} ADD COLUMN {$column} {$definition}", $label);
}

function dropForeignKeysForColumn(mysqli $conn, string $table, string $column): void
{
    $stmt = $conn->prepare(
        "SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(COLUMN_NAME) = LOWER(?)
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();

    $constraints = [];
    while ($row = $result->fetch_assoc()) {
        $name = preg_replace('/[^A-Za-z0-9_]/', '', (string)($row['CONSTRAINT_NAME'] ?? ''));
        if ($name !== '') {
            $constraints[] = $name;
        }
    }
    $stmt->close();

    foreach (array_unique($constraints) as $constraint) {
        runSql($conn, "ALTER TABLE {$table} DROP FOREIGN KEY {$constraint}", "Dropped {$table}.{$column} foreign key {$constraint}");
    }
}

function dropNonPrimaryIndexesForColumn(mysqli $conn, string $table, string $column): void
{
    $stmt = $conn->prepare(
        "SELECT DISTINCT INDEX_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(COLUMN_NAME) = LOWER(?)
           AND INDEX_NAME <> 'PRIMARY'"
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();

    $indexes = [];
    while ($row = $result->fetch_assoc()) {
        $name = preg_replace('/[^A-Za-z0-9_]/', '', (string)($row['INDEX_NAME'] ?? ''));
        if ($name !== '') {
            $indexes[] = $name;
        }
    }
    $stmt->close();

    foreach (array_unique($indexes) as $index) {
        runSql($conn, "ALTER TABLE {$table} DROP INDEX {$index}", "Dropped {$table}.{$column} index {$index}");
    }
}

function ensureForeignKey(mysqli $conn, string $table, string $column, string $refTable, string $refColumn, string $constraint, string $suffix = ''): void
{
    if (!columnExists($conn, $table, $column)) {
        return;
    }

    $stmt = $conn->prepare(
        "SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(COLUMN_NAME) = LOWER(?)
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();

    $hasCorrect = false;
    $toDrop = [];

    while ($row = $result->fetch_assoc()) {
        $name = preg_replace('/[^A-Za-z0-9_]/', '', (string)($row['CONSTRAINT_NAME'] ?? ''));
        $referencedTable = (string)($row['REFERENCED_TABLE_NAME'] ?? '');
        $referencedColumn = (string)($row['REFERENCED_COLUMN_NAME'] ?? '');

        if (strcasecmp($referencedTable, $refTable) === 0 && strcasecmp($referencedColumn, $refColumn) === 0) {
            $hasCorrect = true;
            continue;
        }

        if ($name !== '') {
            $toDrop[] = $name;
        }
    }
    $stmt->close();

    foreach (array_unique($toDrop) as $name) {
        runSql($conn, "ALTER TABLE {$table} DROP FOREIGN KEY {$name}", "Dropped conflicting foreign key {$name} on {$table}.{$column}");
    }

    if ($hasCorrect) {
        out('[skip] Foreign key ' . $constraint . ' on ' . $table . '.' . $column);
        return;
    }

    runSql(
        $conn,
        "ALTER TABLE {$table} ADD CONSTRAINT {$constraint} FOREIGN KEY ({$column}) REFERENCES {$refTable}({$refColumn}){$suffix}",
        "Added foreign key {$constraint} on {$table}.{$column}"
    );
}

function ensureUniqueIndex(mysqli $conn, string $table, string $indexName, string $column): void
{
    if (indexExists($conn, $table, $indexName)) {
        out('[skip] Unique index ' . $indexName);
        return;
    }

    runSql($conn, "ALTER TABLE {$table} ADD UNIQUE KEY {$indexName} ({$column})", "Added unique index {$indexName}");
}

function ensureRolesTable(mysqli $conn): void
{
    out('Updating roles table...');

    runSql(
        $conn,
        "CREATE TABLE IF NOT EXISTS roles (
            role_id INT AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(50) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        'Ensured roles table exists'
    );

    foreach (['admin', 'teacher', 'student'] as $roleName) {
        $stmt = $conn->prepare(
            "INSERT INTO roles (role_name)
             VALUES (?)
             ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)"
        );
        $stmt->bind_param('s', $roleName);
        $stmt->execute();
        $stmt->close();
    }

    addColumnIfMissing($conn, 'users', 'role_id', 'INT NULL', 'Added users.role_id');

    if (!indexExists($conn, 'users', 'idx_users_role_id')) {
        runSql($conn, "ALTER TABLE users ADD INDEX idx_users_role_id (role_id)", 'Added users.role_id index');
    } else {
        out('[skip] Added users.role_id index');
    }

    if (columnExists($conn, 'users', 'role')) {
        runSql(
            $conn,
            "UPDATE users u
             INNER JOIN roles r ON r.role_name = u.role
             SET u.role_id = r.role_id
             WHERE u.role_id IS NULL
               AND u.role IS NOT NULL
               AND TRIM(u.role) <> ''",
            'Backfilled users.role_id from users.role'
        );
    }

    ensureForeignKey($conn, 'users', 'role_id', 'roles', 'role_id', 'fk_users_role');
}

function ensureUserAccountStatus(mysqli $conn): void
{
    addColumnIfMissing(
        $conn,
        'users',
        'account_status',
        "ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'",
        'Added users.account_status'
    );

    runSql(
        $conn,
        "UPDATE users
         SET account_status = 'active'
         WHERE account_status IS NULL
            OR TRIM(account_status) = ''",
        'Backfilled users.account_status'
    );

    if (!indexExists($conn, 'users', 'idx_users_account_status')) {
        runSql($conn, "ALTER TABLE users ADD INDEX idx_users_account_status (account_status)", 'Added users.account_status index');
    } else {
        out('[skip] Added users.account_status index');
    }
}

function ensureUsersSchema(mysqli $conn): void
{
    out('Updating users table...');

    addColumnIfMissing($conn, 'users', 'institutional_id', 'VARCHAR(64) NULL', 'Added users.institutional_id');
    addColumnIfMissing($conn, 'users', 'first_name', 'VARCHAR(100) NULL', 'Added users.first_name');
    addColumnIfMissing($conn, 'users', 'middle_name', 'VARCHAR(100) NULL', 'Added users.middle_name');
    addColumnIfMissing($conn, 'users', 'last_name', 'VARCHAR(100) NULL', 'Added users.last_name');
    addColumnIfMissing($conn, 'users', 'college_id', 'INT NULL', 'Added users.college_id');
    addColumnIfMissing($conn, 'users', 'course_id', 'INT NULL', 'Added users.course_id');
    addColumnIfMissing($conn, 'users', 'section_id', 'INT NULL', 'Added users.section_id');
    addColumnIfMissing($conn, 'users', 'year_id', 'INT NULL', 'Added users.year_id');
    addColumnIfMissing($conn, 'users', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', 'Added users.created_at');
    ensureRolesTable($conn);
    ensureUserAccountStatus($conn);

    if (tableExists($conn, 'teacher')) {
        runSql(
            $conn,
            "UPDATE users u
             INNER JOIN teacher t ON t.user_id = u.user_id
             INNER JOIN roles r ON r.role_name = 'teacher'
             SET u.first_name = COALESCE(NULLIF(u.first_name, ''), t.first_name),
                 u.middle_name = COALESCE(NULLIF(u.middle_name, ''), t.middle_name),
                 u.last_name = COALESCE(NULLIF(u.last_name, ''), t.last_name),
                 u.college_id = COALESCE(u.college_id, t.college_id),
                 u.role_id = COALESCE(u.role_id, r.role_id)" .
                 (columnExists($conn, 'users', 'role') ? ",
                 u.role = 'teacher'" : ''),
            'Backfilled teacher profile data into users'
        );
    }

    if (tableExists($conn, 'student')) {
        runSql(
            $conn,
            "UPDATE users u
             INNER JOIN student s ON s.user_id = u.user_id
             INNER JOIN roles r ON r.role_name = 'student'
             SET u.first_name = COALESCE(NULLIF(u.first_name, ''), s.first_name),
                 u.middle_name = COALESCE(NULLIF(u.middle_name, ''), s.middle_name),
                 u.last_name = COALESCE(NULLIF(u.last_name, ''), s.last_name),
                 u.course_id = COALESCE(u.course_id, s.course_id),
                 u.section_id = COALESCE(u.section_id, s.section_id),
                 u.year_id = COALESCE(u.year_id, s.year_id),
                 u.role_id = COALESCE(u.role_id, r.role_id)" .
                 (columnExists($conn, 'users', 'role') ? ",
                 u.role = 'student'" : ''),
            'Backfilled student profile data into users'
        );
    }

    if (columnExists($conn, 'users', 'college_id')) {
        runSql(
            $conn,
            "UPDATE users u
             INNER JOIN course c ON c.course_id = u.course_id
             SET u.college_id = c.college_id
             WHERE u.college_id IS NULL
               AND u.course_id IS NOT NULL
               AND c.college_id IS NOT NULL",
            'Backfilled users.college_id from course'
        );
    }

    runSql($conn, "ALTER TABLE users MODIFY first_name VARCHAR(100) NULL", 'Normalized users.first_name');
    runSql($conn, "ALTER TABLE users MODIFY middle_name VARCHAR(100) NULL", 'Normalized users.middle_name');
    runSql($conn, "ALTER TABLE users MODIFY last_name VARCHAR(100) NULL", 'Normalized users.last_name');

    ensureUniqueIndex($conn, 'users', 'users_institutional_id_uq', 'institutional_id');
    ensureForeignKey($conn, 'users', 'college_id', 'colleges', 'college_id', 'fk_users_college');
    ensureForeignKey($conn, 'users', 'course_id', 'course', 'course_id', 'fk_users_course');
    ensureForeignKey($conn, 'users', 'section_id', 'section', 'section_id', 'fk_users_section');
    ensureForeignKey($conn, 'users', 'year_id', 'year_level', 'year_id', 'fk_users_year');
}

function ensureOrganizationSchema(mysqli $conn): void
{
    out('Updating organization tables...');

    addColumnIfMissing($conn, 'year_level', 'date_created', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', 'Added year_level.date_created');
    addColumnIfMissing($conn, 'year_level', 'date_updated', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'Added year_level.date_updated');

    addColumnIfMissing($conn, 'colleges', 'is_active', 'TINYINT(1) DEFAULT 1', 'Added colleges.is_active');
    addColumnIfMissing($conn, 'colleges', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', 'Added colleges.created_at');
    addColumnIfMissing($conn, 'colleges', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'Added colleges.updated_at');

    addColumnIfMissing($conn, 'course', 'is_active', 'TINYINT(1) DEFAULT 1', 'Added course.is_active');
    addColumnIfMissing($conn, 'course', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', 'Added course.created_at');
    addColumnIfMissing($conn, 'course', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'Added course.updated_at');

    ensureForeignKey($conn, 'course', 'college_id', 'colleges', 'college_id', 'fk_course_college');
}

function ensureSubjectSchema(mysqli $conn): void
{
    out('Updating subject table...');

    if (!tableExists($conn, 'school_year')) {
        runSql(
            $conn,
            "CREATE TABLE school_year (
                school_year_id INT AUTO_INCREMENT PRIMARY KEY,
                label VARCHAR(64) NOT NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_school_year_label (label)
            ) ENGINE=InnoDB",
            'Created school_year table'
        );
    } else {
        out('[skip] Created school_year table');
    }

    if (!tableExists($conn, 'semester')) {
        runSql(
            $conn,
            "CREATE TABLE semester (
                semester_id INT AUTO_INCREMENT PRIMARY KEY,
                semester_name VARCHAR(64) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB",
            'Created semester table'
        );
    } else {
        out('[skip] Created semester table');
    }

    runSql(
        $conn,
        "INSERT INTO semester (semester_name)
         VALUES ('1st Semester'), ('2nd Semester'), ('Summer')
         ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name)",
        'Seeded semester labels'
    );

    addColumnIfMissing($conn, 'subject', 'school_year_id', 'INT NULL', 'Added subject.school_year_id');
    addColumnIfMissing($conn, 'subject', 'semester_id', 'INT NULL', 'Added subject.semester_id');

    if (columnExists($conn, 'subject', 'teacher_id') && !columnExists($conn, 'subject', 'teacher_user_id')) {
        addColumnIfMissing($conn, 'subject', 'teacher_user_id', 'INT NULL', 'Added subject.teacher_user_id');
        runSql(
            $conn,
            "UPDATE subject s
             INNER JOIN teacher t ON t.teacher_id = s.teacher_id
             SET s.teacher_user_id = t.user_id
             WHERE s.teacher_user_id IS NULL",
            'Backfilled subject.teacher_user_id'
        );
    }

    if (columnExists($conn, 'subject', 'teacher_user_id')) {
        dropForeignKeysForColumn($conn, 'subject', 'teacher_id');
        runSql($conn, "UPDATE subject SET teacher_user_id = NULL WHERE teacher_user_id = 0", 'Cleared invalid subject.teacher_user_id values');

        $missingTeacherUsers = (int)fetchScalar(
            $conn,
            "SELECT COUNT(*)
             FROM subject s
             LEFT JOIN users u ON u.user_id = s.teacher_user_id
             WHERE s.teacher_user_id IS NOT NULL
               AND u.user_id IS NULL"
        );

        $nullTeacherUsers = (int)fetchScalar(
            $conn,
            "SELECT COUNT(*) FROM subject WHERE teacher_user_id IS NULL"
        );

        if ($missingTeacherUsers === 0 && $nullTeacherUsers === 0) {
            runSql($conn, "ALTER TABLE subject MODIFY teacher_user_id INT NOT NULL", 'Normalized subject.teacher_user_id');
        } else {
            runSql($conn, "ALTER TABLE subject MODIFY teacher_user_id INT NULL", 'Kept subject.teacher_user_id nullable for orphaned rows');
        }

        ensureForeignKey($conn, 'subject', 'teacher_user_id', 'users', 'user_id', 'fk_subject_teacher_user');
    }

    if (columnExists($conn, 'subject', 'teacher_id')) {
        dropNonPrimaryIndexesForColumn($conn, 'subject', 'teacher_id');
        runSql($conn, "ALTER TABLE subject DROP COLUMN teacher_id", 'Dropped legacy subject.teacher_id');
    }

    runSql($conn, "ALTER TABLE subject MODIFY subject_code VARCHAR(50) NULL", 'Normalized subject.subject_code');
    runSql($conn, "ALTER TABLE subject MODIFY semester VARCHAR(64) NULL", 'Normalized subject.semester');
    runSql($conn, "ALTER TABLE subject MODIFY school_year VARCHAR(64) NULL", 'Normalized subject.school_year');
    runSql($conn, "ALTER TABLE subject MODIFY join_code VARCHAR(20) NULL", 'Normalized subject.join_code');

    runSql(
        $conn,
        "INSERT INTO school_year (label)
         SELECT DISTINCT TRIM(school_year)
         FROM subject
         WHERE school_year IS NOT NULL
           AND TRIM(school_year) <> ''
         ON DUPLICATE KEY UPDATE label = VALUES(label)",
        'Backfilled school_year labels'
    );

    runSql(
        $conn,
        "UPDATE subject s
         INNER JOIN school_year sy ON sy.label = TRIM(s.school_year)
         SET s.school_year_id = sy.school_year_id
         WHERE s.school_year_id IS NULL
           AND s.school_year IS NOT NULL
           AND TRIM(s.school_year) <> ''",
        'Linked subject rows to school_year'
    );

    runSql(
        $conn,
        "INSERT INTO semester (semester_name)
         SELECT DISTINCT TRIM(semester)
         FROM subject
         WHERE semester IS NOT NULL
           AND TRIM(semester) <> ''
         ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name)",
        'Backfilled semester labels'
    );

    runSql(
        $conn,
        "UPDATE subject s
         INNER JOIN semester sem ON sem.semester_name = TRIM(s.semester)
         SET s.semester_id = sem.semester_id
         WHERE s.semester_id IS NULL
           AND s.semester IS NOT NULL
           AND TRIM(s.semester) <> ''",
        'Linked subject rows to semester'
    );

    ensureForeignKey($conn, 'subject', 'course_id', 'course', 'course_id', 'fk_subject_course');
    ensureForeignKey($conn, 'subject', 'section_id', 'section', 'section_id', 'fk_subject_section');
    ensureForeignKey($conn, 'subject', 'year_id', 'year_level', 'year_id', 'fk_subject_year');
    ensureForeignKey($conn, 'subject', 'semester_id', 'semester', 'semester_id', 'fk_subject_semester');
    ensureForeignKey($conn, 'subject', 'school_year_id', 'school_year', 'school_year_id', 'fk_subject_school_year');
}

function ensureRubricSchema(mysqli $conn): void
{
    out('Updating rubric tables...');

    if (columnExists($conn, 'rubric_sets', 'teacher_id') && !columnExists($conn, 'rubric_sets', 'teacher_user_id')) {
        addColumnIfMissing($conn, 'rubric_sets', 'teacher_user_id', 'INT NULL', 'Added rubric_sets.teacher_user_id');
        runSql(
            $conn,
            "UPDATE rubric_sets rs
             INNER JOIN teacher t ON t.teacher_id = rs.teacher_id
             SET rs.teacher_user_id = t.user_id
             WHERE rs.teacher_user_id IS NULL",
            'Backfilled rubric_sets.teacher_user_id'
        );
    }

    if (columnExists($conn, 'rubric_sets', 'teacher_user_id')) {
        dropForeignKeysForColumn($conn, 'rubric_sets', 'teacher_id');
        runSql($conn, "ALTER TABLE rubric_sets MODIFY teacher_user_id INT NOT NULL", 'Normalized rubric_sets.teacher_user_id');
        ensureForeignKey($conn, 'rubric_sets', 'teacher_user_id', 'users', 'user_id', 'fk_rubric_sets_teacher_user');
    }

    if (columnExists($conn, 'rubric_sets', 'teacher_id')) {
        dropNonPrimaryIndexesForColumn($conn, 'rubric_sets', 'teacher_id');
        runSql($conn, "ALTER TABLE rubric_sets DROP COLUMN teacher_id", 'Dropped legacy rubric_sets.teacher_id');
    }

    runSql($conn, "ALTER TABLE rubric_sets MODIFY level_definitions JSON NULL", 'Normalized rubric_sets.level_definitions');
}

function ensureEnrollmentSchema(mysqli $conn): void
{
    out('Updating enrollment table...');

    if (columnExists($conn, 'enrollment', 'student_id') && !columnExists($conn, 'enrollment', 'student_user_id')) {
        addColumnIfMissing($conn, 'enrollment', 'student_user_id', 'INT NULL', 'Added enrollment.student_user_id');
        runSql(
            $conn,
            "UPDATE enrollment e
             INNER JOIN student s ON s.student_id = e.student_id
             SET e.student_user_id = s.user_id
             WHERE e.student_user_id IS NULL",
            'Backfilled enrollment.student_user_id'
        );
    }

    if (columnExists($conn, 'enrollment', 'student_user_id')) {
        dropForeignKeysForColumn($conn, 'enrollment', 'student_id');
        runSql($conn, "ALTER TABLE enrollment MODIFY student_user_id INT NOT NULL", 'Normalized enrollment.student_user_id');
        ensureForeignKey($conn, 'enrollment', 'student_user_id', 'users', 'user_id', 'fk_enrollment_student_user');
    }

    if (columnExists($conn, 'enrollment', 'student_id')) {
        dropNonPrimaryIndexesForColumn($conn, 'enrollment', 'student_id');
        runSql($conn, "ALTER TABLE enrollment DROP COLUMN student_id", 'Dropped legacy enrollment.student_id');
    }

    runSql($conn, "ALTER TABLE enrollment MODIFY enrollment_status ENUM('enrolled', 'dropped') DEFAULT 'enrolled'", 'Normalized enrollment.enrollment_status');

    if (!indexExists($conn, 'enrollment', 'uq_enrollment_student_subject')) {
        runSql(
            $conn,
            "ALTER TABLE enrollment ADD UNIQUE KEY uq_enrollment_student_subject (student_user_id, subject_id)",
            'Added enrollment unique key'
        );
    } else {
        out('[skip] Added enrollment unique key');
    }

    ensureForeignKey($conn, 'enrollment', 'subject_id', 'subject', 'subject_id', 'fk_enrollment_subject');
}

function ensureCapturedSolutionSchema(mysqli $conn): void
{
    out('Updating captured_solution table...');

    if (columnExists($conn, 'captured_solution', 'student_id') && !columnExists($conn, 'captured_solution', 'student_user_id')) {
        addColumnIfMissing($conn, 'captured_solution', 'student_user_id', 'INT NULL', 'Added captured_solution.student_user_id');
        runSql(
            $conn,
            "UPDATE captured_solution cs
             INNER JOIN student s ON s.student_id = cs.student_id
             SET cs.student_user_id = s.user_id
             WHERE cs.student_user_id IS NULL",
            'Backfilled captured_solution.student_user_id'
        );
    }

    if (columnExists($conn, 'captured_solution', 'student_user_id')) {
        dropForeignKeysForColumn($conn, 'captured_solution', 'student_id');
        runSql($conn, "ALTER TABLE captured_solution MODIFY student_user_id INT NOT NULL", 'Normalized captured_solution.student_user_id');
        ensureForeignKey($conn, 'captured_solution', 'student_user_id', 'users', 'user_id', 'fk_captured_solution_student_user');
    }

    if (columnExists($conn, 'captured_solution', 'student_id')) {
        dropNonPrimaryIndexesForColumn($conn, 'captured_solution', 'student_id');
        runSql($conn, "ALTER TABLE captured_solution DROP COLUMN student_id", 'Dropped legacy captured_solution.student_id');
    }

    runSql($conn, "ALTER TABLE captured_solution MODIFY ai_raw_json JSON NULL", 'Normalized captured_solution.ai_raw_json');
}

function ensureExerciseSchema(mysqli $conn): void
{
    out('Updating assessment tables...');

    runSql($conn, "ALTER TABLE exercises_problem MODIFY difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium'", 'Normalized exercises_problem.difficulty');
    runSql($conn, "ALTER TABLE exercise_items MODIFY item_no INT DEFAULT 1", 'Normalized exercise_items.item_no');
    runSql($conn, "ALTER TABLE exercise_items MODIFY question_type ENUM('handwritten_algebra') DEFAULT 'handwritten_algebra'", 'Normalized exercise_items.question_type');
    runSql($conn, "ALTER TABLE exercise_items MODIFY max_score DECIMAL(5,2) DEFAULT 0.00", 'Normalized exercise_items.max_score');
}

function ensureScoreSchema(mysqli $conn): void
{
    out('Updating score tables...');

    runSql($conn, "ALTER TABLE scores MODIFY date_scored TIMESTAMP DEFAULT CURRENT_TIMESTAMP", 'Normalized scores.date_scored');
}

try {
    out('Starting live schema migration for algebraassess...');

    ensureOrganizationSchema($conn);
    ensureUsersSchema($conn);
    ensureSubjectSchema($conn);
    ensureRubricSchema($conn);
    ensureEnrollmentSchema($conn);
    ensureCapturedSolutionSchema($conn);
    ensureExerciseSchema($conn);
    ensureScoreSchema($conn);

    out('Migration completed successfully.');
} catch (Throwable $e) {
    http_response_code(500);
    out('Migration failed: ' . $e->getMessage());
    exit(1);
}
