CREATE DATABASE IF NOT EXISTS algebraassess;
USE algebraassess;

-- Disable checks to allow clean wiping of tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `Score`, `Rubrics`, `Captured_Solution`, `Exercises_items`, `Exercises_Problem`, `Subject`, `Student`, `Section`, `Teacher`, `Year`, `College`, `Users`, `Course`;
SET FOREIGN_KEY_CHECKS = 1;


-- 1. Create College (Parent of Teacher and Year)
CREATE TABLE College (
    college_id INT PRIMARY KEY,
    college_name VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- 2. Create Users (Parent of Teacher and Student)
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50)
) ENGINE=InnoDB;

-- 3. Create Year (Parent of Student)
CREATE TABLE Year (
    year_id INT PRIMARY KEY,
    college_id INT,
    year_level VARCHAR(50),
    CONSTRAINT fk_year_college FOREIGN KEY (college_id) REFERENCES College(college_id)
) ENGINE=InnoDB;

-- 4. Create Teacher (Parent of Section and Subject)
CREATE TABLE Teacher (
    teacher_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    password VARCHAR(255),
    college_id INT,
    user_id INT,
    CONSTRAINT fk_teacher_college FOREIGN KEY (college_id) REFERENCES College(college_id),
    CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
) ENGINE=InnoDB;

-- 5. Create Section (Parent of Student)
CREATE TABLE Section (
    section_id INT PRIMARY KEY,
    section_name VARCHAR(100),
    teacher_id INT,
    CONSTRAINT fk_section_teacher FOREIGN KEY (teacher_id) REFERENCES Teacher(teacher_id)
) ENGINE=InnoDB;

-- 6. Create Student (Parent of Subject and Captured_Solution)
CREATE TABLE Student (
    student_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    user_id INT,
    section_id INT,
    year_id INT,
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES Users(user_id),
    CONSTRAINT fk_student_section FOREIGN KEY (section_id) REFERENCES Section(section_id),
    CONSTRAINT fk_student_year FOREIGN KEY (year_id) REFERENCES Year(year_id)
) ENGINE=InnoDB;

-- 7. Create Subject (Parent of Exercises_Problem)
CREATE TABLE Subject (
    subject_id INT PRIMARY KEY,
    subject_name VARCHAR(255),
    teacher_id INT,
    course VARCHAR(255),
    year INT,
    section VARCHAR(255),
    CONSTRAINT fk_subject_teacher FOREIGN KEY (teacher_id) REFERENCES Teacher(teacher_id),
) ENGINE=InnoDB;

-- 8. Create Exercises/Problem (Parent of Exercise_Items and Captured_Solution)
CREATE TABLE Exercises_Problem (
    exercise_id INT PRIMARY KEY,
    subject_id INT,
    title VARCHAR(255),
    description TEXT,
    topic VARCHAR(255),
    date_created DATE,
    CONSTRAINT fk_exercise_subject FOREIGN KEY (subject_id) REFERENCES Subject(subject_id)
) ENGINE=InnoDB;

-- 9. Create Exercise Items (Parent of Rubrics)
CREATE TABLE Exercises_items (
    item_id INT PRIMARY KEY,
    exercise_id INT,
    item_no INT,
    score_per_item DECIMAL(10,2),
    max_score_per_item DECIMAL(10,2),
    question_type VARCHAR(50),
    question_content TEXT,
    options TEXT,
    correct_answer VARCHAR(255),
    CONSTRAINT fk_item_exercise FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id)
) ENGINE=InnoDB;

-- 10. Create Rubrics
CREATE TABLE Rubrics (
    rubric_id INT PRIMARY KEY,
    item_id INT,
    criteria_name VARCHAR(255),
    points INT,
    description TEXT,
    CONSTRAINT fk_rubric_item FOREIGN KEY (item_id) REFERENCES Exercises_items(item_id)
) ENGINE=InnoDB;

-- 11. Create Captured Solution (Parent of Score)
CREATE TABLE Captured_Solution (
    solution_id INT PRIMARY KEY,
    student_id VARCHAR(50),
    exercise_id INT,
    file_name VARCHAR(255),
    ocr_text TEXT,
    date_uploaded DATETIME,
    CONSTRAINT fk_solution_student FOREIGN KEY (student_id) REFERENCES Student(student_id),
    CONSTRAINT fk_solution_exercise FOREIGN KEY (exercise_id) REFERENCES Exercises_Problem(exercise_id)
) ENGINE=InnoDB;

-- 12. Create Score
CREATE TABLE Score (
    score_id INT PRIMARY KEY,
    solution_id INT,
    total_score_earned DECIMAL(10,2),
    feedback TEXT,
    date_scored DATETIME,
    CONSTRAINT fk_score_solution FOREIGN KEY (solution_id) REFERENCES Captured_Solution(solution_id)
) ENGINE=InnoDB;

-- 13. Create Course
CREATE TABLE Enrollments (
    enrollment_id INT PRIMARY KEY,
    subject_id INT,
    student_id INT(50),
    date_enrolled DATETIME,
    CONSTRAINT fk_enrollment_subject FOREIGN KEY (subject_id) REFERENCES Subject(subject_id),
    CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES Student(student_id)
) ENGINE=InnoDB;