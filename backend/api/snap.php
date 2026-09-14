<?php
/**
 * Secure snap image server.
 * GET snap.php?id=1
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$id = query_int('id');
if ($id === null) {
    json_error('id is required', 422);
}

$pdo = db();
$stmt = $pdo->prepare(
    'SELECT id, file_path FROM attendance_snaps WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$snap = $stmt->fetch();

if (!$snap) {
    json_error('Snap not found', 404);
}

$relative = str_replace(['\\', '..'], ['/', ''], (string) $snap['file_path']);
$fullPath = realpath(__DIR__ . '/../' . $relative);
$uploadsRoot = realpath(__DIR__ . '/../uploads');

if (
    $fullPath === false
    || $uploadsRoot === false
    || !str_starts_with($fullPath, $uploadsRoot)
    || !is_file($fullPath)
) {
    json_error('Snap file missing', 404);
}

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$mime = match ($ext) {
    'jpg', 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    default => null,
};

if ($mime === null) {
    json_error('Unsupported image type', 415);
}

// Override JSON header from cors.php for binary response
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string) filesize($fullPath));
header('Cache-Control: public, max-age=86400');
header('X-Content-Type-Options: nosniff');

readfile($fullPath);
exit;
