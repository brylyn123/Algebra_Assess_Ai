USE algebraassess;

-- Final live-database cleanup to align the real tables with database.sql
-- Run this in phpMyAdmin or MySQL after taking a backup.

START TRANSACTION;

ALTER TABLE subject
    MODIFY teacher_id INT NOT NULL,
    ADD COLUMN subject_code VARCHAR(50) UNIQUE NULL AFTER subject_name,
    MODIFY semester VARCHAR(64) NULL,
    ADD COLUMN semester_id INT NULL AFTER year_id,
    MODIFY school_year VARCHAR(64) NULL,
    ADD COLUMN school_year_id INT NULL AFTER school_year,
    MODIFY join_code VARCHAR(20) UNIQUE NULL,
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER archived;

ALTER TABLE year_level
    ADD COLUMN date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER year_level,
    ADD COLUMN date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER date_created;

ALTER TABLE section
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER section_name,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE roles
    ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER role_name,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS school_year (
    school_year_id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(64) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_school_year_label (label)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS semester (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_name VARCHAR(64) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_semester_name (semester_name)
) ENGINE=InnoDB;

INSERT INTO semester (semester_name)
VALUES ('1st Semester'), ('2nd Semester'), ('Summer')
ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name);

INSERT INTO school_year (label)
SELECT DISTINCT TRIM(school_year)
FROM subject
WHERE school_year IS NOT NULL
  AND TRIM(school_year) <> ''
ON DUPLICATE KEY UPDATE label = VALUES(label);

UPDATE subject s
INNER JOIN school_year sy ON sy.label = TRIM(s.school_year)
SET s.school_year_id = sy.school_year_id
WHERE s.school_year_id IS NULL
  AND s.school_year IS NOT NULL
  AND TRIM(s.school_year) <> '';

INSERT INTO semester (semester_name)
SELECT DISTINCT TRIM(semester)
FROM subject
WHERE semester IS NOT NULL
  AND TRIM(semester) <> ''
ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name);

UPDATE subject s
INNER JOIN semester sem ON sem.semester_name = TRIM(s.semester)
SET s.semester_id = sem.semester_id
WHERE s.semester_id IS NULL
  AND s.semester IS NOT NULL
  AND TRIM(s.semester) <> '';

ALTER TABLE subject
    ADD INDEX idx_subject_school_year_id (school_year_id),
    ADD INDEX idx_subject_semester_id (semester_id),
    ADD CONSTRAINT fk_subject_semester FOREIGN KEY (semester_id) REFERENCES semester(semester_id),
    ADD CONSTRAINT fk_subject_school_year FOREIGN KEY (school_year_id) REFERENCES school_year(school_year_id);

ALTER TABLE exercises_problem
    MODIFY difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
    DROP COLUMN IF EXISTS ideal_solution;

ALTER TABLE exercise_items
    MODIFY item_no INT DEFAULT 1,
    MODIFY question_type ENUM('handwritten_algebra') DEFAULT 'handwritten_algebra',
    DROP COLUMN IF EXISTS options,
    MODIFY max_score DECIMAL(5,2) DEFAULT 0.00,
    CHANGE COLUMN date_created created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE rubric_sets
    MODIFY level_definitions JSON NULL;

ALTER TABLE captured_solution
    MODIFY ai_raw_json JSON NULL;

ALTER TABLE scores
    MODIFY date_scored TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS item_rubric_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    rubric_set_id INT NOT NULL,
    CONSTRAINT fk_mapping_item FOREIGN KEY (item_id) REFERENCES exercise_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_mapping_rubric FOREIGN KEY (rubric_set_id) REFERENCES rubric_sets(rubric_set_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_scores (
    item_score_id INT PRIMARY KEY AUTO_INCREMENT,
    solution_id INT NOT NULL,
    item_id INT NOT NULL,
    score_earned DECIMAL(5,2) DEFAULT 0.00,
    ai_feedback TEXT,
    is_manual_override BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (solution_id) REFERENCES captured_solution(solution_id),
    FOREIGN KEY (item_id) REFERENCES exercise_items(item_id)
) ENGINE=InnoDB;

COMMIT;
