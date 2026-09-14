<?php
/**
 * Lightweight SMTP client (STARTTLS / SSL) — no Composer required.
 */

declare(strict_types=1);

require_once __DIR__ . '/env.php';

function smtp_config(): array
{
    load_env();

    return [
        'enabled'    => env_bool('SMTP_ENABLED', false),
        'host'       => env('SMTP_HOST', 'smtp.gmail.com'),
        'port'       => (int) (env('SMTP_PORT', '587') ?? '587'),
        'encryption' => strtolower(env('SMTP_ENCRYPTION', 'tls') ?? 'tls'),
        'username'   => env('SMTP_USER', ''),
        'password'   => env('SMTP_PASS', ''),
        'from_email' => env('SMTP_FROM_EMAIL', env('SMTP_USER', '')),
        'from_name'  => env('SMTP_FROM_NAME', 'CRM Workspace'),
    ];
}

/**
 * Send email via SMTP (multipart plain + HTML for better inbox placement).
 *
 * @return array{ok:bool, error:?string}
 */
function smtp_send(string $toEmail, string $toName, string $subject, string $body): array
{
    $cfg = smtp_config();

    if (!$cfg['enabled']) {
        return ['ok' => false, 'error' => 'SMTP is disabled. Set SMTP_ENABLED=true in backend/.env'];
    }

    if ($cfg['username'] === '' || $cfg['password'] === '' || $cfg['from_email'] === '') {
        return ['ok' => false, 'error' => 'SMTP credentials missing in backend/.env'];
    }

    // Gmail: From must match authenticated account (helps inbox delivery)
    $from = strtolower(trim((string) $cfg['from_email']));
    $user = strtolower(trim((string) $cfg['username']));
    if ($from !== $user) {
        $from = $user;
    }

    if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Invalid recipient email'];
    }

    $host = $cfg['host'];
    $port = $cfg['port'];
    $enc = $cfg['encryption'];

    $remote = ($enc === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        $remote,
        $errno,
        $errstr,
        15,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        return ['ok' => false, 'error' => "SMTP connect failed: {$errstr}"];
    }

    stream_set_timeout($socket, 15);

    try {
        $ehlo = 'crm.localhost';
        smtp_expect($socket, [220]);
        smtp_cmd($socket, 'EHLO ' . $ehlo, [250]);

        if ($enc === 'tls') {
            smtp_cmd($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS negotiation failed');
            }
            smtp_cmd($socket, 'EHLO ' . $ehlo, [250]);
        }

        smtp_cmd($socket, 'AUTH LOGIN', [334]);
        smtp_cmd($socket, base64_encode($cfg['username']), [334]);
        smtp_cmd($socket, base64_encode($cfg['password']), [235]);

        $fromName = $cfg['from_name'] ?: $from;
        $toNameSafe = $toName !== '' ? $toName : $toEmail;
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $messageId = sprintf('<%s.%s@%s>', bin2hex(random_bytes(8)), time(), $domain);
        $boundary = 'b_' . bin2hex(random_bytes(12));

        smtp_cmd($socket, 'MAIL FROM:<' . $from . '>', [250]);
        smtp_cmd($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        smtp_cmd($socket, 'DATA', [354]);

        $plain = str_replace(["\r\n", "\r"], "\n", $body);
        $plain = str_replace("\n", "\r\n", $plain);
        $html = smtp_html_body($plain, $fromName);

        $headers = [
            'Date: ' . date('r'),
            'From: ' . smtp_encode_address($fromName, $from),
            'Reply-To: ' . smtp_encode_address($fromName, $from),
            'To: ' . smtp_encode_address($toNameSafe, $toEmail),
            'Message-ID: ' . $messageId,
            'Subject: ' . smtp_encode_header($subject),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $parts = [
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            smtp_dot_stuff($plain),
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            smtp_dot_stuff($html),
            '--' . $boundary . '--',
            '',
        ];

        $data = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $parts) . "\r\n.";
        fwrite($socket, $data . "\r\n");
        smtp_expect($socket, [250]);
        smtp_cmd($socket, 'QUIT', [221]);

        fclose($socket);

        return ['ok' => true, 'error' => null];
    } catch (Throwable $e) {
        fclose($socket);
        error_log('[CRM SMTP] ' . $e->getMessage());

        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function smtp_html_body(string $plainCrLf, string $fromName): string
{
    $escaped = htmlspecialchars(
        str_replace("\r\n", "\n", $plainCrLf),
        ENT_QUOTES | ENT_SUBSTITUTE,
        'UTF-8'
    );
    $escaped = nl2br($escaped, false);
    $safeName = htmlspecialchars($fromName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    return '<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111;">'
        . '<div>' . $escaped . '</div>'
        . '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">'
        . '<p style="font-size:12px;color:#666;">Sent via CRM by ' . $safeName . '</p>'
        . '</body></html>';
}

function smtp_dot_stuff(string $value): string
{
    return preg_replace('/^\./m', '..', $value) ?? $value;
}

function smtp_encode_address(string $name, string $email): string
{
    $safeName = trim(str_replace(["\r", "\n"], '', $name));
    if ($safeName === '' || $safeName === $email) {
        return '<' . $email . '>';
    }

    return '"' . addcslashes($safeName, '"\\') . '" <' . $email . '>';
}

function smtp_encode_header(string $value): string
{
    $value = str_replace(["\r", "\n"], '', $value);
    if (preg_match('/[^\x20-\x7E]/', $value)) {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    return $value;
}

function smtp_cmd($socket, string $command, array $expectCodes): void
{
    fwrite($socket, $command . "\r\n");
    smtp_expect($socket, $expectCodes);
}

function smtp_expect($socket, array $expectCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectCodes, true)) {
        throw new RuntimeException('SMTP unexpected reply: ' . trim($response));
    }

    return $response;
}
