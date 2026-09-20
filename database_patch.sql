USE algebraassess;

-- Add is_active to Colleges if it does not already exist.
SET @college_is_active_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Colleges'
      AND COLUMN_NAME = 'is_active'
);
SET @add_college_is_active_sql := IF(
    @college_is_active_exists = 0,
    'ALTER TABLE Colleges ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER college_name',
    'SELECT ''Colleges.is_active already exists'' AS message'
);
PREPARE stmt FROM @add_college_is_active_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add audit columns to Colleges if they do not already exist.
SET @college_created_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Colleges'
      AND COLUMN_NAME = 'created_at'
);
SET @add_college_created_sql := IF(
    @college_created_exists = 0,
    'ALTER TABLE Colleges ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER college_name',
    'SELECT ''Colleges.created_at already exists'' AS message'
);
PREPARE stmt FROM @add_college_created_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @college_updated_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Colleges'
      AND COLUMN_NAME = 'updated_at'
);
SET @add_college_updated_sql := IF(
    @college_updated_exists = 0,
    'ALTER TABLE Colleges ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''Colleges.updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_college_updated_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_active to Course if it does not already exist.
SET @course_is_active_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Course'
      AND COLUMN_NAME = 'is_active'
);
SET @add_course_is_active_sql := IF(
    @course_is_active_exists = 0,
    'ALTER TABLE Course ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER college_id',
    'SELECT ''Course.is_active already exists'' AS message'
);
PREPARE stmt FROM @add_course_is_active_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add audit columns to Course if they do not already exist.
SET @course_created_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Course'
      AND COLUMN_NAME = 'created_at'
);
SET @add_course_created_sql := IF(
    @course_created_exists = 0,
    'ALTER TABLE Course ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER college_id',
    'SELECT ''Course.created_at already exists'' AS message'
);
PREPARE stmt FROM @add_course_created_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @course_updated_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Course'
      AND COLUMN_NAME = 'updated_at'
);
SET @add_course_updated_sql := IF(
    @course_updated_exists = 0,
    'ALTER TABLE Course ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''Course.updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_course_updated_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add audit columns to Section if they do not already exist.
SET @section_created_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Section'
      AND COLUMN_NAME = 'created_at'
);
SET @add_section_created_sql := IF(
    @section_created_exists = 0,
    'ALTER TABLE Section ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER section_name',
    'SELECT ''Section.created_at already exists'' AS message'
);
PREPARE stmt FROM @add_section_created_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @section_updated_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Section'
      AND COLUMN_NAME = 'updated_at'
);
SET @add_section_updated_sql := IF(
    @section_updated_exists = 0,
    'ALTER TABLE Section ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''Section.updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_section_updated_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add soft-delete flag to roles if it does not already exist.
SET @roles_is_deleted_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'roles'
      AND COLUMN_NAME = 'is_deleted'
);
SET @add_roles_is_deleted_sql := IF(
    @roles_is_deleted_exists = 0,
    'ALTER TABLE roles ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER role_name',
    'SELECT ''roles.is_deleted already exists'' AS message'
);
PREPARE stmt FROM @add_roles_is_deleted_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @roles_updated_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'roles'
      AND COLUMN_NAME = 'updated_at'
);
SET @add_roles_updated_sql := IF(
    @roles_updated_exists = 0,
    'ALTER TABLE roles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''roles.updated_at already exists'' AS message'
);
PREPARE stmt FROM @add_roles_updated_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for duplicate enrollments before adding the unique key.
SELECT student_user_id, subject_id, COUNT(*) AS duplicate_count
FROM Enrollment
GROUP BY student_user_id, subject_id
HAVING COUNT(*) > 1;

-- Check for duplicate score rows before adding the unique key.
SELECT solution_id, COUNT(*) AS duplicate_count
FROM Scores
GROUP BY solution_id
HAVING COUNT(*) > 1;

-- Add returned_at only if it does not already exist.
SET @returned_at_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Scores'
      AND COLUMN_NAME = 'returned_at'
);
SET @add_returned_at_sql := IF(
    @returned_at_exists = 0,
    'ALTER TABLE Scores ADD COLUMN returned_at DATETIME NULL AFTER ai_feedback',
    'SELECT ''Scores.returned_at already exists'' AS message'
);
PREPARE stmt FROM @add_returned_at_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill returned_at for already-scored rows.
UPDATE Scores
SET returned_at = COALESCE(returned_at, date_scored, CURRENT_TIMESTAMP)
WHERE returned_at IS NULL;

-- Add unique constraint to Enrollment only if it does not already exist.
SET @enrollment_unique_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Enrollment'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'uq_enrollment_student_subject'
);
SET @add_enrollment_unique_sql := IF(
    @enrollment_unique_exists = 0,
    'ALTER TABLE Enrollment ADD CONSTRAINT uq_enrollment_student_subject UNIQUE (student_user_id, subject_id)',
    'SELECT ''Enrollment unique constraint already exists'' AS message'
);
PREPARE stmt FROM @add_enrollment_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique constraint to Scores only if it does not already exist.
SET @scores_unique_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Scores'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'uq_scores_solution'
);
SET @add_scores_unique_sql := IF(
    @scores_unique_exists = 0,
    'ALTER TABLE Scores ADD CONSTRAINT uq_scores_solution UNIQUE (solution_id)',
    'SELECT ''Scores unique constraint already exists'' AS message'
);
PREPARE stmt FROM @add_scores_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create assessment_subjects join table for multi-subject assessments
CREATE TABLE IF NOT EXISTS assessment_subjects (
    assessment_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (assessment_id, subject_id),
    FOREIGN KEY (assessment_id) REFERENCES Exercises_Problem(exercise_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subject(subject_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Notifications table
CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    sender_user_id INT,
    type ENUM('assessment_created', 'assessment_submitted', 'grade_returned') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INT,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user_unread (user_id, is_read),
    INDEX idx_notifications_created_at (created_at)
) ENGINE=InnoDB;

SET @notif_fk_user_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notifications'
      AND CONSTRAINT_NAME = 'fk_notifications_user'
);
SET @add_notif_fk_user_sql := IF(
    @notif_fk_user_exists = 0,
    'ALTER TABLE Notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES Users(user_id)',
    'SELECT ''fk_notifications_user already exists'' AS message'
);
PREPARE stmt FROM @add_notif_fk_user_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @notif_fk_sender_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Notifications'
      AND CONSTRAINT_NAME = 'fk_notifications_sender'
);
SET @add_notif_fk_sender_sql := IF(
    @notif_fk_sender_exists = 0,
    'ALTER TABLE Notifications ADD CONSTRAINT fk_notifications_sender FOREIGN KEY (sender_user_id) REFERENCES Users(user_id)',
    'SELECT ''fk_notifications_sender already exists'' AS message'
);
PREPARE stmt FROM @add_notif_fk_sender_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
