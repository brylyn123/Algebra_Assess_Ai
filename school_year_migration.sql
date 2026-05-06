USE algebraassess;

START TRANSACTION;

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

ALTER TABLE subject
    ADD COLUMN IF NOT EXISTS school_year_id INT NULL AFTER school_year;

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

ALTER TABLE subject
    ADD INDEX idx_subject_school_year_id (school_year_id),
    ADD CONSTRAINT fk_subject_school_year FOREIGN KEY (school_year_id) REFERENCES school_year(school_year_id);

COMMIT;
