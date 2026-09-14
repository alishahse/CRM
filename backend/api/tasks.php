<?php
/**
 * Tasks API (no assignees)
 * GET    ?filter=&q= | ?id= | ?meta=1
 * POST   create (timer auto-starts)
 * PUT    update
 * DELETE { id }
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

date_default_timezone_set('Asia/Karachi');
require_method('GET', 'POST', 'PUT', 'DELETE');

$pdo = db();
$method = strtoupper($_SERVER['REQUEST_METHOD']);

$allowedStatus = ['new', 'active', 'in_progress', 'observation', 'completed'];
$allowedType = ['operational', 'development', 'bug', 'other'];
$allowedPriority = ['low', 'medium', 'high', 'urgent'];

function format_seconds(int $seconds): string
{
    $seconds = max(0, $seconds);
    return sprintf(
        '%02d:%02d:%02d',
        intdiv($seconds, 3600),
        intdiv($seconds % 3600, 60),
        $seconds % 60
    );
}

function live_spent(array $row): int
{
    $base = (int) ($row['time_spent'] ?? 0);
    if (!(int) ($row['timer_running'] ?? 0) || empty($row['timer_started_at'])) {
        return $base;
    }
    $started = strtotime($row['timer_started_at']);
    return $started === false ? $base : $base + max(0, time() - $started);
}

function map_task(array $row): array
{
    $spent = live_spent($row);
    return [
        'id' => (int) $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'status' => $row['status'],
        'type' => $row['type'],
        'priority' => $row['priority'],
        'project' => $row['project'],
        'est_time' => $row['est_time'],
        'due_date' => $row['due_date'],
        'progress' => (int) $row['progress'],
        'time_spent' => $spent,
        'time_label' => format_seconds($spent),
        'timer_running' => (int) ($row['timer_running'] ?? 0),
        'timer_started_at' => $row['timer_started_at'] ?? null,
        'created_by' => (int) $row['created_by'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function fetch_task_row(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Task not found', 404);
    }
    return $row;
}

function task_counts(PDO $pdo): array
{
    return [
        'all' => (int) $pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn(),
        'active' => (int) $pdo->query(
            "SELECT COUNT(*) FROM tasks WHERE status IN ('active','in_progress','new')"
        )->fetchColumn(),
        'observation' => (int) $pdo->query(
            "SELECT COUNT(*) FROM tasks WHERE status = 'observation'"
        )->fetchColumn(),
        'completed' => (int) $pdo->query(
            "SELECT COUNT(*) FROM tasks WHERE status = 'completed'"
        )->fetchColumn(),
    ];
}

if ($method === 'GET') {
    if (isset($_GET['meta']) && $_GET['meta'] === '1') {
        json_success(['counts' => task_counts($pdo)]);
    }

    $id = query_int('id');
    if ($id !== null) {
        json_success(map_task(fetch_task_row($pdo, $id)));
    }

    $filter = isset($_GET['filter']) ? trim((string) $_GET['filter']) : 'all';
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $sql = 'SELECT * FROM tasks WHERE 1=1';
    $params = [];

    if ($filter === 'active') {
        $sql .= " AND status IN ('active','in_progress','new')";
    } elseif ($filter === 'observation') {
        $sql .= " AND status = 'observation'";
    } elseif ($filter === 'completed') {
        $sql .= " AND status = 'completed'";
    } elseif ($filter !== 'all') {
        json_error('Invalid filter', 422);
    }

    if ($q !== '') {
        $sql .= ' AND (title LIKE ? OR description LIKE ? OR project LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }

    $sql .= ' ORDER BY updated_at DESC, id DESC LIMIT 200';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_success([
        'filter' => $filter,
        'q' => $q,
        'counts' => task_counts($pdo),
        'tasks' => array_map('map_task', $stmt->fetchAll()),
    ]);
}

if ($method === 'POST') {
    $body = request_json();
    $title = body_string($body, 'title', true, 255);
    $description = body_string($body, 'description', false, 20000);
    $status = body_string($body, 'status', false, 20) ?? 'active';
    $type = body_string($body, 'type', false, 20) ?? 'operational';
    $priority = body_string($body, 'priority', false, 20) ?? 'medium';
    $project = body_string($body, 'project', false, 150);
    $estTime = body_string($body, 'est_time', false, 50);
    $dueRaw = body_string($body, 'due_date', false, 32);
    $dueDate = $dueRaw ? parse_datetime($dueRaw) : null;
    $createdBy = body_int($body, 'created_by');
    $progress = isset($body['progress']) && is_numeric($body['progress'])
        ? max(0, min(100, (int) $body['progress']))
        : 0;

    if (!in_array($status, $allowedStatus, true)) {
        json_error('Invalid status', 422);
    }
    if (!in_array($type, $allowedType, true)) {
        json_error('Invalid type', 422);
    }
    if (!in_array($priority, $allowedPriority, true)) {
        json_error('Invalid priority', 422);
    }
    require_user($pdo, $createdBy);

    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare(
        'INSERT INTO tasks
         (title, description, status, type, priority, project, est_time, due_date, progress,
          time_spent, timer_started_at, timer_running, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)'
    );
    $stmt->execute([
        $title, $description, $status, $type, $priority, $project,
        $estTime, $dueDate, $progress, $now, $createdBy,
    ]);

    json_success(map_task(fetch_task_row($pdo, (int) $pdo->lastInsertId())), 201);
}

if ($method === 'DELETE') {
    $body = request_json();
    $id = body_int($body, 'id', false) ?? query_int('id');
    if ($id === null) {
        json_error('id is required', 422);
    }
    $stmt = $pdo->prepare('DELETE FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() < 1) {
        json_error('Task not found', 404);
    }
    json_success(['deleted' => true, 'id' => $id]);
}

// PUT
$body = request_json();
$id = body_int($body, 'id');
$row = fetch_task_row($pdo, $id);
$current = map_task($row);

// Lightweight timer controls from list / tracker UI
$timerAction = body_string($body, 'timer_action', false, 20);
if ($timerAction !== null) {
    if (!in_array($timerAction, ['start', 'stop'], true)) {
        json_error('timer_action must be start or stop', 422);
    }

    $timeSpent = (int) $row['time_spent'];
    $timerStarted = $row['timer_started_at'];
    $timerRunning = (int) $row['timer_running'];

    if ($timerAction === 'stop') {
        if ($timerRunning === 1) {
            $timeSpent = $current['time_spent'];
            $timerStarted = null;
            $timerRunning = 0;
        }
    } else {
        if ($timerRunning !== 1) {
            $timerStarted = date('Y-m-d H:i:s');
            $timerRunning = 1;
        }
    }

    $stmt = $pdo->prepare(
        'UPDATE tasks SET time_spent=?, timer_started_at=?, timer_running=? WHERE id=?'
    );
    $stmt->execute([$timeSpent, $timerStarted, $timerRunning, $id]);
    json_success(map_task(fetch_task_row($pdo, $id)));
}

$title = body_string($body, 'title', true, 255);
$description = body_string($body, 'description', false, 20000);
$status = body_string($body, 'status', true, 20);
$type = body_string($body, 'type', true, 20);
$priority = body_string($body, 'priority', true, 20);
$project = body_string($body, 'project', false, 150);
$estTime = body_string($body, 'est_time', false, 50);
$dueRaw = body_string($body, 'due_date', false, 32);
$dueDate = $dueRaw ? parse_datetime($dueRaw) : null;
$progress = isset($body['progress']) && is_numeric($body['progress'])
    ? max(0, min(100, (int) $body['progress']))
    : (int) $row['progress'];

if (!in_array($status, $allowedStatus, true)) {
    json_error('Invalid status', 422);
}
if (!in_array($type, $allowedType, true)) {
    json_error('Invalid type', 422);
}
if (!in_array($priority, $allowedPriority, true)) {
    json_error('Invalid priority', 422);
}

$shouldRun = !in_array($status, ['completed', 'observation'], true);
$timeSpent = (int) $row['time_spent'];
$timerStarted = $row['timer_started_at'];
$timerRunning = (int) $row['timer_running'];
$wasStatusPaused = in_array($row['status'], ['completed', 'observation'], true);

if (!$shouldRun && $timerRunning === 1) {
    $timeSpent = $current['time_spent'];
    $timerStarted = null;
    $timerRunning = 0;
} elseif ($shouldRun && $wasStatusPaused) {
    // Reactivated from completed/observation → resume timer
    $timerStarted = date('Y-m-d H:i:s');
    $timerRunning = 1;
}
// Manual stop stays stopped on normal form save.

$stmt = $pdo->prepare(
    'UPDATE tasks SET
       title=?, description=?, status=?, type=?, priority=?, project=?,
       est_time=?, due_date=?, progress=?, time_spent=?, timer_started_at=?, timer_running=?
     WHERE id=?'
);
$stmt->execute([
    $title, $description, $status, $type, $priority, $project,
    $estTime, $dueDate, $progress, $timeSpent, $timerStarted, $timerRunning, $id,
]);

json_success(map_task(fetch_task_row($pdo, $id)));
