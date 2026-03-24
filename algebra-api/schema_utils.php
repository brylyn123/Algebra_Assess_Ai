<?php
function getEnrollmentSubjectColumn(mysqli $conn): string {
    static $column = null;

    if ($column !== null) {
        return $column;
    }

    $preferred = 'subject_id';
    $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$preferred'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        $column = $preferred;
        return $column;
    }

    $fallback = 'offering_id';
    $result = $conn->query("SHOW COLUMNS FROM Enrollment LIKE '$fallback'");
    if ($result && $result->num_rows > 0) {
        $result->free();
        $column = $fallback;
        return $column;
    }

    throw new Exception('Enrollment table is missing the subject identifier column.');
}
