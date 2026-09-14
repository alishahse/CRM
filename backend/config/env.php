<?php
/**
 * Minimal .env loader for backend.
 */

declare(strict_types=1);

function load_env(?string $path = null): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $path = $path ?? dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        if ($key === '') {
            continue;
        }

        // Strip optional quotes
        if (
            strlen($value) >= 2
            && (
                ($value[0] === '"' && str_ends_with($value, '"'))
                || ($value[0] === "'" && str_ends_with($value, "'"))
            )
        ) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv("{$key}={$value}");
    }
}

function env(string $key, ?string $default = null): ?string
{
    load_env();

    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }

    $val = getenv($key);
    if ($val === false) {
        return $default;
    }

    return (string) $val;
}

function env_bool(string $key, bool $default = false): bool
{
    $val = env($key);
    if ($val === null) {
        return $default;
    }

    return in_array(strtolower($val), ['1', 'true', 'yes', 'on'], true);
}
