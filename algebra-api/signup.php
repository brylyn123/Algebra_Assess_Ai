<?php
require_once 'cors.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

// 3. Get the JSON payload
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "No data provided."]);
    exit();
}

// Extract variables from the React payload
$firstName  = $data['firstName'] ?? '';
$middleName = $data['middleName'] ?? '';
$lastName   = $data['lastName'] ?? '';
$email      = $data['email'] ?? '';
$password = password_hash($data['password'] ?? '', PASSWORD_BCRYPT); // In production, use password_hash()
$role       = $data['role'] ?? '';
$idNumber   = $data['idNumber'] ?? '';
$collegeIdFromPayload = isset($data['collegeId']) ? intval($data['collegeId']) : 0;
$courseId   = isset($data['courseId']) ? intval($data['courseId']) : 0;
$sectionId  = isset($data['sectionId']) ? intval($data['sectionId']) : 0;
$yearId     = isset($data['yearId']) ? intval($data['yearId']) : 0;

// 4. Start Database Transaction
$conn->begin_transaction();

try {
    ensureRegistrationLookupData($conn);
    $roleId = getRoleIdByName($conn, $role);
    if ($roleId === null) {
        throw new Exception("Selected role was not found.");
    }
    ensureUserAccountStatusSchema($conn);

    $collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $yearTable = resolveExistingTableName($conn, ['Year_Level', 'year']);
    $userTable = resolveExistingTableName($conn, ['Users', 'users']);
    $hasLegacyRoleColumn = schemaColumnExists($conn, $userTable, 'role');

    // Check if email exists
    $check = $conn->prepare("SELECT email FROM {$userTable} WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        throw new Exception("Email already registered.");
    }

    $collegeId = null;
    if ($collegeIdFromPayload > 0) {
        $collegeStmt = $conn->prepare("SELECT college_id, college_name FROM {$collegeTable} WHERE college_id = ? LIMIT 1");
        $collegeStmt->bind_param("i", $collegeIdFromPayload);
        $collegeStmt->execute();
        $collegeResult = $collegeStmt->get_result();
        $collegeRow = $collegeResult ? $collegeResult->fetch_assoc() : null;
        $collegeStmt->close();

        if (!$collegeRow) {
            throw new Exception("Selected college was not found.");
        }

        $collegeId = (int)$collegeRow['college_id'];
    }

    if ($role === 'teacher') {
        if ($collegeId === null) {
            throw new Exception("Please select a college assigned by an admin.");
        }
        if ($hasLegacyRoleColumn) {
            $stmtUser = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    password,
                    college_id,
                    course_id,
                    section_id,
                    year_id,
                    role_id,
                    account_status,
                    role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'active', ?)"
            );
            $stmtUser->bind_param(
                "ssssssiis",
                $idNumber,
                $firstName,
                $middleName,
                $lastName,
                $email,
                $password,
                $collegeId,
                $roleId,
                $role
            );
        } else {
            $stmtUser = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    password,
                    college_id,
                    course_id,
                    section_id,
                    year_id,
                    role_id
                    , account_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'active')"
            );
            $stmtUser->bind_param(
                "ssssssii",
                $idNumber,
                $firstName,
                $middleName,
                $lastName,
                $email,
                $password,
                $collegeId,
                $roleId
            );
        }
    } else {
        if ($courseId <= 0 || $sectionId <= 0 || $yearId <= 0) {
            throw new Exception("Please select a course assigned by an admin, then choose section and year level.");
        }

        $courseCollegeStmt = $conn->prepare("SELECT college_id FROM {$courseTable} WHERE course_id = ? LIMIT 1");
        $courseCollegeStmt->bind_param("i", $courseId);
        $courseCollegeStmt->execute();
        $courseCollegeResult = $courseCollegeStmt->get_result();
        $courseCollegeRow = $courseCollegeResult ? $courseCollegeResult->fetch_assoc() : null;
        $courseCollegeStmt->close();

        if (!$courseCollegeRow) {
            throw new Exception("Selected course was not found.");
        }

        $courseCollegeId = $courseCollegeRow['college_id'] !== null
            ? (int)$courseCollegeRow['college_id']
            : null;

        if ($collegeId !== null && $courseCollegeId !== $collegeId) {
            throw new Exception("Selected course does not belong to the chosen college.");
        }

        $collegeId = $courseCollegeId;

        $sectionStmt = $conn->prepare("SELECT section_id FROM {$sectionTable} WHERE section_id = ? LIMIT 1");
        $sectionStmt->bind_param("i", $sectionId);
        $sectionStmt->execute();
        $sectionResult = $sectionStmt->get_result();
        if (!$sectionResult || $sectionResult->num_rows === 0) {
            $sectionStmt->close();
            throw new Exception("Selected section was not found.");
        }
        $sectionStmt->close();

        $yearStmt = $conn->prepare("SELECT year_id FROM {$yearTable} WHERE year_id = ? LIMIT 1");
        $yearStmt->bind_param("i", $yearId);
        $yearStmt->execute();
        $yearResult = $yearStmt->get_result();
        if (!$yearResult || $yearResult->num_rows === 0) {
            $yearStmt->close();
            throw new Exception("Selected year level was not found.");
        }
        $yearStmt->close();

        if ($hasLegacyRoleColumn) {
            $stmtUser = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    password,
                    college_id,
                    course_id,
                    section_id,
                    year_id,
                    role_id,
                    account_status,
                    role
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)"
            );
            $stmtUser->bind_param(
                "ssssssiiiiis",
                $idNumber,
                $firstName,
                $middleName,
                $lastName,
                $email,
                $password,
                $collegeId,
                $courseId,
                $sectionId,
                $yearId,
                $roleId,
                $role
            );
        } else {
            $stmtUser = $conn->prepare(
                "INSERT INTO {$userTable} (
                    institutional_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    password,
                    college_id,
                    course_id,
                    section_id,
                    year_id,
                    role_id
                    , account_status
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')"
            );
            $stmtUser->bind_param(
                "ssssssiiiii",
                $idNumber,
                $firstName,
                $middleName,
                $lastName,
                $email,
                $password,
                $collegeId,
                $courseId,
                $sectionId,
                $yearId,
                $roleId
            );
        }
    }
    $stmtUser->execute();
    $newUserId = $conn->insert_id;
    $stmtUser->close();

    // Commit changes
    $conn->commit();
    echo json_encode([
        "status" => "success",
        "message" => "Account created successfully!",
        "user_id" => $newUserId,
        "role" => $role,
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
