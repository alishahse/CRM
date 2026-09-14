<?php
/**
 * GET dashboard.php?user_id=1
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

date_default_timezone_set('Asia/Karachi');

require_method('GET');

$pdo = db();
$userId = query_int('user_id', 1);
require_user($pdo, $userId);

$today = date('Y-m-d');

$stmt = $pdo->prepare(
    'SELECT id, user_id, clock_in, break_in, break_out, clock_out, date, status, late_minutes, created_at
     FROM attendance
     WHERE user_id = ? AND date = ?
     LIMIT 1'
);
$stmt->execute([$userId, $today]);
$todayRow = $stmt->fetch();

$stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM inbox WHERE user_id = ? AND folder = \'inbox\' AND is_read = 0'
);
$stmt->execute([$userId]);
$unreadInbox = (int) $stmt->fetchColumn();

$stmt = $pdo->query(
    "SELECT COUNT(*) FROM meetings
     WHERE status = 'scheduled' AND meeting_date >= NOW()"
);
$upcomingMeetings = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare(
    'SELECT *
     FROM inbox
     WHERE user_id = ? AND folder = \'inbox\'
     ORDER BY created_at DESC
     LIMIT 5'
);
$stmt->execute([$userId]);
$recentInbox = array_map('map_inbox_row', $stmt->fetchAll());

$stmt = $pdo->query(
    "SELECT m.id, m.title, m.description, m.meeting_date, m.location,
            m.created_by, u.name AS created_by_name, m.status, m.created_at
     FROM meetings m
     INNER JOIN users u ON u.id = m.created_by
     WHERE m.status = 'scheduled' AND m.meeting_date >= NOW()
     ORDER BY m.meeting_date ASC
     LIMIT 5"
);
$nextMeetings = array_map('map_meeting_row', $stmt->fetchAll());

json_success([
    'user_id' => $userId,
    'date' => $today,
    'today_attendance' => $todayRow ? map_attendance_row($todayRow) : null,
    'unread_inbox' => $unreadInbox,
    'upcoming_meetings' => $upcomingMeetings,
    'recent_inbox' => $recentInbox,
    'next_meetings' => $nextMeetings,
]);
