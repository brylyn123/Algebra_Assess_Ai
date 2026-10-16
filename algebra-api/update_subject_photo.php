<?php
require_once 'cors.php';
require_once 'auth.php';
require_once 'db_connect.php';
require_once 'schema_utils.php';
require_once 'subject_photo_helper.php';

$data = json_decode(file_get_contents("php://input"), true);

$authUser = requireAuthenticatedUser('teacher');
validateCsrfToken();
$teacher_id = (int)$authUser['user_id'];

$subject_id = isset($data['subject_id']) ? (int)$data['subject_id'] : 0;
$photo_input = array_key_exists('photo', $data) ? $data['photo'] : null;
$remove_photo = array_key_exists('photo', $data) && ($photo_input === null || $photo_input === '');

if ($subject_id <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Subject ID is required."]);
    exit;
}

try {
    ensureSubjectPhotoColumn($conn);
    $subjectTable = resolveExistingTableName($conn, ['Subject', 'subject']);

    $selectStmt = $conn->prepare(
        "SELECT teacher_user_id, photo FROM {$subjectTable} WHERE subject_id = ? LIMIT 1"
    );
    $selectStmt->bind_param("i", $subject_id);
    $selectStmt->execute();
    $row = $selectStmt->get_result()->fetch_assoc();
    $selectStmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Subject not found."]);
        exit;
    }

    if ((int)$row['teacher_user_id'] !== $teacher_id) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "You can only update photos of your own subjects."]);
        exit;
    }

    $oldPhoto = $row['photo'] ?? null;
    $newPhoto = $oldPhoto;

    if ($remove_photo) {
        $newPhoto = null;
    } elseif (is_string($photo_input) && $photo_input !== '') {
        if (!preg_match('#^data:image/#i', $photo_input)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Photo must be uploaded as an image file."]);
            exit;
        }
        $newPhoto = saveSubjectPhoto($photo_input, $teacher_id);
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "No photo provided."]);
        exit;
    }

    $updateStmt = $conn->prepare("UPDATE {$subjectTable} SET photo = ? WHERE subject_id = ?");
    $updateStmt->bind_param("si", $newPhoto, $subject_id);
    $updated = $updateStmt->execute();
    $updateStmt->close();

    if (!$updated) {
        if ($newPhoto !== null && $newPhoto !== $oldPhoto) {
            deleteSubjectPhoto($newPhoto);
        }
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to update the subject photo."]);
        exit;
    }

    if ($oldPhoto !== null && $oldPhoto !== $newPhoto) {
        deleteSubjectPhoto($oldPhoto);
    }

    echo json_encode([
        "status" => "success",
        "message" => $remove_photo ? "Subject photo removed." : "Subject photo updated.",
        "photo" => $newPhoto
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to update the subject photo: " . $e->getMessage()]);
}

$conn->close();
?>
