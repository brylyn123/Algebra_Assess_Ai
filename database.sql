CREATE DATABASE IF NOT EXISTS algebraassess;
USE algebraassess;

-- Disable checks to allow clean wiping of tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `Scores`, `Item_Scores`, `Captured_Solution`, `item_rubric_mapping`,
                     `rubric_set_items`, `rubric_sets`, `Exercise_Items`, `Exercises_Problem`,
                     `Enrollment`, `Subject`, `Users`, `roles`, `Course`, `Section`, `Semester`,
                     `School_Year`, `Year_Level`, `Colleges`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Organizations & Structure
CREATE TABLE Colleges (
    college_id INT PRIMARY KEY AUTO_INCREMENT,
    college_name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Year_Level (
    year_id INT PRIMARY KEY AUTO_INCREMENT,
    year_level VARCHAR(50) NOT NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Section (
    section_id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Course (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50) UNIQUE NOT NULL,
    college_id INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_college FOREIGN KEY (college_id) REFERENCES Colleges(college_id)
) ENGINE=InnoDB;

-- 2. User Management
CREATE TABLE roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO roles (role_name) VALUES
    ('admin'),
    ('teacher'),
    ('student');

CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    institutional_id VARCHAR(64) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    college_id INT,
    course_id INT,
    section_id INT,
    year_id INT,
    role_id INT NOT NULL,
    account_status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES Colleges(college_id),
    CONSTRAINT fk_users_course FOREIGN KEY (course_id) REFERENCES Course(course_id),
    CONSTRAINT fk_users_section FOREIGN KEY (section_id) REFERENCES Section(section_id),
    CONSTRAINT fk_users_year FOREIGN KEY (year_id) REFERENCES Year_Level(year_id)
) ENGINE=InnoDB;

-- 3. Academic Calendar & Organization
CREATE TABLE School_Year (
    school_year_id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(64) NOT NULL UNIQUE,
    start_date DATE NULL,
    end_date DATE NULL,
    is_active TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Semester (
    semester_id INT PRIMARY KEY AUTO_INCREMENT,
    semester_name VARCHAR(64) NOT NULL UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Subject (
    subject_id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_user_id INT NOT NULL,
    course_id INT,
    section_id INT,
    year_id INT,
    semester_id INT,
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(50) UNIQUE,
    semester VARCHAR(64),
    school_year VARCHAR(64),
    school_year_id INT,
    join_code VARCHAR(20) UNIQUE,
    archived TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_subject_teacher_user FOREIGN KEY (teacher_user_id) REFERENCES Users(user_id),
    CONSTRAINT fk_subject_course FOREIGN KEY (course_id) REFERENCES Course(course_id),
    CONSTRAINT fk_subject_section FOREIGN KEY (section_id) REFERENCES Section(section_id),
    CONSTRAINT fk_subject_year FOREIGN KEY (year_id) REFERENCES Year_Level(year_id),
    CONSTRAINT fk_subject_semester FOREIGN KEY (semester_id) REFERENCES Semester(semester_id),
    CONSTRAINT fk_subject_school_year FOREIGN KEY (school_year_id) REFERENCES School_Year(school_year_id)
) ENGINE=InnoDB;

-- 4. Class Instances
CREATE TABLE Enrollment (
    enrollment_id INT PRIMARY KEY AUTO_INCREMENT,
    student_user_id INT NOT NULL,
    subject_id INT NOT NULL,
    date_enrolled DATE DEFAULT (CURRENT_DATE),
    enrollment_status ENUM('enrolled', 'dropped') DEFAULT 'enrolled',
    UNIQUE KEY uq_enrollment_student_subject (student_user_id, subject_id),
    CONSTRAINT fk_enrollment_student_user FOREIGN KEY (student_user_id) REFERENCES Users(user_id),
    CONSTRAINT fk_enrollment_subject FOREIGN KEY (subject_id) REFERENCES Subject(subject_id)
) ENGINE=InnoDB;

-- 5. Assessments & Items
CREATE TABLE Exercises_Problem (
    exercise_id INT PRIMARY KEY AUTO_INCREMENT,
    subject_id INT NOT NULL,
    rubric_set_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    topic VARCHAR(100),
    difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
    due_date DATETIME NULL,
    is_published TINYINT(1) DEFAULT 1,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_exercises_problem_subject FOREIGN KEY (subject_id) REFERENCES Subject(subject_id)
) ENGINE=InnoDB;

CREATE TABLE Exercise_Items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    exercise_id INT NOT NULL,
    item_no INT DEFAULT 1,
    question_type ENUM('handwritten_algebra') DEFAULT 'handwritten_algebra',
    question_content TEXT NOT NULL,
    model_solution TEXT,
    max_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Rubrics (Reusable)
CREATE TABLE rubric_sets (
    rubric_set_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_user_id INT NOT NULL,
    rubric_name VARCHAR(255) NOT NULL,
    criteria TEXT NOT NULL,
    ai_instructions TEXT,
    level_definitions JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rubric_sets_teacher_user FOREIGN KEY (teacher_user_id) REFERENCES Users(user_id)
) ENGINE=InnoDB;

ALTER TABLE Exercises_Problem
ADD CONSTRAINT fk_exercises_problem_rubric_set
FOREIGN KEY (rubric_set_id) REFERENCES rubric_sets(rubric_set_id)
ON DELETE SET NULL;

CREATE TABLE rubric_set_items (
    rubric_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rubric_set_id INT NOT NULL,
    description TEXT NOT NULL,
    points DECIMAL(5,2) NOT NULL,
    min_points DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_rubric_set_item_set FOREIGN KEY (rubric_set_id) REFERENCES rubric_sets(rubric_set_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE item_rubric_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    rubric_set_id INT NOT NULL,
    CONSTRAINT fk_mapping_item FOREIGN KEY (item_id) REFERENCES Exercise_Items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_mapping_rubric FOREIGN KEY (rubric_set_id) REFERENCES rubric_sets(rubric_set_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Submissions & AI Scoring
CREATE TABLE Captured_Solution (
    solution_id INT PRIMARY KEY AUTO_INCREMENT,
    exercise_id INT NOT NULL,
    student_user_id INT NOT NULL,
    file_path VARCHAR(255),
    ocr_text TEXT,
    ai_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    ai_raw_json JSON,
    date_uploaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id),
    FOREIGN KEY (student_user_id) REFERENCES Users(user_id)
) ENGINE=InnoDB;

CREATE TABLE Item_Scores (
    item_score_id INT PRIMARY KEY AUTO_INCREMENT,
    solution_id INT NOT NULL,
    item_id INT NOT NULL,
    score_earned DECIMAL(5,2) DEFAULT 0.00,
    ai_feedback TEXT,
    is_manual_override BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (solution_id) REFERENCES Captured_Solution(solution_id),
    FOREIGN KEY (item_id) REFERENCES Exercise_Items(item_id)
) ENGINE=InnoDB;

CREATE TABLE Scores (
    score_id INT PRIMARY KEY AUTO_INCREMENT,
    solution_id INT NOT NULL,
    total_score_earned DECIMAL(5,2),
    raw_score_earned DECIMAL(10,2),
    max_score_possible DECIMAL(10,2),
    ai_feedback TEXT,
    returned_at DATETIME NULL,
    date_scored TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_scores_solution (solution_id),
    FOREIGN KEY (solution_id) REFERENCES Captured_Solution(solution_id)
) ENGINE=InnoDB;

-- 8. Performance Indexes
CREATE INDEX idx_users_role_id ON Users(role_id);
CREATE INDEX idx_users_account_status ON Users(account_status);
CREATE INDEX idx_users_college_id ON Users(college_id);
CREATE INDEX idx_users_course_id ON Users(course_id);
CREATE INDEX idx_subject_teacher_user_id ON Subject(teacher_user_id);
CREATE INDEX idx_subject_school_year_id ON Subject(school_year_id);
CREATE INDEX idx_subject_semester_id ON Subject(semester_id);
CREATE INDEX idx_enrollment_subject_id ON Enrollment(subject_id);
CREATE INDEX idx_enrollment_student_user_id ON Enrollment(student_user_id);
CREATE INDEX idx_exercises_problem_subject_id ON Exercises_Problem(subject_id);
CREATE INDEX idx_exercise_items_exercise_id ON Exercise_Items(exercise_id);
CREATE INDEX idx_captured_solution_student_user_id ON Captured_Solution(student_user_id);
CREATE INDEX idx_captured_solution_exercise_id ON Captured_Solution(exercise_id);
CREATE INDEX idx_captured_solution_ai_status ON Captured_Solution(ai_status);
CREATE INDEX idx_item_scores_solution_id ON Item_Scores(solution_id);
CREATE INDEX idx_item_scores_item_id ON Item_Scores(item_id);
CREATE INDEX idx_scores_returned_at ON Scores(returned_at);
