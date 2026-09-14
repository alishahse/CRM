<?php
/**
 * Shared API helpers — responses, validation, helpers.
 * Section 6.2 standard: { success, data } | { success, error }
 */

declare(strict_types=1);

function json_success(mixed $data = null, int $code = 200): void
{
    http_response_code($code);
    echo json_encode([
        'success' => true,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Return JSON to client first, then run a callback (e.g. slow SMTP).
 */
function json_success_then(callable $after, mixed $data = null, int $code = 200): void
{
    ignore_user_abort(true);
    http_response_code($code);

    $payload = json_encode([
        'success' => true,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE);

    header('Content-Length: ' . (string) strlen($payload));
    echo $payload;

    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @flush();

    if (function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    }

    try {
        $after();
    } catch (Throwable $e) {
        error_log('[CRM API after-response] ' . $e->getMessage());
    }

    exit;
}

function json_error(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error'   => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function require_method(string ...$allowed): void
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        json_error('Method not allowed', 405);
    }
}

function request_json(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    // Allow camera snap base64 payloads (~2.5MB)
    if (strlen($raw) > 2621440) {
        json_error('Request body too large', 413);
    }

    $data = json_decode($raw, true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        json_error('Invalid JSON body', 400);
    }

    return $data;
}

function query_int(string $key, ?int $default = null): ?int
{
    if (!isset($_GET[$key]) || $_GET[$key] === '') {
        return $default;
    }

    if (!ctype_digit((string) $_GET[$key])) {
        json_error("Invalid {$key}", 422);
    }

    $value = (int) $_GET[$key];

    if ($value < 1) {
        json_error("Invalid {$key}", 422);
    }

    return $value;
}

function body_int(array $body, string $key, bool $required = true): ?int
{
    if (!array_key_exists($key, $body) || $body[$key] === '' || $body[$key] === null) {
        if ($required) {
            json_error("{$key} is required", 422);
        }
        return null;
    }

    if (is_bool($body[$key]) || !is_numeric($body[$key])) {
        json_error("Invalid {$key}", 422);
    }

    $value = (int) $body[$key];

    if ($value < 1) {
        json_error("Invalid {$key}", 422);
    }

    return $value;
}

function body_string(array $body, string $key, bool $required = true, int $max = 255): ?string
{
    if (!array_key_exists($key, $body) || $body[$key] === null) {
        if ($required) {
            json_error("{$key} is required", 422);
        }
        return null;
    }

    if (!is_scalar($body[$key])) {
        json_error("Invalid {$key}", 422);
    }

    $value = trim((string) $body[$key]);

    if ($required && $value === '') {
        json_error("{$key} is required", 422);
    }

    if ($value !== '' && mb_strlen($value) > $max) {
        json_error("{$key} is too long (max {$max})", 422);
    }

    return $value === '' ? null : $value;
}

/**
 * Normalize datetime from frontend (datetime-local) or API clients.
 * Accepts: YYYY-MM-DD HH:MM:SS | YYYY-MM-DDTHH:MM | YYYY-MM-DDTHH:MM:SS
 */
function parse_datetime(string $value): string
{
    $normalized = str_replace('T', ' ', trim($value));

    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $normalized)) {
        $normalized .= ':00';
    }

    $dt = DateTime::createFromFormat('Y-m-d H:i:s', $normalized);
    $ok = $dt instanceof DateTime && $dt->format('Y-m-d H:i:s') === $normalized;

    if (!$ok) {
        json_error('meeting_date must be YYYY-MM-DD HH:MM:SS', 422);
    }

    return $normalized;
}

function user_exists(PDO $pdo, int $userId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);

    return (bool) $stmt->fetchColumn();
}

function require_user(PDO $pdo, int $userId): void
{
    if (!user_exists($pdo, $userId)) {
        json_error('User not found', 404);
    }
}

/** Cast inbox / mail row fields for consistent JSON. */
function map_inbox_row(array $row): array
{
    return [
        'id'            => (int) $row['id'],
        'user_id'       => (int) $row['user_id'],
        'folder'        => $row['folder'] ?? 'inbox',
        'from_name'     => $row['from_name'] ?? '',
        'from_email'    => $row['from_email'] ?? '',
        'to_name'       => $row['to_name'] ?? '',
        'to_email'      => $row['to_email'] ?? '',
        'subject'       => $row['subject'] ?? ($row['title'] ?? ''),
        'body'          => $row['body'] ?? '',
        'preview'       => mb_substr(preg_replace('/\s+/', ' ', trim((string) ($row['body'] ?? ''))), 0, 120),
        'is_read'       => (int) ($row['is_read'] ?? 0),
        'thread_count'  => (int) ($row['thread_count'] ?? 1),
        'reply_to_id'   => isset($row['reply_to_id']) && $row['reply_to_id'] !== null
            ? (int) $row['reply_to_id']
            : null,
        'created_at'    => $row['created_at'],
        'updated_at'    => $row['updated_at'] ?? null,
    ];
}

function mail_folders(): array
{
    return ['inbox', 'sent', 'drafts', 'review', 'spam', 'trash', 'archive'];
}

function folder_counts(PDO $pdo, int $userId): array
{
    $counts = array_fill_keys(mail_folders(), 0);
    $stmt = $pdo->prepare(
        'SELECT folder, COUNT(*) AS c
         FROM inbox
         WHERE user_id = ?
         GROUP BY folder'
    );
    $stmt->execute([$userId]);

    foreach ($stmt->fetchAll() as $row) {
        $folder = $row['folder'];
        if (isset($counts[$folder])) {
            $counts[$folder] = (int) $row['c'];
        }
    }

    return $counts;
}

function attendance_work_seconds(?string $clockIn, ?string $breakIn, ?string $breakOut, ?string $clockOut, ?DateTimeInterface $until = null): int
{
    if (!$clockIn) {
        return 0;
    }

    $start = new DateTimeImmutable($clockIn);
    $end = $clockOut
        ? new DateTimeImmutable($clockOut)
        : ($until instanceof DateTimeInterface
            ? DateTimeImmutable::createFromInterface($until)
            : new DateTimeImmutable('now'));

    $seconds = max(0, $end->getTimestamp() - $start->getTimestamp());

    if ($breakIn && $breakOut) {
        $bStart = new DateTimeImmutable($breakIn);
        $bEnd = new DateTimeImmutable($breakOut);
        $seconds -= max(0, $bEnd->getTimestamp() - $bStart->getTimestamp());
    } elseif ($breakIn && !$breakOut) {
        $bStart = new DateTimeImmutable($breakIn);
        $seconds -= max(0, $end->getTimestamp() - $bStart->getTimestamp());
    }

    return max(0, $seconds);
}

function format_duration(int $seconds): string
{
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);

    return sprintf('%02dh %02dm', $h, $m);
}

function next_attendance_action(?array $row): ?string
{
    if (!$row || empty($row['clock_in'])) {
        return 'clock_in';
    }
    if (!empty($row['clock_out'])) {
        return null;
    }
    if (empty($row['break_in'])) {
        return 'break_in';
    }
    if (empty($row['break_out'])) {
        return 'break_out';
    }

    return 'clock_out';
}

function map_attendance_row(array $row, array $snaps = []): array
{
    $workSeconds = attendance_work_seconds(
        $row['clock_in'] ?? null,
        $row['break_in'] ?? null,
        $row['break_out'] ?? null,
        $row['clock_out'] ?? null
    );

    $mapped = [
        'id'            => (int) $row['id'],
        'user_id'       => (int) $row['user_id'],
        'date'          => $row['date'],
        'clock_in'      => $row['clock_in'] ?? null,
        'break_in'      => $row['break_in'] ?? null,
        'break_out'     => $row['break_out'] ?? null,
        'clock_out'     => $row['clock_out'] ?? null,
        'status'        => $row['status'] ?? 'present',
        'late_minutes'  => (int) ($row['late_minutes'] ?? 0),
        'hours'         => format_duration($workSeconds),
        'work_seconds'  => $workSeconds,
        'next_action'   => next_attendance_action($row),
        'snap_count'    => count($snaps),
        'snaps'         => $snaps,
        'created_at'    => $row['created_at'] ?? null,
    ];

    if (isset($row['user_name'])) {
        $mapped['user_name'] = $row['user_name'];
    }

    return $mapped;
}

/**
 * Save a JPEG/PNG data-URL or raw base64 to uploads and return relative path.
 */
function save_attendance_snap(string $imageData, int $attendanceId, string $action): string
{
    if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i', $imageData, $m)) {
        // Also accept raw base64 jpeg
        if (!preg_match('#^[A-Za-z0-9+/=\s]+$#', $imageData)) {
            json_error('Invalid image data', 422);
        }
        $ext = 'jpg';
        $binary = base64_decode(preg_replace('#\s+#', '', $imageData), true);
    } else {
        $ext = strtolower($m[1]) === 'jpg' ? 'jpg' : strtolower($m[1]);
        $binary = base64_decode(substr($imageData, strpos($imageData, ',') + 1), true);
    }

    if ($binary === false || strlen($binary) < 100) {
        json_error('Invalid image payload', 422);
    }

    if (strlen($binary) > 2_000_000) {
        json_error('Image too large (max 2MB)', 413);
    }

    $dir = __DIR__ . '/uploads/attendance/' . date('Y/m');
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        json_error('Could not create upload directory', 500);
    }

    $filename = sprintf('%d_%s_%s.%s', $attendanceId, $action, bin2hex(random_bytes(6)), $ext === 'jpeg' ? 'jpg' : $ext);
    $fullPath = $dir . DIRECTORY_SEPARATOR . $filename;

    if (file_put_contents($fullPath, $binary) === false) {
        json_error('Failed to save image', 500);
    }

    return 'uploads/attendance/' . date('Y/m') . '/' . $filename;
}

function snap_public_url(string $relativePath, ?int $snapId = null): string
{
    if ($snapId !== null) {
        return 'http://localhost/CRM/backend/api/snap.php?id=' . $snapId;
    }

    return 'http://localhost/CRM/backend/' . ltrim(str_replace('\\', '/', $relativePath), '/');
}

function map_meeting_row(array $row): array
{
    return [
        'id'              => (int) $row['id'],
        'title'           => $row['title'],
        'description'     => $row['description'],
        'meeting_date'    => $row['meeting_date'],
        'location'        => $row['location'],
        'created_by'      => (int) $row['created_by'],
        'created_by_name' => $row['created_by_name'] ?? null,
        'status'          => $row['status'],
        'created_at'      => $row['created_at'],
    ];
}
