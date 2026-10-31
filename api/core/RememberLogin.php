<?php
declare(strict_types=1);

/**
 * api/core/RememberLogin.php
 * "Giữ đăng nhập trên thiết bị": token selector:validator, CSDL chỉ lưu SHA-256 của validator.
 * Mỗi lần dùng token được đổi validator mới (xoay vòng); đăng xuất, đổi mật khẩu, khóa tài khoản đều hủy.
 */
final class RememberLogin {
    public const COOKIE = 'sheet_remember';
    public const TTL = 2592000; // 30 ngày
    // Request song song mang validator cũ đến trễ sau khi token vừa xoay: không coi là bị đánh cắp.
    public const GRACE_SECONDS = 20;

    public static function ensureTable(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS auth_remember_tokens (
            selector TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            last_used_at INTEGER NOT NULL,
            user_agent TEXT
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_remember_user ON auth_remember_tokens(user_id)");
        $cols = array_column($pdo->query("PRAGMA table_info(auth_remember_tokens)")->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array('prev_hash', $cols, true)) {
            $pdo->exec("ALTER TABLE auth_remember_tokens ADD COLUMN prev_hash TEXT");
            $pdo->exec("ALTER TABLE auth_remember_tokens ADD COLUMN prev_until INTEGER NOT NULL DEFAULT 0");
        }
    }

    /** Tạo token mới cho user, trả về giá trị cookie "selector:validator". */
    public static function issue(PDO $pdo, int $userId, string $userAgent = '', ?string $selector = null): string {
        self::ensureTable($pdo);
        $selector = $selector ?? bin2hex(random_bytes(9));
        $validator = bin2hex(random_bytes(32));
        $now = time();
        $old = $pdo->prepare("SELECT token_hash, created_at FROM auth_remember_tokens WHERE selector = ?");
        $old->execute([$selector]);
        $prev = $old->fetch(PDO::FETCH_ASSOC);
        $pdo->prepare("INSERT OR REPLACE INTO auth_remember_tokens (selector, user_id, token_hash, expires_at, created_at, last_used_at, user_agent, prev_hash, prev_until)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$selector, $userId, hash('sha256', $validator), $now + self::TTL, $prev['created_at'] ?? $now, $now, substr($userAgent, 0, 200),
                $prev ? $prev['token_hash'] : null, $prev ? $now + self::GRACE_SECONDS : 0]);
        return $selector . ':' . $validator;
    }

    /** Kiểm token; hợp lệ thì xoay validator và trả ['user' => row, 'cookie' => giá trị mới]. */
    public static function consume(PDO $pdo, string $cookie, string $userAgent = ''): ?array {
        if (!preg_match('/^([a-f0-9]{18}):([a-f0-9]{64})$/', $cookie, $m)) return null;
        self::ensureTable($pdo);
        $stmt = $pdo->prepare("SELECT * FROM auth_remember_tokens WHERE selector = ?");
        $stmt->execute([$m[1]]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        if ((int)$row['expires_at'] < time()) { self::revoke($pdo, $m[1]); return null; }
        $given = hash('sha256', $m[2]);
        if (!hash_equals((string)$row['token_hash'], $given)) {
            // Validator ngay trước đó, đến trong thời gian ân hạn (request song song): cho vào nhưng không xoay nữa;
            // trình duyệt đã nhận cookie mới từ request đầu.
            if (!empty($row['prev_hash']) && (int)$row['prev_until'] >= time() && hash_equals((string)$row['prev_hash'], $given)) {
                $graceUser = self::activeUser($pdo, (int)$row['user_id']);
                return $graceUser ? ['user' => $graceUser, 'cookie' => null] : null;
            }
            // Selector đúng nhưng validator sai/quá hạn: nghi bị đánh cắp → hủy mọi token của user này.
            self::revokeAllForUser($pdo, (int)$row['user_id']);
            return null;
        }
        $user = self::activeUser($pdo, (int)$row['user_id']);
        if (!$user) { self::revoke($pdo, $m[1]); return null; }
        return ['user' => $user, 'cookie' => self::issue($pdo, (int)$user['id'], $userAgent, $m[1])];
    }

    private static function activeUser(PDO $pdo, int $userId): ?array {
        $u = $pdo->prepare("SELECT id, username, role, display_name, instrument, chord_code, voice_part, status FROM users WHERE id = ?");
        $u->execute([$userId]);
        $user = $u->fetch(PDO::FETCH_ASSOC);
        return ($user && ($user['status'] ?? 'active') === 'active') ? $user : null;
    }

    public static function revoke(PDO $pdo, string $selector): void {
        self::ensureTable($pdo);
        $pdo->prepare("DELETE FROM auth_remember_tokens WHERE selector = ?")->execute([$selector]);
    }

    public static function revokeCookie(PDO $pdo, string $cookie): void {
        if (preg_match('/^([a-f0-9]{18}):/', $cookie, $m)) self::revoke($pdo, $m[1]);
    }

    public static function revokeAllForUser(PDO $pdo, int $userId): void {
        self::ensureTable($pdo);
        $pdo->prepare("DELETE FROM auth_remember_tokens WHERE user_id = ?")->execute([$userId]);
    }

    public static function setCookie(string $value, int $ttl = self::TTL): void {
        if (headers_sent()) return;
        $opts = Session::cookieOptions();
        setcookie(self::COOKIE, $value, [
            'expires' => $ttl > 0 ? time() + $ttl : time() - 42000,
            'path' => '/', 'domain' => '',
            'secure' => $opts['secure'], 'httponly' => true, 'samesite' => 'Lax',
        ]);
        if ($ttl > 0) $_COOKIE[self::COOKIE] = $value; else unset($_COOKIE[self::COOKIE]);
    }

    /** Gọi sau session_start: nếu chưa đăng nhập mà có cookie hợp lệ → dựng lại phiên. */
    public static function restoreSession(): void {
        $cookie = (string)($_COOKIE[self::COOKIE] ?? '');
        if ($cookie === '' || isset($_SESSION['user_id'])) return;
        try {
            require_once __DIR__ . '/DB.php';
            $pdo = DB::get();
            $res = self::consume($pdo, $cookie, (string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
            if (!$res) { self::setCookie('', 0); return; }
            $u = $res['user'];
            if (session_status() === PHP_SESSION_ACTIVE) session_regenerate_id(true);
            $_SESSION['user_id'] = $u['id'];
            $_SESSION['username'] = $u['username'];
            $_SESSION['role'] = $u['role'];
            $_SESSION['display_name'] = $u['display_name'] ?? $u['username'];
            $_SESSION['instrument'] = $u['instrument'] ?? 'Guitar';
            $_SESSION['chord_code'] = $u['chord_code'] ?? '';
            $_SESSION['voice_part'] = $u['voice_part'] ?? null;
            $_SESSION['must_change_password'] = false;
            if ($res['cookie'] !== null) self::setCookie($res['cookie']);
        } catch (Throwable $e) {
            // Không làm hỏng request nếu CSDL chưa sẵn sàng.
        }
    }
}
