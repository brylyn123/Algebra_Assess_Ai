<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';

$authUser = requireAuthenticatedUser('student');
$student_id = (int)$authUser['user_id'];
$exercise_id = isset($_POST['exercise_id']) ? intval($_POST['exercise_id']) : null;

if (!$exercise_id) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Assessment ID is required.']);
    exit();
}

if (!isset($_FILES['files'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Please upload at least one file.']);
    exit();
}

try {
    $enrollmentCol = getEnrollmentSubjectColumn($conn);

    $checkStmt = $conn->prepare(
         "SELECT
            ep.exercise_id,
            ep.subject_id
         FROM exercises_problem ep
         INNER JOIN Enrollment e ON e.$enrollmentCol = ep.subject_id AND e.student_user_id = ?
         WHERE ep.exercise_id = ?
         LIMIT 1"
    );
    $checkStmt->bind_param('ii', $student_id, $exercise_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $assessmentRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$assessmentRow) {
        throw new Exception('This assessment is not available for the selected student.');
    }

    $uploadRoot = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'captured_solutions';
    if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0777, true) && !is_dir($uploadRoot)) {
        throw new Exception('Unable to create the upload directory.');
    }

    $files = $_FILES['files'];
    $isMulti = is_array($files['name']);
    $fileCount = $isMulti ? count($files['name']) : 1;
    $savedFiles = [];

    for ($index = 0; $index < $fileCount; $index++) {
        $error = $isMulti ? $files['error'][$index] : $files['error'];
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            throw new Exception('One of the uploaded files failed to upload.');
        }

        $tmpName = $isMulti ? $files['tmp_name'][$index] : $files['tmp_name'];
        $originalName = $isMulti ? $files['name'][$index] : $files['name'];
        $size = $isMulti ? (int)$files['size'][$index] : (int)$files['size'];

        if ($size > 10 * 1024 * 1024) {
            throw new Exception('Each file must be 10MB or smaller.');
        }

        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'pdf'];
        if (!in_array($extension, $allowed, true)) {
            throw new Exception('Only JPG, JPEG, PNG, and PDF files are allowed.');
        }

        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($originalName));
        $storedName = sprintf(
            'student_%d_exercise_%d_%s_%d.%s',
            $student_id,
            $exercise_id,
            uniqid('', true),
            $index,
            $extension
        );
        $targetPath = $uploadRoot . DIRECTORY_SEPARATOR . $storedName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to store one of the uploaded files.');
        }

        $savedFiles[] = [
            'original_name' => $safeName,
            'stored_name' => $storedName,
            'file_path' => 'uploads/captured_solutions/' . $storedName,
            'size' => $size,
        ];
    }

    if (count($savedFiles) === 0) {
        throw new Exception('Please upload at least one valid file.');
    }

    $primaryFilePath = $savedFiles[0]['file_path'];
    $ocrText = null;

    $rawJson = json_encode([
        'files' => $savedFiles,
        'submitted_via' => 'student_submit_portal',
        'ocr' => [
            'status' => 'not_started',
        ],
    ]);
    $aiStatus = 'pending';

    $insertStmt = $conn->prepare(
        "INSERT INTO Captured_Solution (exercise_id, student_user_id, file_path, ocr_text, ai_status, ai_raw_json)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $insertStmt->bind_param(
        'iissss',
        $exercise_id,
        $student_id,
        $primaryFilePath,
        $ocrText,
        $aiStatus,
        $rawJson
    );
    $insertStmt->execute();
    $solutionId = $conn->insert_id;
    $insertStmt->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'Assessment submitted successfully.',
        'solution_id' => $solutionId,
        'exercise_id' => $exercise_id,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
