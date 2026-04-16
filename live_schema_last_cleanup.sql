USE algebraassess;

-- Final live-database cleanup to align the real tables with database.sql
-- Run this in phpMyAdmin or MySQL after taking a backup.

START TRANSACTION;

ALTER TABLE subject
    MODIFY teacher_id INT NOT NULL,
    ADD COLUMN subject_code VARCHAR(50) UNIQUE NULL AFTER subject_name,
    MODIFY semester VARCHAR(64) NULL,
    MODIFY school_year VARCHAR(64) NULL,
    MODIFY join_code VARCHAR(20) UNIQUE NULL,
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER archived;

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
