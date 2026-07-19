<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

ensureRegistrationLookupData($conn);

$authUser = requireAuthenticatedUser();
$authRole = strtolower((string)($authUser['role'] ?? ''));
if ($authRole !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'status' => 'error',
        'message' => 'Only admin users can manage colleges and courses.',
    ]);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'No data provided.',
    ]);
    exit();
}

$action = strtolower(trim((string)($data['action'] ?? '')));
$type = strtolower(trim((string)($data['type'] ?? '')));

if (!in_array($type, ['college', 'course'], true)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid type provided.',
    ]);
    exit();
}

$collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
$courseTable = resolveExistingTableName($conn, ['Course', 'course']);

try {
    if ($action === 'create') {
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            throw new Exception('Name is required.');
        }

        if ($type === 'college') {
            $stmt = $conn->prepare("INSERT INTO {$collegeTable} (college_name, is_active) VALUES (?, 1)");
            $stmt->bind_param('s', $name);
            $stmt->execute();

            echo json_encode([
                'status' => 'success',
                'message' => 'College created successfully.',
                'college_id' => $conn->insert_id,
            ]);
            $stmt->close();
            exit();
        }

        $collegeId = isset($data['collegeId']) ? (int)$data['collegeId'] : 0;
        if ($collegeId <= 0) {
            throw new Exception('Please choose a college for the course.');
        }

        $collegeStmt = $conn->prepare("SELECT college_id FROM {$collegeTable} WHERE college_id = ? LIMIT 1");
        $collegeStmt->bind_param('i', $collegeId);
        $collegeStmt->execute();
        $collegeResult = $collegeStmt->get_result();
        $collegeRow = $collegeResult ? $collegeResult->fetch_assoc() : null;
        $collegeStmt->close();

        if (!$collegeRow) {
            throw new Exception('Selected college was not found.');
        }

        $courseCode = trim((string)($data['courseCode'] ?? ''));
        if ($courseCode === '') {
            $courseCode = generateUniqueCourseCode($conn, $name);
        }

        $stmt = $conn->prepare("INSERT INTO {$courseTable} (course_name, course_code, college_id, is_active) VALUES (?, ?, ?, 1)");
        $stmt->bind_param('ssi', $name, $courseCode, $collegeId);
        $stmt->execute();

        echo json_encode([
            'status' => 'success',
            'message' => 'Course created successfully.',
            'course_id' => $conn->insert_id,
            'course_code' => $courseCode,
        ]);
        $stmt->close();
        exit();
    }

    if ($action === 'update') {
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        $name = trim((string)($data['name'] ?? ''));
        if ($id <= 0 || $name === '') {
            throw new Exception('Invalid ID or name.');
        }

        if ($type === 'college') {
            $stmt = $conn->prepare("UPDATE {$collegeTable} SET college_name = ? WHERE college_id = ?");
            $stmt->bind_param('si', $name, $id);
            $stmt->execute();
            $stmt->close();

            echo json_encode([
                'status' => 'success',
                'message' => 'College updated successfully.',
            ]);
            exit();
        }

        $collegeId = isset($data['collegeId']) ? (int)$data['collegeId'] : 0;
        if ($collegeId <= 0) {
            throw new Exception('Please choose a college for the course.');
        }

        $collegeStmt = $conn->prepare("SELECT college_id FROM {$collegeTable} WHERE college_id = ? LIMIT 1");
        $collegeStmt->bind_param('i', $collegeId);
        $collegeStmt->execute();
        $collegeResult = $collegeStmt->get_result();
        $collegeRow = $collegeResult ? $collegeResult->fetch_assoc() : null;
        $collegeStmt->close();

        if (!$collegeRow) {
            throw new Exception('Selected college was not found.');
        }

        $courseCode = trim((string)($data['courseCode'] ?? ''));
        if ($courseCode === '') {
            $codeStmt = $conn->prepare("SELECT course_code FROM {$courseTable} WHERE course_id = ? LIMIT 1");
            $codeStmt->bind_param('i', $id);
            $codeStmt->execute();
            $codeResult = $codeStmt->get_result();
            $codeRow = $codeResult ? $codeResult->fetch_assoc() : null;
            $codeStmt->close();
            $courseCode = trim((string)($codeRow['course_code'] ?? ''));
            if ($courseCode === '') {
                $courseCode = generateUniqueCourseCode($conn, $name);
            }
        }

        $stmt = $conn->prepare("UPDATE {$courseTable} SET course_name = ?, course_code = ?, college_id = ? WHERE course_id = ?");
        $stmt->bind_param('ssii', $name, $courseCode, $collegeId, $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode([
            'status' => 'success',
            'message' => 'Course updated successfully.',
        ]);
        exit();
    }

    if ($action === 'toggle_active') {
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        $isActive = isset($data['isActive']) ? (int)!!$data['isActive'] : 0;
        if ($id <= 0) {
            throw new Exception('Invalid ID.');
        }

        if ($type === 'college') {
            $stmt = $conn->prepare("UPDATE {$collegeTable} SET is_active = ? WHERE college_id = ?");
            $stmt->bind_param('ii', $isActive, $id);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $conn->prepare("UPDATE {$courseTable} SET is_active = ? WHERE course_id = ?");
            $stmt->bind_param('ii', $isActive, $id);
            $stmt->execute();
            $stmt->close();
        }

        echo json_encode([
            'status' => 'success',
            'message' => ucfirst($type) . ' status updated successfully.',
        ]);
        exit();
    }

    throw new Exception('Invalid action.');
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);
}
