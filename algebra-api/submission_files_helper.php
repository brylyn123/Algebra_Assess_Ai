<?php
require_once __DIR__ . '/ai_config.php';

function checkImageQualityWithImagick(string $filePath): array
{
    if (!class_exists('Imagick')) {
        return ['pass' => true, 'reason' => 'Imagick not available; quality check skipped.'];
    }

    try {
        $imagick = new Imagick();
        $imagick->readImage($filePath);

        $width = $imagick->getImageWidth();
        $height = $imagick->getImageHeight();
        if ($width < 100 || $height < 100) {
            $imagick->destroy();
            return ['pass' => false, 'reason' => 'Image is too small (' . $width . 'x' . $height . ' pixels). Please upload a larger image.'];
        }

        $gray = clone $imagick;
        $gray->setImageType(Imagick::IMGTYPE_GRAYSCALE);
        $gray->setImageDepth(8);

        $laplacianKernel = [
            0, 1, 0,
            1, -4, 1,
            0, 1, 0,
        ];
        $convolved = clone $gray;
        $convolved->convolveImage($laplacianKernel);
        $kurtosis = $convolved->getImageKurtosis();
        $blurScore = is_float($kurtosis) ? $kurtosis : 0.0;

        $meanInfo = $gray->getImageMean();
        $brightness = is_float($meanInfo) ? $meanInfo : 0.0;

        $stdDev = $gray->getImageStdDeviation();
        $contrast = is_float($stdDev) ? $stdDev : 0.0;

        $convolved->destroy();
        $gray->destroy();
        $imagick->destroy();

        $reasons = [];

        if ($blurScore < 50) {
            $reasons[] = 'Image appears blurry (sharpness score: ' . round($blurScore, 1) . '). Please retake with a steady hand or better focus.';
        }

        if ($brightness < 30) {
            $reasons[] = 'Image is too dark (brightness: ' . round($brightness, 1) . '). Please retake in better lighting.';
        } elseif ($brightness > 225) {
            $reasons[] = 'Image is too bright or washed out (brightness: ' . round($brightness, 1) . '). Please retake with less glare.';
        }

        if ($contrast < 20) {
            $reasons[] = 'Image has low contrast (score: ' . round($contrast, 1) . '). Please retake with better lighting or contrast.';
        }

        if (count($reasons) > 0) {
            return ['pass' => false, 'reason' => implode(' ', $reasons)];
        }

        return ['pass' => true, 'reason' => ''];
    } catch (Exception $e) {
        return ['pass' => true, 'reason' => 'Quality check skipped due to processing error.'];
    }
}

function submissionUploadRoot(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'captured_solutions';
}

/**
 * Validates and stores an uploaded submission file set (1-5 JPG/JPEG/PNG/PDF files).
 * Files that fail the image quality gate are dropped into file_errors; hard
 * validation failures (type/size/count) throw an Exception.
 *
 * Returns ['saved_files' => [...], 'file_errors' => [...]].
 */
function storeSubmissionFiles(array $files, int $exerciseId, int $studentId): array
{
    $uploadRoot = submissionUploadRoot();
    if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true) && !is_dir($uploadRoot)) {
        throw new Exception('Unable to create the upload directory.');
    }

    $isMulti = is_array($files['name']);
    $fileCount = $isMulti ? count($files['name']) : 1;

    if ($fileCount > 5) {
        throw new Exception('You can upload a maximum of 5 files per submission.');
    }

    $totalSize = 0;
    for ($i = 0; $i < $fileCount; $i++) {
        $totalSize += $isMulti ? (int)$files['size'][$i] : (int)$files['size'];
    }
    if ($totalSize > 25 * 1024 * 1024) {
        throw new Exception('Total upload size must be 25MB or smaller.');
    }

    $savedFiles = [];
    $fileErrors = [];

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

        $allowedMimeTypes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'pdf' => 'application/pdf',
        ];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpName);
        if ($mimeType !== $allowedMimeTypes[$extension]) {
            throw new Exception('File type does not match its content. Only image and PDF files are allowed.');
        }

        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($originalName));
        $storedName = sprintf(
            'student_%d_exercise_%d_%s_%d.%s',
            $studentId,
            $exerciseId,
            bin2hex(random_bytes(16)),
            $index,
            $extension
        );
        $targetPath = $uploadRoot . DIRECTORY_SEPARATOR . $storedName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new Exception('Unable to store one of the uploaded files.');
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
            $qualityResult = checkImageQualityWithImagick($targetPath);
            if (!$qualityResult['pass']) {
                @unlink($targetPath);
                $fileErrors[$index] = ['file' => $originalName, 'reason' => $qualityResult['reason'], 'type' => 'quality'];
                continue;
            }
        }

        $savedFiles[] = [
            'original_name' => $safeName,
            'stored_name' => $storedName,
            'file_path' => 'uploads/captured_solutions/' . $storedName,
            'size' => $size,
        ];
    }

    return ['saved_files' => $savedFiles, 'file_errors' => $fileErrors];
}

/**
 * Deletes the stored files referenced by a submission's ai_raw_json (or the
 * legacy single file_path) from disk. Best-effort: missing files are ignored.
 */
function deleteStoredSubmissionFiles(?string $rawJson, ?string $primaryFilePath): void
{
    $uploadRoot = submissionUploadRoot();
    $storedNames = [];

    if ($rawJson !== null && $rawJson !== '') {
        $decoded = json_decode($rawJson, true);
        if (is_array($decoded) && !empty($decoded['files']) && is_array($decoded['files'])) {
            foreach ($decoded['files'] as $fileInfo) {
                $path = (string)($fileInfo['file_path'] ?? '');
                if ($path !== '') {
                    $storedNames[] = basename($path);
                }
            }
        }
    }

    if ($primaryFilePath !== null && $primaryFilePath !== '') {
        $storedNames[] = basename($primaryFilePath);
    }

    foreach (array_unique($storedNames) as $storedName) {
        if ($storedName === '' || $storedName === '.' || $storedName === '..') {
            continue;
        }
        $fullPath = $uploadRoot . DIRECTORY_SEPARATOR . $storedName;
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }
}
