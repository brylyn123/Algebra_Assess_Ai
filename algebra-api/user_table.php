<?php
function ensure_users_table($conn)
{
    $sql = "
        CREATE TABLE IF NOT EXISTS users (
            user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            institutional_id VARCHAR(64) UNIQUE,
            first_name VARCHAR(100) NOT NULL,
            middle_name VARCHAR(100),
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            college_id INT NULL,
            course_id INT NULL,
            section_id INT NULL,
            year_id INT NULL,
            role ENUM('admin','teacher','student') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    if (!$conn->query($sql)) {
        throw new RuntimeException("Unable to create users table: " . $conn->error);
    }
}
