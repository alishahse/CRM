<?php
/**
 * Mail / Inbox API
 *
 * GET  ?user_id=1&folder=inbox&q=&id=
 * POST { action: send|draft|reply, ... }
 * PUT  { action: read|unread|move|delete, ids:[], folder?, user_id }
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

date_default_timezone_set('Asia/Karachi');

require_method('GET', 'POST', 'PUT');

$pdo = db();
$method = strtoupper($_SERVER['REQUEST_METHOD']);
$allowedFolders = mail_folders();

function fetch_message(PDO $pdo, int $id, int $userId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT * FROM inbox WHERE id = ? AND user_id = ? LIMIT 1'
    );
    $stmt->execute([$id, $userId]);
    $row = $stmt->fetch();

    return $row ? map_inbox_row($row) : null;
}

function mailbox_email(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    return [
        'name'  => $user['name'] ?? 'User',
        'email' => $user['email'] ?? 'user@crm.local',
    ];
}

function find_user_by_email(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower(trim($email))]);
    $row = $stmt->fetch();

    return $row ?: null;
}

if ($method === 'GET') {
    $userId = query_int('user_id', 1);
    require_user($pdo, $userId);

    $folder = isset($_GET['folder']) ? trim((string) $_GET['folder']) : 'inbox';
    if (!in_array($folder, $allowedFolders, true)) {
        json_error('Invalid folder', 422);
    }

    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $selectedId = query_int('id');

    $sql = 'SELECT * FROM inbox WHERE user_id = ? AND folder = ?';
    $params = [$userId, $folder];

    if ($q !== '') {
        $sql .= ' AND (subject LIKE ? OR body LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR to_email LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like, $like);
    }

    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $messages = array_map('map_inbox_row', $stmt->fetchAll());

    $selected = null;
    if ($selectedId !== null) {
        $selected = fetch_message($pdo, $selectedId, $userId);
        if ($selected && (int) $selected['is_read'] === 0) {
            $pdo->prepare('UPDATE inbox SET is_read = 1 WHERE id = ? AND user_id = ?')
                ->execute([$selectedId, $userId]);
            $selected['is_read'] = 1;
            // refresh list item flag
            foreach ($messages as &$m) {
                if ($m['id'] === $selectedId) {
                    $m['is_read'] = 1;
                }
            }
            unset($m);
        }
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM inbox WHERE user_id = ? AND folder = \'inbox\' AND is_read = 0'
    );
    $stmt->execute([$userId]);
    $unread = (int) $stmt->fetchColumn();

    json_success([
        'mailbox' => mailbox_email($pdo, $userId),
        'folder' => $folder,
        'q' => $q,
        'counts' => folder_counts($pdo, $userId),
        'unread_inbox' => $unread,
        'messages' => $messages,
        'selected' => $selected,
    ]);
}

if ($method === 'POST') {
    $body = request_json();
    $userId = body_int($body, 'user_id');
    $action = body_string($body, 'action', true, 20);
    require_user($pdo, $userId);

    $me = mailbox_email($pdo, $userId);

    if (!in_array($action, ['send', 'draft', 'reply'], true)) {
        json_error('action must be send, draft, or reply', 422);
    }

    $toEmail = body_string($body, 'to_email', $action !== 'draft', 150) ?? '';
    $toName = body_string($body, 'to_name', false, 150);
    $subject = body_string($body, 'subject', true, 255);
    $content = body_string($body, 'body', true, 50000);
    $replyToId = body_int($body, 'reply_to_id', false);

    if ($action === 'draft') {
        $stmt = $pdo->prepare(
            'INSERT INTO inbox
             (user_id, folder, from_name, from_email, to_name, to_email, subject, body, is_read, reply_to_id)
             VALUES (?, \'drafts\', ?, ?, ?, ?, ?, ?, 1, ?)'
        );
        $stmt->execute([
            $userId,
            $me['name'],
            $me['email'],
            $toName,
            $toEmail,
            $subject,
            $content,
            $replyToId,
        ]);

        json_success(fetch_message($pdo, (int) $pdo->lastInsertId(), $userId), 201);
    }

    if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        json_error('Valid to_email is required', 422);
    }

    if ($action === 'reply' && $replyToId) {
        $original = fetch_message($pdo, $replyToId, $userId);
        if (!$original) {
            json_error('Original message not found', 404);
        }
        if ($subject === '' || stripos($subject, 're:') !== 0) {
            $subject = 'Re: ' . ltrim($original['subject']);
        }
        if ($toEmail === '') {
            $toEmail = $original['from_email'];
            $toName = $original['from_name'];
        }
    }

    $recipient = find_user_by_email($pdo, $toEmail);
    if ($toName === null || $toName === '') {
        $toName = $recipient['name'] ?? $toEmail;
    }

    $pdo->beginTransaction();
    try {
        // Sender copy → sent
        $stmt = $pdo->prepare(
            'INSERT INTO inbox
             (user_id, folder, from_name, from_email, to_name, to_email, subject, body, is_read, reply_to_id)
             VALUES (?, \'sent\', ?, ?, ?, ?, ?, ?, 1, ?)'
        );
        $stmt->execute([
            $userId,
            $me['name'],
            $me['email'],
            $toName,
            strtolower($toEmail),
            $subject,
            $content,
            $replyToId,
        ]);
        $sentId = (int) $pdo->lastInsertId();

        // Recipient copy → inbox (internal users only)
        if ($recipient && (int) $recipient['id'] !== $userId) {
            $stmt = $pdo->prepare(
                'INSERT INTO inbox
                 (user_id, folder, from_name, from_email, to_name, to_email, subject, body, is_read, reply_to_id)
                 VALUES (?, \'inbox\', ?, ?, ?, ?, ?, ?, 0, ?)'
            );
            $stmt->execute([
                (int) $recipient['id'],
                $me['name'],
                $me['email'],
                $recipient['name'],
                $recipient['email'],
                $subject,
                $content,
                $replyToId,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $message = fetch_message($pdo, $sentId, $userId);
    $smtpEnabled = smtp_config()['enabled'];

    // Respond to UI immediately; SMTP continues in background (faster Send click).
    if ($smtpEnabled) {
        $toSend = strtolower($toEmail);
        $nameSend = (string) $toName;
        $subjectSend = $subject;
        $bodySend = $content;

        $message['smtp'] = [
            'enabled' => true,
            'queued'  => true,
            'sent'    => null,
        ];

        json_success_then(static function () use ($toSend, $nameSend, $subjectSend, $bodySend): void {
            $result = smtp_send($toSend, $nameSend, $subjectSend, $bodySend);
            if (!$result['ok']) {
                error_log('[CRM SMTP queued fail] ' . ($result['error'] ?? 'unknown'));
            }
        }, $message, 201);
    }

    $message['smtp'] = [
        'enabled' => false,
        'queued'  => false,
        'sent'    => false,
        'error'   => 'SMTP disabled',
    ];

    json_success($message, 201);
}

// PUT — bulk / single mailbox actions
$body = request_json();
$userId = body_int($body, 'user_id');
$action = body_string($body, 'action', true, 20);
require_user($pdo, $userId);

$ids = $body['ids'] ?? null;
if ($ids === null && isset($body['id'])) {
    $ids = [$body['id']];
}

if (!is_array($ids) || count($ids) === 0) {
    json_error('ids is required', 422);
}

$cleanIds = [];
foreach ($ids as $rawId) {
    if (!is_numeric($rawId) || (int) $rawId < 1) {
        json_error('Invalid id in ids', 422);
    }
    $cleanIds[] = (int) $rawId;
}
$cleanIds = array_values(array_unique($cleanIds));

if (count($cleanIds) > 100) {
    json_error('Too many ids (max 100)', 422);
}

$placeholders = implode(',', array_fill(0, count($cleanIds), '?'));

if ($action === 'read' || $action === 'unread') {
    $flag = $action === 'read' ? 1 : 0;
    $params = array_merge([$flag, $userId], $cleanIds);
    $stmt = $pdo->prepare(
        "UPDATE inbox SET is_read = ? WHERE user_id = ? AND id IN ({$placeholders})"
    );
    $stmt->execute($params);
    json_success(['updated' => $stmt->rowCount(), 'action' => $action]);
}

if ($action === 'move') {
    $folder = body_string($body, 'folder', true, 20);
    if (!in_array($folder, $allowedFolders, true)) {
        json_error('Invalid folder', 422);
    }
    $params = array_merge([$folder, $userId], $cleanIds);
    $stmt = $pdo->prepare(
        "UPDATE inbox SET folder = ? WHERE user_id = ? AND id IN ({$placeholders})"
    );
    $stmt->execute($params);
    json_success(['updated' => $stmt->rowCount(), 'folder' => $folder]);
}

if ($action === 'delete') {
    // Soft delete → trash; permanent if already trash
    $stmt = $pdo->prepare(
        "SELECT id, folder FROM inbox WHERE user_id = ? AND id IN ({$placeholders})"
    );
    $stmt->execute(array_merge([$userId], $cleanIds));
    $rows = $stmt->fetchAll();

    $toTrash = [];
    $toPurge = [];
    foreach ($rows as $row) {
        if ($row['folder'] === 'trash') {
            $toPurge[] = (int) $row['id'];
        } else {
            $toTrash[] = (int) $row['id'];
        }
    }

    $moved = 0;
    $purged = 0;

    if ($toTrash) {
        $ph = implode(',', array_fill(0, count($toTrash), '?'));
        $upd = $pdo->prepare(
            "UPDATE inbox SET folder = 'trash' WHERE user_id = ? AND id IN ({$ph})"
        );
        $upd->execute(array_merge([$userId], $toTrash));
        $moved = $upd->rowCount();
    }

    if ($toPurge) {
        $ph = implode(',', array_fill(0, count($toPurge), '?'));
        $del = $pdo->prepare(
            "DELETE FROM inbox WHERE user_id = ? AND id IN ({$ph})"
        );
        $del->execute(array_merge([$userId], $toPurge));
        $purged = $del->rowCount();
    }

    json_success(['moved_to_trash' => $moved, 'purged' => $purged]);
}

json_error('action must be read, unread, move, or delete', 422);
