<?php
/**
 * Health / API index — Section 6 endpoint map.
 * http://localhost/CRM/backend/public/
 */

declare(strict_types=1);

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers.php';

require_method('GET');

try {
    db()->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $e) {
    error_log('[CRM API] health check DB fail: ' . $e->getMessage());
    $dbOk = false;
}

json_success([
    'service' => 'CRM PHP API',
    'version' => '1.0',
    'status'  => $dbOk ? 'ok' : 'db_error',
    'db'      => $dbOk,
    'endpoints' => [
        ['method' => 'GET',           'path' => '/backend/api/dashboard.php',  'purpose' => 'Dashboard counts'],
        ['method' => 'GET|POST',      'path' => '/backend/api/attendance.php', 'purpose' => 'List / check-in / check-out'],
        ['method' => 'GET|PUT',       'path' => '/backend/api/inbox.php',      'purpose' => 'List / mark read'],
        ['method' => 'GET|POST|PUT',  'path' => '/backend/api/meetings.php',   'purpose' => 'List / create / update status'],
    ],
]);
