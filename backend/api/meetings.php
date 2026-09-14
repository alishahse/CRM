<?php
/**
 * Meetings API — full CRUD
 *
 * GET    ?status=scheduled|done|cancelled
 * POST   create
 * PUT    { id, status } OR { id, title, meeting_date, ... } update
 * DELETE { id } or ?id=
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET', 'POST', 'PUT', 'DELETE');

$pdo = db();
$method = strtoupper($_SERVER['REQUEST_METHOD']);
$allowedStatus = ['scheduled', 'done', 'cancelled'];

$meetingSelect = 'SELECT m.id, m.title, m.description, m.meeting_date, m.location,
                         m.created_by, u.name AS created_by_name, m.status, m.created_at
                  FROM meetings m
                  INNER JOIN users u ON u.id = m.created_by';

function fetch_meeting(PDO $pdo, string $meetingSelect, int $id): array
{
    $fetch = $pdo->prepare("{$meetingSelect} WHERE m.id = ? LIMIT 1");
    $fetch->execute([$id]);
    $row = $fetch->fetch();

    if (!$row) {
        json_error('Meeting not found', 404);
    }

    return map_meeting_row($row);
}

if ($method === 'GET') {
    $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';

    if ($status !== '') {
        if (!in_array($status, $allowedStatus, true)) {
            json_error('Invalid status filter', 422);
        }

        $stmt = $pdo->prepare(
            "{$meetingSelect}
             WHERE m.status = ?
             ORDER BY m.meeting_date ASC
             LIMIT 100"
        );
        $stmt->execute([$status]);
    } else {
        $stmt = $pdo->query(
            "{$meetingSelect}
             ORDER BY m.meeting_date ASC
             LIMIT 100"
        );
    }

    json_success(array_map('map_meeting_row', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $body = request_json();
    $title = body_string($body, 'title', true, 200);
    $description = body_string($body, 'description', false, 5000);
    $meetingDate = parse_datetime(body_string($body, 'meeting_date', true, 32));
    $location = body_string($body, 'location', false, 200);
    $createdBy = body_int($body, 'created_by');

    require_user($pdo, $createdBy);

    $stmt = $pdo->prepare(
        'INSERT INTO meetings (title, description, meeting_date, location, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $title,
        $description,
        $meetingDate,
        $location,
        $createdBy,
        'scheduled',
    ]);

    json_success(fetch_meeting($pdo, $meetingSelect, (int) $pdo->lastInsertId()), 201);
}

if ($method === 'DELETE') {
    $body = request_json();
    $id = body_int($body, 'id', false) ?? query_int('id');

    if ($id === null) {
        json_error('id is required', 422);
    }

    $stmt = $pdo->prepare('DELETE FROM meetings WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() < 1) {
        json_error('Meeting not found', 404);
    }

    json_success(['deleted' => true, 'id' => $id]);
}

// PUT — status change OR full edit
$body = request_json();
$id = body_int($body, 'id');

$stmt = $pdo->prepare('SELECT id FROM meetings WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    json_error('Meeting not found', 404);
}

$hasStatusOnly = array_key_exists('status', $body)
    && !array_key_exists('title', $body)
    && !array_key_exists('meeting_date', $body);

if ($hasStatusOnly) {
    $status = body_string($body, 'status', true, 20);
    if (!in_array($status, $allowedStatus, true)) {
        json_error('status must be scheduled, done, or cancelled', 422);
    }

    $update = $pdo->prepare('UPDATE meetings SET status = ? WHERE id = ?');
    $update->execute([$status, $id]);

    json_success(fetch_meeting($pdo, $meetingSelect, $id));
}

$title = body_string($body, 'title', true, 200);
$description = body_string($body, 'description', false, 5000);
$meetingDate = parse_datetime(body_string($body, 'meeting_date', true, 32));
$location = body_string($body, 'location', false, 200);
$status = body_string($body, 'status', false, 20);

if ($status !== null && !in_array($status, $allowedStatus, true)) {
    json_error('status must be scheduled, done, or cancelled', 422);
}

if ($status !== null) {
    $update = $pdo->prepare(
        'UPDATE meetings
         SET title = ?, description = ?, meeting_date = ?, location = ?, status = ?
         WHERE id = ?'
    );
    $update->execute([$title, $description, $meetingDate, $location, $status, $id]);
} else {
    $update = $pdo->prepare(
        'UPDATE meetings
         SET title = ?, description = ?, meeting_date = ?, location = ?
         WHERE id = ?'
    );
    $update->execute([$title, $description, $meetingDate, $location, $id]);
}

json_success(fetch_meeting($pdo, $meetingSelect, $id));
