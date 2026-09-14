<?php
/**
 * Attendance API
 *
 * GET  ?user_id=1&month=2026-09&view=today|history
 * POST { user_id, action: clock_in|break_in|break_out|clock_out, image }
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

date_default_timezone_set('Asia/Karachi');

require_method('GET', 'POST');

$pdo = db();
$method = strtoupper($_SERVER['REQUEST_METHOD']);
$allowedActions = ['clock_in', 'break_in', 'break_out', 'clock_out'];
$officeStart = '09:00:00'; // late if clock_in after this (Asia/Karachi)

function load_snaps_for(PDO $pdo, int $attendanceId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, action, file_path, created_at
         FROM attendance_snaps
         WHERE attendance_id = ?
         ORDER BY id ASC'
    );
    $stmt->execute([$attendanceId]);

    $snaps = [];
    foreach ($stmt->fetchAll() as $snap) {
        $snaps[] = [
            'id'         => (int) $snap['id'],
            'action'     => $snap['action'],
            'url'        => snap_public_url($snap['file_path'], (int) $snap['id']),
            'created_at' => $snap['created_at'],
        ];
    }

    return $snaps;
}

function fetch_attendance_mapped(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare(
        'SELECT a.*, u.name AS user_name
         FROM attendance a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('Attendance not found', 404);
    }

    return map_attendance_row($row, load_snaps_for($pdo, $id));
}

if ($method === 'GET') {
    $userId = query_int('user_id', 1);
    require_user($pdo, $userId);

    $view = isset($_GET['view']) ? trim((string) $_GET['view']) : 'history';
    $today = date('Y-m-d');

    // Today's card payload
    $stmt = $pdo->prepare(
        'SELECT a.*, u.name AS user_name
         FROM attendance a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ? AND a.date = ?
         LIMIT 1'
    );
    $stmt->execute([$userId, $today]);
    $todayRow = $stmt->fetch();
    $todayMapped = $todayRow
        ? map_attendance_row($todayRow, load_snaps_for($pdo, (int) $todayRow['id']))
        : [
            'id' => null,
            'user_id' => $userId,
            'date' => $today,
            'clock_in' => null,
            'break_in' => null,
            'break_out' => null,
            'clock_out' => null,
            'status' => null,
            'late_minutes' => 0,
            'hours' => '00h 00m',
            'work_seconds' => 0,
            'next_action' => 'clock_in',
            'snap_count' => 0,
            'snaps' => [],
        ];

    if ($view === 'today') {
        json_success([
            'timezone' => 'Asia/Karachi',
            'server_time' => date('Y-m-d H:i:s'),
            'today' => $todayMapped,
        ]);
    }

    $month = isset($_GET['month']) ? trim((string) $_GET['month']) : date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        json_error('month must be YYYY-MM', 422);
    }

    $stmt = $pdo->prepare(
        'SELECT a.*, u.name AS user_name
         FROM attendance a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ?
           AND DATE_FORMAT(a.date, "%Y-%m") = ?
         ORDER BY a.date DESC'
    );
    $stmt->execute([$userId, $month]);
    $rows = $stmt->fetchAll();

    $history = [];
    $workDays = 0;
    $lateDays = 0;
    $totalSeconds = 0;

    foreach ($rows as $row) {
        $mapped = map_attendance_row($row, load_snaps_for($pdo, (int) $row['id']));
        $history[] = $mapped;

        if ($mapped['clock_in']) {
            $workDays++;
            $totalSeconds += $mapped['work_seconds'];
        }
        if ($mapped['late_minutes'] > 0 || $mapped['status'] === 'late') {
            $lateDays++;
        }
    }

    json_success([
        'timezone' => 'Asia/Karachi',
        'server_time' => date('Y-m-d H:i:s'),
        'month' => $month,
        'today' => $todayMapped,
        'summary' => [
            'work_days' => $workDays,
            'late' => $lateDays,
            'total_hours' => format_duration($totalSeconds),
        ],
        'history' => $history,
    ]);
}

// POST — punch with required camera snap
$body = request_json();
$userId = body_int($body, 'user_id');
$action = body_string($body, 'action', true, 20);
$image = body_string($body, 'image', true, 3_000_000);

if (!in_array($action, $allowedActions, true)) {
    json_error('action must be clock_in, break_in, break_out, or clock_out', 422);
}

require_user($pdo, $userId);

$today = date('Y-m-d');
$now = date('Y-m-d H:i:s');

$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare(
        'SELECT * FROM attendance WHERE user_id = ? AND date = ? LIMIT 1 FOR UPDATE'
    );
    $stmt->execute([$userId, $today]);
    $row = $stmt->fetch();

    $expected = next_attendance_action($row ?: null);
    if ($expected !== $action) {
        $pdo->rollBack();
        $label = $expected ? str_replace('_', ' ', $expected) : 'none (day complete)';
        json_error("Next allowed action is {$label}", 409);
    }

    if ($action === 'clock_in') {
        $lateMinutes = 0;
        $status = 'present';
        $startToday = new DateTimeImmutable($today . ' ' . $officeStart);
        $nowDt = new DateTimeImmutable($now);
        if ($nowDt > $startToday) {
            $lateMinutes = (int) floor(($nowDt->getTimestamp() - $startToday->getTimestamp()) / 60);
            $status = 'late';
        }

        if ($row) {
            $update = $pdo->prepare(
                'UPDATE attendance
                 SET clock_in = ?, status = ?, late_minutes = ?
                 WHERE id = ?'
            );
            $update->execute([$now, $status, $lateMinutes, $row['id']]);
            $id = (int) $row['id'];
        } else {
            $insert = $pdo->prepare(
                'INSERT INTO attendance (user_id, clock_in, date, status, late_minutes)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $insert->execute([$userId, $now, $today, $status, $lateMinutes]);
            $id = (int) $pdo->lastInsertId();
        }
    } else {
        if (!$row) {
            $pdo->rollBack();
            json_error('Clock in first', 409);
        }

        $column = $action; // break_in | break_out | clock_out
        $update = $pdo->prepare("UPDATE attendance SET {$column} = ? WHERE id = ?");
        $update->execute([$now, $row['id']]);
        $id = (int) $row['id'];
    }

    $relativePath = save_attendance_snap($image, $id, $action);

    $snapInsert = $pdo->prepare(
        'INSERT INTO attendance_snaps (attendance_id, action, file_path)
         VALUES (?, ?, ?)'
    );
    $snapInsert->execute([$id, $action, $relativePath]);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

json_success(fetch_attendance_mapped($pdo, $id), 201);
