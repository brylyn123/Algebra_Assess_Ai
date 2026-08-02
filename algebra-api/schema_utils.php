<?php
function schemaColumnExists(mysqli $conn, string $table, string $column): bool {
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

function schemaIndexExists(mysqli $conn, string $table, string $indexName): bool {
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

function migrationsAlreadyRan(mysqli $conn): bool {
    static $cached = null;
    if ($cached !== null) return $cached;
    $cached = false;
    $result = $conn->query("SELECT 1 FROM schema_migration_log WHERE migration_key = 'live_schema_v1' LIMIT 1");
    if ($result && $result->num_rows > 0) {
        $cached = true;
    }
    return $cached;
}

function markMigrationsRan(mysqli $conn): void {
    $conn->query("INSERT IGNORE INTO schema_migration_log (migration_key, ran_at) VALUES ('live_schema_v1', NOW())");
}

function ensureMigrationFlagTable(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS schema_migration_log (
        migration_key VARCHAR(100) PRIMARY KEY,
        ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
}

function ensureUserAccountStatusSchema(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) {
        return;
    }

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    if (!schemaColumnExists($conn, $userTable, 'account_status')) {
        if (
            !$conn->query(
                "ALTER TABLE {$userTable}
                 ADD COLUMN account_status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'
                 AFTER role_id"
            )
        ) {
            throw new Exception("Unable to add {$userTable}.account_status: " . $conn->error);
        }
    }

    if (
        !$conn->query(
            "UPDATE {$userTable}
             SET account_status = 'active'
             WHERE account_status IS NULL
                OR TRIM(account_status) = ''"
        )
    ) {
        throw new Exception("Unable to backfill {$userTable}.account_status: " . $conn->error);
    }

    if (!schemaIndexExists($conn, $userTable, 'idx_users_account_status')) {
        if (!$conn->query("ALTER TABLE {$userTable} ADD INDEX idx_users_account_status (account_status)")) {
            throw new Exception("Unable to index {$userTable}.account_status: " . $conn->error);
        }
    }
}

function ensureRolesSchema(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    if (
        !$conn->query(
            "CREATE TABLE IF NOT EXISTS roles (
                role_id INT AUTO_INCREMENT PRIMARY KEY,
                role_name VARCHAR(50) NOT NULL UNIQUE,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )
    ) {
        throw new Exception('Unable to create roles table: ' . $conn->error);
    }

    $rolesTable = resolveExistingTableName($conn, ['roles']);
    $roleColumns = [
        'is_deleted' => "ALTER TABLE {$rolesTable} ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER role_name",
        'updated_at' => "ALTER TABLE {$rolesTable} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($roleColumns as $columnName => $statement) {
        if (!schemaColumnExists($conn, $rolesTable, $columnName) && !$conn->query($statement)) {
            throw new Exception("Unable to add {$rolesTable}.{$columnName}: " . $conn->error);
        }
    }

    $roleStmt = $conn->prepare(
        "INSERT INTO roles (role_name)
         VALUES (?)
         ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)"
    );
    foreach (['admin', 'teacher', 'student'] as $roleName) {
        $roleStmt->bind_param('s', $roleName);
        $roleStmt->execute();
    }
    $roleStmt->close();

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);

    if (!schemaColumnExists($conn, $userTable, 'role_id')) {
        if (!$conn->query("ALTER TABLE {$userTable} ADD COLUMN role_id INT NULL AFTER year_id")) {
            throw new Exception("Unable to add {$userTable}.role_id: " . $conn->error);
        }
    }

    if (!schemaIndexExists($conn, $userTable, 'idx_users_role_id')) {
        if (!$conn->query("ALTER TABLE {$userTable} ADD INDEX idx_users_role_id (role_id)")) {
            throw new Exception("Unable to index {$userTable}.role_id: " . $conn->error);
        }
    }

    $hasLegacyRoleColumn = schemaColumnExists($conn, $userTable, 'role');
    if ($hasLegacyRoleColumn) {
        if (
            !$conn->query(
                "UPDATE {$userTable} u
                 INNER JOIN roles r ON r.role_name = u.role
                 SET u.role_id = r.role_id
                 WHERE u.role_id IS NULL
                   AND u.role IS NOT NULL
                   AND TRIM(u.role) <> ''"
            )
        ) {
            throw new Exception("Unable to backfill {$userTable}.role_id: " . $conn->error);
        }
    }

    $fkStmt = $conn->prepare(
        "SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND LOWER(TABLE_NAME) = LOWER(?)
           AND LOWER(COLUMN_NAME) = 'role_id'
           AND LOWER(REFERENCED_TABLE_NAME) = 'roles'
           AND LOWER(REFERENCED_COLUMN_NAME) = 'role_id'
         LIMIT 1"
    );
    $fkStmt->bind_param('s', $userTable);
    $fkStmt->execute();
    $fkResult = $fkStmt->get_result();
    $hasFk = $fkResult && $fkResult->num_rows > 0;
    $fkStmt->close();

    if (
        !$hasFk &&
        !$conn->query(
            "ALTER TABLE {$userTable}
             ADD CONSTRAINT fk_users_role
             FOREIGN KEY (role_id) REFERENCES roles(role_id)"
        )
    ) {
        throw new Exception("Unable to add {$userTable}.role_id foreign key: " . $conn->error);
    }

    ensureUserAccountStatusSchema($conn);
}

function getRoleIdByName(mysqli $conn, string $roleName): ?int {
    ensureRolesSchema($conn);

    $roleName = trim($roleName);
    if ($roleName === '') {
        return null;
    }

    $stmt = $conn->prepare("SELECT role_id FROM roles WHERE role_name = ? LIMIT 1");
    $stmt->bind_param('s', $roleName);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return ($row && isset($row['role_id'])) ? (int)$row['role_id'] : null;
}

function getUserRoleJoinClause(mysqli $conn, string $userAlias): string {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    if (!schemaColumnExists($conn, $userTable, 'role_id')) {
        return '';
    }

    return " LEFT JOIN roles {$userAlias}_role_ref ON {$userAlias}_role_ref.role_id = {$userAlias}.role_id ";
}

function getUserRoleNameExpression(mysqli $conn, string $userAlias): string {
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $hasRoleId = schemaColumnExists($conn, $userTable, 'role_id');
    $hasLegacyRole = schemaColumnExists($conn, $userTable, 'role');

    if ($hasRoleId && $hasLegacyRole) {
        return "COALESCE({$userAlias}_role_ref.role_name, {$userAlias}.role)";
    }

    if ($hasRoleId) {
        return "{$userAlias}_role_ref.role_name";
    }

    if ($hasLegacyRole) {
        return "{$userAlias}.role";
    }

    throw new Exception('Users table has neither role_id nor role.');
}

function userHasRole(mysqli $conn, int $userId, string $roleName): bool {
    ensureRolesSchema($conn);
    ensureUserAccountStatusSchema($conn);

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $roleExpression = getUserRoleNameExpression($conn, 'u');
    $roleJoin = getUserRoleJoinClause($conn, 'u');

    $stmt = $conn->prepare(
        "SELECT u.user_id
         FROM {$userTable} u
         {$roleJoin}
         WHERE u.user_id = ?
           AND {$roleExpression} = ?
           AND u.account_status = 'active'
         LIMIT 1"
    );
    $stmt->bind_param('is', $userId, $roleName);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result && $result->num_rows > 0;
    $stmt->close();

    return $exists;
}

function getEnrollmentSubjectColumn(mysqli $conn): string {
    static $column = null;

    if ($column !== null) {
        return $column;
    }

    $cacheFile = __DIR__ . '/.schema_cache.php';
    if (file_exists($cacheFile)) {
        $cache = require $cacheFile;
        if (isset($cache['enrollment_column'])) {
            $column = $cache['enrollment_column'];
            return $column;
        }
    }

    $preferred = 'subject_id';
    $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$preferred'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        $column = $preferred;
    } else {
        $fallback = 'offering_id';
        $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$fallback'");
        if ($result && $result->num_rows > 0) {
            $result->free();
            $column = $fallback;
        } else {
            throw new Exception('Enrollment table is missing the subject identifier column.');
        }
    }

    $cache = file_exists($cacheFile) ? require $cacheFile : [];
    $cache['enrollment_column'] = $column;
    @file_put_contents($cacheFile, '<?php return ' . var_export($cache, true) . ';');

    return $column;
}

function resolveExistingTableName(mysqli $conn, array $candidates): string {
    static $cache = [];

    foreach ($candidates as $candidate) {
        if (isset($cache[$candidate])) {
            return $cache[$candidate];
        }
    }

    $cacheFile = __DIR__ . '/.schema_cache.php';
    $fileCache = file_exists($cacheFile) ? require $cacheFile : [];
    foreach ($candidates as $candidate) {
        if (isset($fileCache["table_{$candidate}"])) {
            $resolved = $fileCache["table_{$candidate}"];
            $cache[$candidate] = $resolved;
            return $resolved;
        }
    }

    foreach ($candidates as $candidate) {
        $escaped = $conn->real_escape_string($candidate);
        $result = $conn->query("SHOW TABLES LIKE '{$escaped}'");
        if ($result && $result->num_rows > 0) {
            $result->free();
            $cache[$candidate] = $candidate;
            $fileCache["table_{$candidate}"] = $candidate;
            @file_put_contents($cacheFile, '<?php return ' . var_export($fileCache, true) . ';');
            return $candidate;
        }
        if ($result) {
            $result->free();
        }
    }

    $first = $candidates[0] ?? 'unknown';
    throw new Exception("Required table '{$first}' does not exist.");
}

function ensureAssessmentRubricColumn(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

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

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

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

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

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

function ensureScoreReturnColumn(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $returnedAtResult = $conn->query("SHOW COLUMNS FROM Scores LIKE 'returned_at'");
    $hasReturnedAt = $returnedAtResult && $returnedAtResult->num_rows > 0;
    if ($returnedAtResult) {
        $returnedAtResult->free();
    }

    if (!$hasReturnedAt) {
        if (!$conn->query("ALTER TABLE Scores ADD COLUMN returned_at DATETIME NULL AFTER date_scored")) {
            throw new Exception('Unable to add returned result support to Scores: ' . $conn->error);
        }

        if (
            !$conn->query(
                "UPDATE Scores
                 SET returned_at = COALESCE(date_scored, CURRENT_TIMESTAMP)
                 WHERE returned_at IS NULL"
            )
        ) {
            throw new Exception('Unable to backfill returned_at in Scores: ' . $conn->error);
        }
    }
}

function ensureStudentProfileColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    ensureRolesSchema($conn);
    ensureUserAccountStatusSchema($conn);
    ensureCollegeForeignKeyForTable($conn, $userTable);
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

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    ensureCollegeForeignKeyForTable($conn, $courseTable);
}

function ensureFlexibleOrganizationColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);

    $tableDefinitions = [
        $sectionTable => [
            'created_at' => "ALTER TABLE {$sectionTable} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER section_name",
            'updated_at' => "ALTER TABLE {$sectionTable} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
        ],
        $collegeTable => [
            'is_active' => "ALTER TABLE {$collegeTable} ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER college_name",
            'created_at' => "ALTER TABLE {$collegeTable} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active",
            'updated_at' => "ALTER TABLE {$collegeTable} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
        ],
        $courseTable => [
            'is_active' => "ALTER TABLE {$courseTable} ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER college_id",
            'created_at' => "ALTER TABLE {$courseTable} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active",
            'updated_at' => "ALTER TABLE {$courseTable} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
        ],
    ];

    foreach ($tableDefinitions as $tableName => $columns) {
        foreach ($columns as $columnName => $statement) {
            $result = $conn->query("SHOW COLUMNS FROM {$tableName} LIKE '{$columnName}'");
            $exists = $result && $result->num_rows > 0;
            if ($result) {
                $result->free();
            }

            if ($exists) {
                continue;
            }

            if (!$conn->query($statement)) {
                throw new Exception("Unable to add {$tableName}.{$columnName}: " . $conn->error);
            }
        }
    }
}

function ensureRegistrationLookupData(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    ensureRolesSchema($conn);
    ensureCourseCollegeForeignKey($conn);
    ensureFlexibleOrganizationColumns($conn);
    ensureYearLevelAuditColumns($conn);
    ensureSemesterSchema($conn);

    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

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

function ensureYearLevelAuditColumns(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $columns = [
        'date_created' => "ALTER TABLE {$yearTable} ADD COLUMN date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER year_level",
        'date_updated' => "ALTER TABLE {$yearTable} ADD COLUMN date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER date_created",
    ];

    foreach ($columns as $columnName => $statement) {
        $result = $conn->query("SHOW COLUMNS FROM {$yearTable} LIKE '{$columnName}'");
        $exists = $result && $result->num_rows > 0;
        if ($result) {
            $result->free();
        }

        if ($exists) {
            continue;
        }

        if (!$conn->query($statement)) {
            throw new Exception("Unable to add {$yearTable}.{$columnName}: " . $conn->error);
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

function ensureSemesterSchema(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    if (
        !$conn->query(
            "CREATE TABLE IF NOT EXISTS Semester (
                semester_id INT AUTO_INCREMENT PRIMARY KEY,
                semester_name VARCHAR(64) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB"
        )
    ) {
        throw new Exception('Unable to create Semester table: ' . $conn->error);
    }

    $seedValues = ['1st Semester', '2nd Semester', 'Summer'];
    $seedStmt = $conn->prepare(
        "INSERT INTO Semester (semester_name)
         VALUES (?)
         ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name)"
    );
    foreach ($seedValues as $value) {
        $seedStmt->bind_param('s', $value);
        $seedStmt->execute();
    }
    $seedStmt->close();
}

function getOrCreateSemesterId(mysqli $conn, string $semesterName): ?int {
    ensureSemesterSchema($conn);

    $semesterName = trim($semesterName);
    if ($semesterName === '') {
        return null;
    }

    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $lookup = $conn->prepare("SELECT semester_id FROM {$semesterTable} WHERE semester_name = ? LIMIT 1");
    $lookup->bind_param('s', $semesterName);
    $lookup->execute();
    $result = $lookup->get_result();
    $existing = $result ? $result->fetch_assoc() : null;
    $lookup->close();

    if ($existing && isset($existing['semester_id'])) {
        return (int)$existing['semester_id'];
    }

    $insert = $conn->prepare("INSERT INTO {$semesterTable} (semester_name) VALUES (?)");
    $insert->bind_param('s', $semesterName);
    $insert->execute();
    $newId = $conn->insert_id;
    $insert->close();

    return $newId > 0 ? (int)$newId : null;
}

function generateUniqueCourseCode(mysqli $conn, string $courseName): string {
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);

    $lettersOnly = preg_replace('/[^A-Za-z0-9 ]+/', ' ', strtoupper($courseName));
    $tokens = preg_split('/\s+/', trim((string)$lettersOnly)) ?: [];
    $initials = '';

    foreach ($tokens as $token) {
        if ($token === '') {
            continue;
        }
        $initials .= substr($token, 0, 1);
    }

    if ($initials === '') {
        $initials = 'CRS';
    }

    $baseCode = substr($initials, 0, 8);
    if ($baseCode === '') {
        $baseCode = 'CRS';
    }

    $candidate = $baseCode;
    $suffix = 1;
    $lookup = $conn->prepare("SELECT course_id FROM {$courseTable} WHERE course_code = ? LIMIT 1");

    while (true) {
        $lookup->bind_param('s', $candidate);
        $lookup->execute();
        $result = $lookup->get_result();
        $exists = $result && $result->num_rows > 0;

        if ($result) {
            $result->free();
        }

        if (!$exists) {
            break;
        }

        $suffix++;
        $candidate = substr($baseCode, 0, max(1, 8 - strlen((string)$suffix))) . $suffix;
    }

    $lookup->close();
    return $candidate;
}

function getOrCreateCourseId(mysqli $conn, string $courseName, ?int $collegeId = null, ?string $courseCode = null): ?int {
    $courseName = trim($courseName);
    $courseCode = trim((string)$courseCode);

    if ($courseName === '') {
        return null;
    }

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);

    if ($collegeId !== null) {
        $lookup = $conn->prepare(
            "SELECT course_id
             FROM {$courseTable}
             WHERE course_name = ?
               AND ((college_id IS NULL AND ? IS NULL) OR college_id = ?)
             LIMIT 1"
        );
        $lookup->bind_param('sii', $courseName, $collegeId, $collegeId);
    } else {
        $lookup = $conn->prepare(
            "SELECT course_id
             FROM {$courseTable}
             WHERE course_name = ?
             LIMIT 1"
        );
        $lookup->bind_param('s', $courseName);
    }

    $lookup->execute();
    $result = $lookup->get_result();
    $existing = $result ? $result->fetch_assoc() : null;
    $lookup->close();

    if ($existing && isset($existing['course_id'])) {
        return (int)$existing['course_id'];
    }

    if ($courseCode === '') {
        $courseCode = generateUniqueCourseCode($conn, $courseName);
    }

    $insert = $conn->prepare("INSERT INTO {$courseTable} (course_name, course_code, college_id) VALUES (?, ?, ?)");
    $insert->bind_param('ssi', $courseName, $courseCode, $collegeId);
    $insert->execute();
    $newId = $conn->insert_id;
    $insert->close();

    return $newId > 0 ? (int)$newId : null;
}

function ensureSchoolYearSchema(mysqli $conn): void {
    static $checked = false;

    if ($checked) {
        return;
    }

    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    if (
        !$conn->query(
            "CREATE TABLE IF NOT EXISTS school_year (
                school_year_id INT AUTO_INCREMENT PRIMARY KEY,
                label VARCHAR(64) NOT NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_school_year_label (label)
            ) ENGINE=InnoDB"
        )
    ) {
        throw new Exception('Unable to create school_year table: ' . $conn->error);
    }

    $currentYear = (int)date('Y');
    $currentMonth = (int)date('n');
    $academicStartYear = $currentMonth >= 6 ? $currentYear : ($currentYear - 1);
    $defaultLabels = [
        ($academicStartYear - 1) . '-' . $academicStartYear,
        $academicStartYear . '-' . ($academicStartYear + 1),
        ($academicStartYear + 1) . '-' . ($academicStartYear + 2),
    ];

    $seedStmt = $conn->prepare("INSERT INTO school_year (label) VALUES (?) ON DUPLICATE KEY UPDATE label = VALUES(label)");
    foreach ($defaultLabels as $label) {
        $seedStmt->bind_param('s', $label);
        $seedStmt->execute();
    }
    $seedStmt->close();

    $hasLegacySchoolYear = schemaColumnExists($conn, 'Subject', 'school_year');
    if (!$hasLegacySchoolYear) {
        $hasSemesterCol = schemaColumnExists($conn, 'Subject', 'semester');
        $afterClause = $hasSemesterCol ? 'AFTER semester' : 'AFTER semester_id';
        if (!$conn->query("ALTER TABLE Subject ADD COLUMN school_year VARCHAR(64) NULL $afterClause")) {
            throw new Exception('Unable to add Subject.school_year: ' . $conn->error);
        }
    }

    $hasLegacySemester = schemaColumnExists($conn, 'Subject', 'semester');
    if (!$hasLegacySemester) {
        if (!$conn->query("ALTER TABLE Subject ADD COLUMN semester VARCHAR(64) NULL AFTER semester_id")) {
            throw new Exception('Unable to add Subject.semester: ' . $conn->error);
        }
    }

    $schoolYearIdResult = $conn->query("SHOW COLUMNS FROM Subject LIKE 'school_year_id'");
    $hasSchoolYearId = $schoolYearIdResult && $schoolYearIdResult->num_rows > 0;
    if ($schoolYearIdResult) {
        $schoolYearIdResult->free();
    }

    $addSchoolYearIdClause = $hasLegacySchoolYear ? 'AFTER school_year' : 'AFTER semester_id';

    if (!$hasSchoolYearId && !$conn->query("ALTER TABLE Subject ADD COLUMN school_year_id INT NULL $addSchoolYearIdClause")) {
        throw new Exception('Unable to add Subject.school_year_id: ' . $conn->error);
    }

    if ($hasLegacySchoolYear) {
        if (
            !$conn->query(
                "INSERT INTO school_year (label)
                 SELECT DISTINCT TRIM(school_year)
                 FROM Subject
                 WHERE school_year IS NOT NULL
                   AND TRIM(school_year) <> ''
                 ON DUPLICATE KEY UPDATE label = VALUES(label)"
            )
        ) {
            throw new Exception('Unable to backfill school_year records: ' . $conn->error);
        }

        if (
            !$conn->query(
                "UPDATE Subject s
                 INNER JOIN school_year sy ON sy.label = TRIM(s.school_year)
                 SET s.school_year_id = sy.school_year_id
                 WHERE s.school_year_id IS NULL
                   AND s.school_year IS NOT NULL
                   AND TRIM(s.school_year) <> ''"
            )
        ) {
            throw new Exception('Unable to link Subject.school_year_id: ' . $conn->error);
        }
    }

    $indexResult = $conn->query("SHOW INDEX FROM Subject WHERE Key_name = 'idx_subject_school_year_id'");
    $hasIndex = $indexResult && $indexResult->num_rows > 0;
    if ($indexResult) {
        $indexResult->free();
    }

    if (!$hasIndex && !$conn->query("ALTER TABLE Subject ADD INDEX idx_subject_school_year_id (school_year_id)")) {
        throw new Exception('Unable to index Subject.school_year_id: ' . $conn->error);
    }

    $fkStmt = $conn->prepare(
        "SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'Subject'
           AND COLUMN_NAME = 'school_year_id'
           AND REFERENCED_TABLE_NAME = 'school_year'
           AND REFERENCED_COLUMN_NAME = 'school_year_id'
         LIMIT 1"
    );
    $fkStmt->execute();
    $fkResult = $fkStmt->get_result();
    $hasFk = $fkResult && $fkResult->num_rows > 0;
    $fkStmt->close();

    if (
        !$hasFk &&
        !$conn->query(
            "ALTER TABLE Subject
             ADD CONSTRAINT fk_subject_school_year
             FOREIGN KEY (school_year_id) REFERENCES school_year(school_year_id)"
        )
    ) {
        throw new Exception('Unable to add Subject.school_year_id foreign key: ' . $conn->error);
    }
}

function getOrCreateSchoolYearId(mysqli $conn, string $label): ?int {
    ensureSchoolYearSchema($conn);

    $label = trim($label);
    if ($label === '') {
        return null;
    }

    $lookup = $conn->prepare("SELECT school_year_id FROM school_year WHERE label = ? LIMIT 1");
    $lookup->bind_param('s', $label);
    $lookup->execute();
    $result = $lookup->get_result();
    $existing = $result ? $result->fetch_assoc() : null;
    $lookup->close();

    if ($existing && isset($existing['school_year_id'])) {
        return (int)$existing['school_year_id'];
    }

    $insert = $conn->prepare("INSERT INTO school_year (label) VALUES (?)");
    $insert->bind_param('s', $label);
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

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    ensureRegistrationLookupData($conn);
    ensureSchoolYearSchema($conn);
    ensureSemesterSchema($conn);

    $columns = [
        'course_id' => "ALTER TABLE Subject ADD COLUMN course_id INT NULL AFTER teacher_user_id",
        'section_id' => "ALTER TABLE Subject ADD COLUMN section_id INT NULL AFTER course_id",
        'year_id' => "ALTER TABLE Subject ADD COLUMN year_id INT NULL AFTER section_id",
        'semester_id' => "ALTER TABLE Subject ADD COLUMN semester_id INT NULL AFTER year_id",
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

    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $fkChecks = [
        'subject_course_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_course_fk FOREIGN KEY (course_id) REFERENCES {$courseTable}(course_id)",
        'subject_section_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_section_fk FOREIGN KEY (section_id) REFERENCES {$sectionTable}(section_id)",
        'subject_year_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_year_fk FOREIGN KEY (year_id) REFERENCES {$yearTable}(year_id)",
        'subject_semester_fk' => "ALTER TABLE Subject ADD CONSTRAINT subject_semester_fk FOREIGN KEY (semester_id) REFERENCES {$semesterTable}(semester_id)",
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
             SET course_id = ?, section_id = ?, year_id = ?
             WHERE subject_id = ?"
        );

        while ($row = $subjectResult->fetch_assoc()) {
            $subjectId = (int)$row['subject_id'];
            $courseId = $row['course_id'] !== null ? (int)$row['course_id'] : null;
            $sectionId = $row['section_id'] !== null ? (int)$row['section_id'] : null;
            $yearId = $row['year_id'] !== null ? (int)$row['year_id'] : null;

            $courseValue = trim((string)($row['course'] ?? ''));
            $sectionValue = trim((string)($row['section'] ?? ''));

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

            $updateStmt->bind_param(
                'iiii',
                $courseIdValue,
                $sectionIdValue,
                $yearIdValue,
                $subjectId
            );
            $updateStmt->execute();
        }

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

    $hasSemesterTextColumn = false;
    $semesterColumnResult = $conn->query("SHOW COLUMNS FROM Subject LIKE 'semester'");
    if ($semesterColumnResult) {
        $hasSemesterTextColumn = $semesterColumnResult->num_rows > 0;
        $semesterColumnResult->free();
    }

    if ($hasSemesterTextColumn) {
        $subjectResult = $conn->query("SELECT subject_id, semester_id, semester FROM Subject");
        if (!$subjectResult) {
            throw new Exception('Unable to inspect subjects for semester backfill: ' . $conn->error);
        }

        $updateStmt = $conn->prepare("UPDATE Subject SET semester_id = ? WHERE subject_id = ?");
        while ($row = $subjectResult->fetch_assoc()) {
            $semesterId = $row['semester_id'] !== null ? (int)$row['semester_id'] : null;
            $semesterValue = trim((string)($row['semester'] ?? ''));

            if ($semesterId !== null || $semesterValue === '') {
                continue;
            }

            $semesterId = getOrCreateSemesterId($conn, $semesterValue);
            if ($semesterId === null) {
                continue;
            }

            $updateStmt->bind_param('ii', $semesterId, $row['subject_id']);
            $updateStmt->execute();
        }
        $updateStmt->close();
        $subjectResult->free();
    }

    $subjectConstraints = [];
    $constraintResult = $conn->query(
        "SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'Subject'
           AND COLUMN_NAME = 'college_id'
           AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    if ($constraintResult) {
        while ($row = $constraintResult->fetch_assoc()) {
            $constraintName = preg_replace('/[^A-Za-z0-9_]/', '', (string)($row['CONSTRAINT_NAME'] ?? ''));
            if ($constraintName !== '') {
                $subjectConstraints[] = $constraintName;
            }
        }
        $constraintResult->free();
    }

    foreach (array_unique($subjectConstraints) as $constraintName) {
        if (!$conn->query("ALTER TABLE Subject DROP FOREIGN KEY {$constraintName}")) {
            throw new Exception("Unable to drop Subject college foreign key {$constraintName}: " . $conn->error);
        }
    }

    $collegeColumnResult = $conn->query("SHOW COLUMNS FROM Subject LIKE 'college_id'");
    $hasCollegeColumn = $collegeColumnResult && $collegeColumnResult->num_rows > 0;
    if ($collegeColumnResult) {
        $collegeColumnResult->free();
    }

    if ($hasCollegeColumn && !$conn->query("ALTER TABLE Subject DROP COLUMN college_id")) {
        throw new Exception('Unable to drop Subject.college_id: ' . $conn->error);
    }
}

function backfillStudentCollegeIds(mysqli $conn): array {
    ensureStudentProfileColumns($conn);

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $roleExpression = getUserRoleNameExpression($conn, 'u');
    $roleJoin = getUserRoleJoinClause($conn, 'u');

    $updateStmt = $conn->prepare(
        "UPDATE {$userTable} u
         {$roleJoin}
         INNER JOIN {$courseTable} c ON c.course_id = u.course_id
         SET u.college_id = c.college_id
         WHERE {$roleExpression} = 'student'
           AND u.course_id IS NOT NULL
           AND c.college_id IS NOT NULL
           AND (u.college_id IS NULL OR u.college_id = 0)"
    );
    $updateStmt->execute();
    $updatedFromCourse = $updateStmt->affected_rows;
    $updateStmt->close();

    $remainingStmt = $conn->prepare(
        "SELECT COUNT(*)
         FROM {$userTable} u
         {$roleJoin}
         WHERE {$roleExpression} = 'student'
           AND (u.college_id IS NULL OR u.college_id = 0)"
    );
    $remainingStmt->execute();
    $remainingResult = $remainingStmt->get_result();
    $remainingRow = $remainingResult ? $remainingResult->fetch_row() : null;
    $remainingNull = $remainingRow[0] ?? 0;
    $remainingStmt->close();

    $summary = [
        'updated_from_course' => max(0, (int)$updatedFromCourse),
        'remaining_null' => (int)$remainingNull,
    ];

    return $summary;
}

function ensureAssessmentDueDate(mysqli $conn): void {
    static $checked = false;
    if ($checked) { return; }
    $checked = true;

    ensureMigrationFlagTable($conn);
    if (migrationsAlreadyRan($conn)) { return; }

    $hasCol = schemaColumnExists($conn, 'Exercises_Problem', 'due_date');
    if (!$hasCol) {
        $conn->query("ALTER TABLE Exercises_Problem ADD COLUMN due_date DATETIME NULL AFTER difficulty");
    }

    $hasStatus = schemaColumnExists($conn, 'Exercises_Problem', 'is_published');
    if (!$hasStatus) {
        $conn->query("ALTER TABLE Exercises_Problem ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER due_date");
    }
}