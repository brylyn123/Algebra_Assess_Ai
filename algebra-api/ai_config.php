<?php
require_once __DIR__ . '/env.php';

function getAiConfig(): array
{
    $localConfigPath = __DIR__ . '/ai_secrets.local.php';
    $localConfig = [];

    if (is_file($localConfigPath)) {
        $loaded = require $localConfigPath;
        if (is_array($loaded)) {
            $localConfig = $loaded;
        }
    }

    $envConfig = array_filter([
        'api_key' => getenv('DEEPSEEK_API_KEY') ?: null,
        'base_url' => getenv('DEEPSEEK_BASE_URL') ?: null,
        'model' => getenv('DEEPSEEK_MODEL') ?: null,
        'ocr_model' => getenv('DEEPSEEK_OCR_MODEL') ?: null,
        'ocr_provider' => getenv('DEEPSEEK_OCR_PROVIDER') ?: null,
        'gemini_api_key' => getenv('GEMINI_API_KEY') ?: null,
        'gemini_model' => getenv('GEMINI_MODEL') ?: null,
        'tesseract_path' => getenv('TESSERACT_PATH') ?: null,
        'timeout_seconds' => getenv('DEEPSEEK_TIMEOUT_SECONDS') ?: null,
    ], static fn($value) => $value !== null && $value !== '');

    $config = array_filter(array_merge([
        'api_key' => null,
        'base_url' => 'https://api.deepseek.com',
        'model' => 'deepseek-v4-flash',
        'ocr_model' => 'deepseek-v4-flash',
        'ocr_provider' => 'gemini',
        'gemini_api_key' => null,
        'gemini_model' => 'gemini-3-flash-preview',
        'tesseract_path' => null,
        'timeout_seconds' => 60,
    ], $localConfig, $envConfig), static fn($value) => $value !== null && $value !== '');

    $config['timeout_seconds'] = isset($config['timeout_seconds']) ? (int)$config['timeout_seconds'] : 60;

    return $config;
}
