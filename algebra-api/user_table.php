<?php
function ensure_users_table($conn)
{
    $sql = "
        CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('teacher','student') NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            middle_name VARCHAR(100),
            last_name VARCHAR(100) NOT NULL,
            employee_id VARCHAR(64),
            student_id VARCHAR(64),
            college_name VARCHAR(150),
            section_name VARCHAR(150),
            year_level VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    if (!$conn->query($sql)) {
        throw new RuntimeException("Unable to create users table: " . $conn->error);
    }
}
