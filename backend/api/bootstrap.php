<?php
/**
 * Common bootstrap for every API endpoint (Section 6.3).
 * Loads CORS + DB + helpers, and returns safe JSON on unexpected errors.
 */

declare(strict_types=1);

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/mail.php';
require_once __DIR__ . '/../helpers.php';

load_env();

set_exception_handler(static function (Throwable $e): void {
    // Log server-side only; never expose internals to clients.
    error_log('[CRM API] ' . $e->getMessage());
    json_error('Server error', 500);
});
