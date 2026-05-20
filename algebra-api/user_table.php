<?php
function ensure_users_table($conn)
{
    $roleSql = "
        CREATE TABLE IF NOT EXISTS roles (
            role_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(50) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    if (!$conn->query($roleSql)) {
        throw new RuntimeException("Unable to create roles table: " . $conn->error);
    }

    foreach (['admin', 'teacher', 'student'] as $roleName) {
        $stmt = $conn->prepare(
            "INSERT INTO roles (role_name)
             VALUES (?)
             ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)"
        );
        $stmt->bind_param('s', $roleName);
        $stmt->execute();
        $stmt->close();
    }

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
            role_id INT UNSIGNED NOT NULL,
            account_status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    if (!$conn->query($sql)) {
        throw new RuntimeException("Unable to create users table: " . $conn->error);
    }
}
