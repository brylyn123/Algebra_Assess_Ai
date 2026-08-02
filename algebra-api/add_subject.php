<?php
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

function ensureArchivedColumn($conn) {
    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    $columnCheck = $conn->query("SHOW COLUMNS FROM {$subjectTable} LIKE 'archived'");
    if ($columnCheck && $columnCheck->num_rows === 0) {
        $conn->query("ALTER TABLE {$subjectTable} ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0");
    }
}

// 1. Get the data from React
$data = json_decode(file_get_contents("php://input"), true);

function generateJoinCode($length = 6) {
    $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= $characters[random_int(0, strlen($characters) - 1)];
    }
    return $code;
}

// 2. Extract and Validate
$subject_name = $data['subject_name'] ?? '';
$courseId     = isset($data['course_id']) ? intval($data['course_id']) : 0;
$yearId       = isset($data['year_id']) ? intval($data['year_id']) : 0;
$sectionId    = isset($data['section_id']) ? intval($data['section_id']) : 0;
$school_year  = $data['school_year'] ?? '';
$semester     = $data['semester'] ?? '';
$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id   = (int)$authUser['user_id'];
$join_code    = trim($data['join_code'] ?? '');

if (empty($join_code)) {
    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    do {
        $join_code = generateJoinCode();
        $checkStmt = $conn->prepare("SELECT 1 FROM {$subjectTable} WHERE join_code = ? LIMIT 1");
        $checkStmt->bind_param("s", $join_code);
        $checkStmt->execute();
        $checkStmt->store_result();
        $exists = $checkStmt->num_rows > 0;
        $checkStmt->close();
    } while ($exists);
}

// Check if critical data is missing
if (empty($subject_name)) {
    echo json_encode(["status" => "error", "message" => "Subject name is missing."]);
    exit;
}

// 3. Prepared Statement
try {
    ensureArchivedColumn($conn);
    ensureSubjectLookupColumns($conn);
    ensureSemesterSchema($conn);
    $school_year = trim((string)$school_year);
    $schoolYearId = getOrCreateSchoolYearId($conn, $school_year);
    $semester = trim((string)$semester);
    $semesterId = getOrCreateSemesterId($conn, $semester);

    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);

    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $teacherStmt = $conn->prepare("SELECT college_id FROM {$userTable} WHERE user_id = ? LIMIT 1");
    $teacherStmt->bind_param("i", $teacher_id);
    $teacherStmt->execute();
    $teacherResult = $teacherStmt->get_result();
    $teacherRow = $teacherResult ? $teacherResult->fetch_assoc() : null;
    $teacherStmt->close();
    if (!$teacherRow || !userHasRole($conn, (int)$teacher_id, 'teacher')) {
        throw new Exception("Teacher not found.");
    }
    $teacherCollegeId = ($teacherRow && $teacherRow['college_id'] !== null) ? (int)$teacherRow['college_id'] : null;

    if ($courseId > 0) {
        $courseStmt = $conn->prepare("SELECT course_id, college_id FROM {$courseTable} WHERE course_id = ? LIMIT 1");
        $courseStmt->bind_param("i", $courseId);
        $courseStmt->execute();
        $courseResult = $courseStmt->get_result();
        $courseRow = $courseResult ? $courseResult->fetch_assoc() : null;
        $courseStmt->close();
        if (!$courseRow) {
            throw new Exception("Selected course was not found.");
        }

        $courseCollegeId = $courseRow['college_id'] !== null ? (int)$courseRow['college_id'] : null;
        if ($teacherCollegeId !== null && $courseCollegeId === null) {
            $updateCourseCollegeStmt = $conn->prepare("UPDATE {$courseTable} SET college_id = ? WHERE course_id = ? AND college_id IS NULL");
            $updateCourseCollegeStmt->bind_param("ii", $teacherCollegeId, $courseId);
            $updateCourseCollegeStmt->execute();
            $updateCourseCollegeStmt->close();
        } elseif ($teacherCollegeId !== null && $courseCollegeId !== null && $courseCollegeId !== $teacherCollegeId) {
            throw new Exception("Selected course does not belong to the teacher's college.");
        }
    }

    if ($sectionId > 0) {
        $sectionStmt = $conn->prepare("SELECT section_id, section_name FROM {$sectionTable} WHERE section_id = ? LIMIT 1");
        $sectionStmt->bind_param("i", $sectionId);
        $sectionStmt->execute();
        $sectionResult = $sectionStmt->get_result();
        $sectionRow = $sectionResult ? $sectionResult->fetch_assoc() : null;
        $sectionStmt->close();
        if (!$sectionRow) {
            throw new Exception("Selected section was not found.");
        }
    }

    if ($yearId > 0) {
        $yearStmt = $conn->prepare("SELECT year_id, year_level FROM {$yearTable} WHERE year_id = ? LIMIT 1");
        $yearStmt->bind_param("i", $yearId);
        $yearStmt->execute();
        $yearResult = $yearStmt->get_result();
        $yearRow = $yearResult ? $yearResult->fetch_assoc() : null;
        $yearStmt->close();
        if (!$yearRow) {
            throw new Exception("Selected year level was not found.");
        }
    }

    if ($courseId <= 0 || $sectionId <= 0 || $yearId <= 0) {
        throw new Exception("Please choose a course, section, and year level.");
    }

    $stmt = $conn->prepare(
        "INSERT INTO {$subjectTable} (
            subject_name,
            course_id,
            section_id,
            year_id,
            semester_id,
            school_year,
            school_year_id,
            semester,
            teacher_user_id,
            join_code,
            archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"
    );

    $stmt->bind_param(
        "siiiisisis",
        $subject_name,
        $courseId,
        $sectionId,
        $yearId,
        $semesterId,
        $school_year,
        $schoolYearId,
        $semester,
        $teacher_id,
        $join_code
    );
    
    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success", 
                "message" => "Subject added!",
                "join_code" => $join_code,
                "course_id" => $courseId,
                "section_id" => $sectionId,
                "year_id" => $yearId,
                "school_year" => $school_year,
                "semester" => $semester
            ]); 
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to add subject."]);
    }

    $stmt->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to add subject: " . $e->getMessage()]);
}

$conn->close();
?>
