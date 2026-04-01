CREATE DATABASE IF NOT EXISTS algebraassess;
USE algebraassess;

-- Disable checks to allow clean wiping of tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `Scores`, `Item_Scores`, `Captured_Solution`, `item_rubric_mapping`, 
                     `rubric_set_items`, `rubric_sets`, `Exercise_Items`, `Exercises_Problem`, 
                     `Enrollment`, `Subject`, `Student`, `Teacher`, `Users`, `Course`, `Colleges`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Organizations & Structure
CREATE TABLE Colleges (
    college_id INT PRIMARY KEY AUTO_INCREMENT,
    college_name VARCHAR(255) NOT NULL
);

CREATE TABLE Course (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50) UNIQUE NOT NULL,
    college_id INT,
    FOREIGN KEY (college_id) REFERENCES Colleges(college_id)
);

-- 2. User Management
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'teacher', 'student') NOT NULL
);

CREATE TABLE Teacher (
    teacher_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    college_id INT,
    user_id INT,
    FOREIGN KEY (college_id) REFERENCES Colleges(college_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Student (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    college_id INT,
    course_id INT,
    section_id INT,
    year_id INT,
    user_id INT,
    FOREIGN KEY (college_id) REFERENCES Colleges(college_id),
    FOREIGN KEY (course_id) REFERENCES Course(course_id),
    FOREIGN KEY (section_id) REFERENCES Section(section_id),
    FOREIGN KEY (year_id) REFERENCES Year_Level(year_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- 3. Academic Calendar & Organization
CREATE TABLE School_Year (
    school_year_id INT PRIMARY KEY AUTO_INCREMENT,
    start_year YEAR NOT NULL,
    end_year YEAR NOT NULL,
    label VARCHAR(50)
);

CREATE TABLE Semester (
    semester_id INT PRIMARY KEY AUTO_INCREMENT,
    semester_name VARCHAR(50) NOT NULL
);

CREATE TABLE Year_Level (
    year_id INT PRIMARY KEY AUTO_INCREMENT,
    year_level VARCHAR(50) NOT NULL
);

CREATE TABLE Section (
    section_id INT PRIMARY KEY AUTO_INCREMENT,
    section_name VARCHAR(50) NOT NULL
);

CREATE TABLE Subject (
    subject_id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    course_id INT,
    section_id INT,
    year_id INT,
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(50) UNIQUE,
    semester VARCHAR(64),   
    school_year VARCHAR(64),
    join_code VARCHAR(20) UNIQUE,
    archived TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES Teacher(teacher_id),
    FOREIGN KEY (course_id) REFERENCES Course(course_id),
    FOREIGN KEY (section_id) REFERENCES Section(section_id),
    FOREIGN KEY (year_id) REFERENCES Year_Level(year_id)
);

-- 4. Class Instances
CREATE TABLE Enrollment (
    enrollment_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    date_enrolled DATE DEFAULT (CURRENT_DATE),
    enrollment_status ENUM('enrolled', 'dropped') DEFAULT 'enrolled',
    FOREIGN KEY (student_id) REFERENCES Student(student_id),
    FOREIGN KEY (subject_id) REFERENCES Subject(subject_id)
);

-- 5. Assessments & Items
CREATE TABLE Exercises_Problem (
    exercise_id INT PRIMARY KEY AUTO_INCREMENT,
    subject_id INT NOT NULL,
    rubric_set_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    topic VARCHAR(100),
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES Subject(subject_id)
);

CREATE TABLE Exercise_Items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    exercise_id INT NOT NULL,
    item_label VARCHAR(100),
    prompt TEXT,
    max_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 6. Rubrics (Reusable)
CREATE TABLE rubric_sets (
    rubric_set_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    rubric_name VARCHAR(255) NOT NULL,
    global_instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rubric_sets_teacher FOREIGN KEY (teacher_id) REFERENCES Teacher(teacher_id)
) ENGINE=InnoDB;

CREATE TABLE rubric_set_items (
    rubric_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rubric_set_id INT NOT NULL,
    description TEXT NOT NULL,
    points DECIMAL(5,2) NOT NULL,
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
    student_id INT NOT NULL,
    file_path VARCHAR(255),
    ocr_text TEXT,
    ai_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    ai_raw_json JSON,
    date_uploaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id),
    FOREIGN KEY (student_id) REFERENCES Student(student_id)
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
    date_scored TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solution_id) REFERENCES Captured_Solution(solution_id)
) ENGINE=InnoDB;
