<?php
const SUBJECT_PHOTO_MAX_BYTES = 5242880; // 5MB

function subjectPhotoDir(): string {
    return __DIR__ . '/uploads/subject_photos';
}

function saveSubjectPhoto(string $dataUrl, int $ownerId): string {
    if (strlen($dataUrl) > SUBJECT_PHOTO_MAX_BYTES * 1.4) {
        throw new Exception('Subject photo is too large (max 5MB).');
    }

    if (!preg_match('#^data:image/(jpeg|jpg|png|webp|gif);base64,#i', $dataUrl)) {
        throw new Exception('Subject photo must be a JPG, PNG, WebP, or GIF image.');
    }

    $commaPosition = strpos($dataUrl, ',');
    $binary = base64_decode(substr($dataUrl, $commaPosition + 1), true);
    if ($binary === false) {
        throw new Exception('Subject photo data is not valid base64.');
    }
    if (strlen($binary) > SUBJECT_PHOTO_MAX_BYTES) {
        throw new Exception('Subject photo is too large (max 5MB).');
    }

    $imageInfo = @getimagesizefromstring($binary);
    if ($imageInfo === false) {
        throw new Exception('Subject photo is not a readable image.');
    }

    $extensions = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_GIF => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];
    $extension = $extensions[$imageInfo[2]] ?? null;
    if ($extension === null) {
        throw new Exception('Subject photo must be a JPG, PNG, WebP, or GIF image.');
    }

    $directory = subjectPhotoDir();
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) {
        throw new Exception('Unable to store the subject photo on the server.');
    }

    $filename = 'subject_' . $ownerId . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
    if (@file_put_contents($directory . '/' . $filename, $binary) === false) {
        throw new Exception('Unable to save the subject photo.');
    }

    return 'uploads/subject_photos/' . $filename;
}

function deleteSubjectPhoto(?string $relativePath): void {
    if ($relativePath === null || $relativePath === '') {
        return;
    }
    if (strpos($relativePath, '..') !== false) {
        return;
    }

    $fullPath = __DIR__ . '/' . ltrim($relativePath, '/');
    if (is_file($fullPath)) {
        @unlink($fullPath);
    }
}
?>
