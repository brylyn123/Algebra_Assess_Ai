<?php
/**
 * Lightweight SMTP mailer for Gmail.
 *
 * To use Gmail SMTP you need an App Password (not your regular password):
 * 1. Go to https://myaccount.google.com/security
 * 2. Enable 2-Step Verification if not already
 * 3. Go to https://myaccount.google.com/apppasswords
 * 4. Generate an app password for "Mail"
 * 5. Put the 16-character password in your .env file as SMTP_PASSWORD
 */
class SmtpMailer
{
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $fromEmail;
    private string $fromName;
    private $socket = null;

    public function __construct(string $host, int $port, string $username, string $password, string $fromEmail = '', string $fromName = '')
    {
        $this->host = $host;
        $this->port = $port;
        $this->username = $username;
        $this->password = $password;
        $this->fromEmail = $fromEmail ?: $username;
        $this->fromName = $fromName ?: 'AlgebraAssess';
    }

    public static function fromEnv(): self
    {
        $host = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $port = (int)(getenv('SMTP_PORT') ?: 587);
        $user = getenv('SMTP_USERNAME') ?: '';
        $pass = getenv('SMTP_PASSWORD') ?: '';
        $from = getenv('SMTP_FROM_EMAIL') ?: $user;
        $name = getenv('SMTP_FROM_NAME') ?: 'AlgebraAssess';

        return new self($host, $port, $user, $pass, $from, $name);
    }

    private function connect(): bool
    {
        $this->socket = @fsockopen($this->host, $this->port, $errno, $errstr, 10);
        if (!$this->socket) {
            throw new RuntimeException("SMTP connection failed: {$errstr} ({$errno})");
        }

        $response = $this->readResponse();
        if ($response['code'] !== 220) {
            throw new RuntimeException("SMTP banner error: {$response['message']}");
        }

        return true;
    }

    private function sendCommand(string $command, int $expectedCode = 250): array
    {
        fwrite($this->socket, $command . "\r\n");
        $response = $this->readResponse();

        if ($response['code'] !== $expectedCode) {
            throw new RuntimeException(
                "SMTP command failed: {$command}\nExpected {$expectedCode}, got {$response['code']}: {$response['message']}"
            );
        }

        return $response;
    }

    private function readResponse(): array
    {
        $message = '';
        while (true) {
            $line = fgets($this->socket, 512);
            if ($line === false) {
                break;
            }
            $message .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }

        $code = (int)substr($message, 0, 3);
        return ['code' => $code, 'message' => trim($message)];
    }

    private function ehlo(): void
    {
        $this->sendCommand("EHLO " . ($this->host ?: 'localhost'), 250);
    }

    private function startTls(): void
    {
        $this->sendCommand('STARTTLS', 220);
        $crypto = stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT);
        if (!$crypto) {
            throw new RuntimeException('TLS handshake failed');
        }
        $this->ehlo();
    }

    private function authenticate(): void
    {
        $this->sendCommand('AUTH LOGIN', 334);
        $this->sendCommand(base64_encode($this->username), 334);
        $this->sendCommand(base64_encode($this->password), 235);
    }

    public function send(string $to, string $subject, string $body, bool $isHtml = true): bool
    {
        $this->connect();
        $this->ehlo();

        if ($this->port === 587) {
            $this->startTls();
        }

        $this->authenticate();

        $this->sendCommand("MAIL FROM:<{$this->fromEmail}>", 250);
        $this->sendCommand("RCPT TO:<{$to}>", 250);
        $this->sendCommand('DATA', 354);

        $headers = "From: {$this->fromName} <{$this->fromEmail}>\r\n";
        $headers .= "To: {$to}\r\n";
        $headers .= "Subject: {$subject}\r\n";
        $headers .= "Date: " . date('r') . "\r\n";
        $headers .= "MIME-Version: 1.0\r\n";

        if ($isHtml) {
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        } else {
            $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        }

        $headers .= "\r\n{$body}\r\n.";

        fwrite($this->socket, $headers . "\r\n");
        $response = $this->readResponse();

        if ($response['code'] !== 250) {
            throw new RuntimeException("Email send failed: {$response['message']}");
        }

        $this->sendCommand('QUIT', 221);
        fclose($this->socket);
        $this->socket = null;

        return true;
    }

    public function __destruct()
    {
        if ($this->socket && is_resource($this->socket)) {
            fclose($this->socket);
        }
    }
}
?>