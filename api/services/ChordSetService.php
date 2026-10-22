<?php
/**
 * api/services/ChordSetService.php
 *
 * Dịch vụ Quản trị Bộ Hợp Âm Hợp Nhất (Consolidated Chord Set Service):
 * 1. Sử dụng CSDL SQLite (bảng user_chord_sets) làm Single Source of Truth (SSOT).
 * 2. Lưu trữ song song (write-through cache) ra file disk JSON để bảo toàn tương thích ngược 100%.
 * 3. Hỗ trợ đối soát (reconciliation), tính checksum MD5 chống mất mát hoặc sai lệch dữ liệu.
 * 4. Hỗ trợ Fork, Attribution (ghi nhận bản phối gốc và tác giả).
 * 5. Giữ vững 4 Core Rules:
 *    - CR1: HD luôn là bộ hợp âm chuẩn mực mặc định.
 *    - CR3: Khóa tuyệt đối không cho phép xóa hay ghi đè lên bộ TLH, HD hoặc tên rác '__'.
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';

class ChordSetService {
    public const BASE_DIR = __DIR__ . '/../../storage/data/chord_sets';
    private const READABLE_SQL = "(LOWER(set_name) IN ('hd', 'tlh', 'default') OR is_public = 1 OR user_id = ?)";

    public static function getBaseDir(): string {
        $env = getenv('CHORD_SETS_DIR') ?: (getenv('SHEETAPP_CHORD_SETS_DIR') ?: null);
        return $env ?: self::BASE_DIR;
    }

    private static function getSongDir(string $songId, bool $create = false): string {
        $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
        $dir  = self::getBaseDir() . '/' . $safe;
        if ($create && !is_dir($dir)) @mkdir($dir, 0755, true);
        return $dir;
    }

    private static function sanitizeName(string $name): string {
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        if ($normalized === false || $normalized === '') {
            $normalized = $name;
        }
        return preg_replace('/[^a-zA-Z0-9_\-]+/', '_', trim($normalized));
    }

    public static function isReservedName(string $name): bool {
        $safe = self::sanitizeName($name);
        return $safe === '' || str_starts_with($safe, '__')
            || in_array(strtolower($safe), ['hd', 'tlh', 'default'], true);
    }

    private static function getSetFile(string $songId, string $name, bool $create = false): string {
        $safe = self::sanitizeName($name);
        return self::getSongDir($songId, $create) . '/' . $safe . '.json';
    }

    /**
     * Liệt kê tất cả các bộ hợp âm có sẵn cho bài hát
     * Chỉ liệt kê bộ chuẩn, công khai hoặc của chính người đọc.
     */
    public static function listSets(string $songId, ?int $userId = null): array {
        $names = [];

        try {
            $pdo = DB::get();
            $sql = "
                SELECT DISTINCT set_name 
                FROM user_chord_sets 
                WHERE song_id = ? AND " . self::READABLE_SQL . "
                ORDER BY (set_name = 'HD') DESC, set_name ASC
            ";
            $stmt = $pdo->prepare($sql);
            $params = [$songId, $userId ?? 0];
            $stmt->execute($params);
            $names = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (Throwable $e) {
            // Fallback đọc file nếu DB lỗi
        }

        // CORE RULE 1: HD luôn là bộ hợp âm mặc định và phải luôn xuất hiện
        if (!in_array('HD', $names, true)) {
            array_unshift($names, 'HD');
        }

        return array_values(array_unique($names));
    }

    /**
     * Nạp dữ liệu hợp âm của một bộ
     */
    public static function loadSet(string $songId, string $name): array {
        $readableOnDisk = in_array(strtolower($name), ['hd', 'tlh', 'default'], true);
        // 1. Tìm trong DB SQLite trước (Single Source of Truth)
        try {
            $pdo = DB::get();
            $stmt = $pdo->prepare("
                SELECT chords_json 
                FROM user_chord_sets 
                WHERE song_id = ? AND (set_name = ? COLLATE NOCASE OR username || '__' || set_name = ? COLLATE NOCASE)
                  AND " . self::READABLE_SQL . "
                ORDER BY (set_name = ?) DESC, id ASC LIMIT 1
            ");
            $stmt->execute([$songId, $name, $name, Auth::userId() ?? 0, $name]);
            $json = $stmt->fetchColumn();
            if ($json !== false && $json !== null) {
                $readableOnDisk = true;
                $data = json_decode((string)$json, true);
                if (is_array($data)) return $data;
            }
        } catch (Throwable $e) {
            // Fallback sang file disk
        }

        // Chỉ fallback khi DB đã xác nhận quyền, hoặc bộ chuẩn HD/TLH/default.
        if (!$readableOnDisk) return [];
        // 2. Fallback đọc file đĩa
        $file = self::getSetFile($songId, $name);
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            return is_array($data) ? $data : [];
        }

        // Fallback tìm tên file không phân biệt hoa thường
        $dir   = self::getSongDir($songId);
        $safe  = self::sanitizeName($name);
        $files = glob($dir . '/*.json') ?: [];
        foreach ($files as $f) {
            if (strcasecmp(pathinfo($f, PATHINFO_FILENAME), $safe) === 0) {
                $data = json_decode(file_get_contents($f), true);
                return is_array($data) ? $data : [];
            }
        }

        return [];
    }

    /**
     * Lấy checksum MD5 hiện tại của bộ hợp âm (phát hiện xung đột R2-3)
     */
    public static function getChecksum(string $songId, string $name): string {
        $details = self::getSetDetails($songId, $name);
        if (!empty($details['checksum'])) return (string)$details['checksum'];

        $chords = self::loadSet($songId, $name);
        return md5(json_encode($chords));
    }

    /**
     * Lưu bộ hợp âm vào DB và đồng bộ ra file disk
     */
    public static function saveSet(
        string $songId, 
        string $name, 
        array $chords, 
        ?int $userId = null, 
        ?string $username = null,
        ?string $attribution = null,
        ?bool $isPublic = null
    ): bool {
        // CORE RULE 3: Không cho phép ghi đè lên bộ gốc TLH / default hoặc các tên giả lập hành động
        if ($name !== 'HD' && self::isReservedName($name)) {
            return false;
        }

        $chordCount = count($chords);
        $checksum = md5(json_encode($chords));
        $chordsJson = json_encode($chords, JSON_UNESCAPED_UNICODE);

        // 1. Lưu vào SQLite Database
        try {
            $pdo = DB::get();
            $checkStmt = $pdo->prepare("SELECT id, user_id FROM user_chord_sets WHERE song_id = ? AND set_name = ? ORDER BY id ASC LIMIT 1");
            $checkStmt->execute([$songId, $name]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            $existingId = $existing['id'] ?? null;
            if ($existingId && $userId !== null && (int)$existing['user_id'] !== $userId && $name !== 'HD'
                && !($isPublic !== null && $username && str_starts_with($name, $username . '__'))) {
                return false;
            }

            if ($existingId) {
                // Explicit alias metadata is updated with its content in one statement.
                $aliasSql = $isPublic !== null ? ', user_id = ?, username = ?, is_public = ?' : '';
                $upd = $pdo->prepare("
                    UPDATE user_chord_sets 
                    SET chords_json = ?, chord_count = ?, checksum = ?, updated_at = CURRENT_TIMESTAMP {$aliasSql}
                    WHERE id = ?
                ");
                $params = [$chordsJson, $chordCount, $checksum];
                if ($isPublic !== null) array_push($params, $userId, $username, (int)$isPublic);
                $params[] = $existingId;
                $upd->execute($params);
            } else {
                $uId = $userId ?: 1;
                $uName = $username ?: 'banhat';
                $isRec = (strcasecmp($name, 'HD') === 0) ? 1 : 0;
                $ins = $pdo->prepare("
                    INSERT INTO user_chord_sets 
                    (song_id, user_id, username, set_name, chord_count, chords_json, checksum, attribution, is_public, is_recommended, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                $ins->execute([$songId, $uId, $uName, $name, $chordCount, $chordsJson, $checksum, $attribution, (int)($isPublic ?? true), $isRec]);
            }
        } catch (Throwable $e) {
            // A privacy change must never succeed via the disk-only fallback.
            if ($isPublic !== null) throw $e;
            // Tiếp tục ghi file disk nếu DB gặp lỗi tạm thời
        }

        // 2. Ghi ra file disk (Write-through cache)
        $file = self::getSetFile($songId, $name, true);
        $jsonPretty = json_encode($chords, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return file_put_contents($file, $jsonPretty) !== false;
    }

    /**
     * Ghi bộ hợp âm chuẩn HD duy nhất (Single Entry Point cho mọi hành vi cập nhật HD):
     * - Luôn bọc trong transaction.
     * - Luôn lưu snapshot bản HD hiện tại vào chord_set_history trước khi ghi đè.
     * - Lưu bản mới vào user_chord_sets và file đĩa.
     */
    public static function writeHd(
        string $songId,
        array $chords,
        ?int $userId = null,
        ?string $username = null,
        ?string $changeReason = null,
        ?int $reviewRequestId = null
    ): bool {
        if (empty($chords)) {
            throw new InvalidArgumentException("Không thể lưu: Bộ hợp âm HD không được rỗng (Core Rule 1)");
        }

        $pdo = DB::get();
        $isOuterTransaction = $pdo->inTransaction();
        if (!$isOuterTransaction) {
            $pdo->beginTransaction();
        }

        try {
            // 1. Snapshot HD hiện tại vào lịch sử
            $currentHd = self::loadSet($songId, 'HD');
            $currentHdJson = json_encode($currentHd, JSON_UNESCAPED_UNICODE);

            $insHist = $pdo->prepare("
                INSERT INTO chord_set_history (
                    song_id, set_name, chords_json, created_by, review_request_id, change_reason, created_at
                ) VALUES (?, 'HD', ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ");
            $insHist->execute([
                $songId,
                $currentHdJson,
                $userId,
                $reviewRequestId,
                $changeReason ?: ("Cập nhật trực tiếp bộ HD bởi @" . ($username ?: 'system'))
            ]);

            // 2. Lưu bộ HD mới
            $ok = self::saveSet($songId, 'HD', $chords, $userId, 'HD');
            if (!$ok) {
                throw new RuntimeException("Lỗi khi lưu bộ hợp âm HD vào hệ thống");
            }

            if (!$isOuterTransaction) {
                $pdo->commit();
            }
            return true;
        } catch (Throwable $e) {
            if (!$isOuterTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Sao chép bản phối (Clone)
     */
    public static function cloneSet(string $songId, string $sourceName, string $targetName, ?int $userId = null, ?string $username = null): bool {
        if (self::isReservedName($targetName)) return false;
        $sourceChords = self::loadSet($songId, $sourceName);
        $attribution = "Sao chép từ bản phối '{$sourceName}'";
        return self::saveSet($songId, $targetName, $sourceChords, $userId, $username, $attribution);
    }

    /**
     * Fork bản phối hợp âm kèm truy vết tác giả gốc (Attribution & Parent ID)
     */
    public static function forkSet(
        string $songId, 
        string $sourceName, 
        string $targetName, 
        int $userId, 
        string $username, 
        array $options = []
    ): array {
        // CORE RULE 3 Guard
        if (self::isReservedName($targetName)) {
            return ['success' => false, 'message' => 'Tên bộ hợp âm không hợp lệ'];
        }

        $pdo = DB::get();

        $ownerStmt = $pdo->prepare("SELECT user_id FROM user_chord_sets WHERE song_id = ? AND set_name = ? COLLATE NOCASE LIMIT 1");
        $ownerStmt->execute([$songId, $targetName]);
        $existingOwner = $ownerStmt->fetchColumn();
        if ($existingOwner !== false && (int)$existingOwner !== $userId) {
            return ['success' => false, 'conflict' => true, 'message' => 'Tên bộ hợp âm đã thuộc về thành viên khác'];
        }
        // 1. Nạp hợp âm nguồn
        $sourceChords = self::loadSet($songId, $sourceName);
        $chordCount = count($sourceChords);
        $checksum = md5(json_encode($sourceChords));
        $chordsJson = json_encode($sourceChords, JSON_UNESCAPED_UNICODE);

        // 2. Tìm parent_id từ source
        $parentId = null;
        $parentStmt = $pdo->prepare("SELECT id, username, set_name FROM user_chord_sets WHERE song_id = ? AND set_name = ? LIMIT 1");
        $parentStmt->execute([$songId, $sourceName]);
        $parentRow = $parentStmt->fetch(PDO::FETCH_ASSOC);
        if ($parentRow) {
            $parentId = (int)$parentRow['id'];
        }

        $sourceAuthor = $parentRow['username'] ?? 'Tác giả gốc';
        $attribution = $options['attribution'] ?? "Fork từ bộ '{$sourceName}' của @{$sourceAuthor}";
        $instrument = $options['instrument_type'] ?? 'guitar';
        $capo = (int)($options['capo_fret'] ?? 0);
        $tempo = (int)($options['custom_tempo'] ?? 80);
        $notes = $options['notes_guide'] ?? "Bản phối chuyển soạn của @{$username}";

        // 3. Tạo bản ghi mới trong DB
        $ins = $pdo->prepare("
            INSERT INTO user_chord_sets 
            (song_id, user_id, username, set_name, instrument_type, capo_fret, custom_tempo, chord_count, notes_guide, chords_json, checksum, parent_id, attribution, is_public, is_recommended, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $ins->execute([$songId, $userId, $username, $targetName, $instrument, $capo, $tempo, $chordCount, $notes, $chordsJson, $checksum, $parentId, $attribution]);
        $newId = (int)$pdo->lastInsertId();

        // 4. Lưu ra file disk
        $safeDiskName = $username . '__' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $targetName);
        self::saveSet($songId, $safeDiskName, $sourceChords, $userId, $username, $attribution);

        return [
            'success' => true,
            'message' => "Đã fork thành công bản phối '{$targetName}' từ '{$sourceName}'",
            'data' => [
                'id' => $newId,
                'song_id' => $songId,
                'set_name' => $targetName,
                'disk_set_name' => $safeDiskName,
                'parent_id' => $parentId,
                'attribution' => $attribution,
                'chord_count' => $chordCount
            ]
        ];
    }

    /**
     * Xóa bộ hợp âm
     */
    public static function deleteSet(string $songId, string $name, ?int $userId = null, bool $isAdmin = false): bool {
        // CORE RULE 3: default, TLH và HD là bất biến tuyệt đối, cấm xóa!
        if ($name === 'default' || $name === 'TLH' || $name === 'HD') {
            return false;
        }
        if (!$isAdmin && !$userId) return false;

        // 1. Xóa trong CSDL SQLite
        try {
            $pdo = DB::get();
            // Protect the stored set, including requests using username-qualified aliases.
            $sql = "DELETE FROM user_chord_sets WHERE song_id = ? AND (set_name = ? OR username || '__' || set_name = ?) AND LOWER(set_name) NOT IN ('hd', 'tlh', 'default')";
            if (!$isAdmin && $userId) {
                $sql .= " AND user_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$songId, $name, $name, $userId]);
            } else {
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$songId, $name, $name]);
            }
            if ($stmt->rowCount() === 0) return false;
        } catch (Throwable $e) {
            return false;
        }

        // 2. Xóa file đĩa nếu có
        $file = self::getSetFile($songId, $name);
        if (file_exists($file)) {
            @unlink($file);
        }

        return true;
    }

    /**
     * Lấy chi tiết thông tin bộ hợp âm (Metadata + Attribution)
     */
    public static function getSetDetails(string $songId, string $name): ?array {
        try {
            $pdo = DB::get();
            $stmt = $pdo->prepare("
                SELECT id, song_id, user_id, username, set_name, instrument_type, capo_fret, custom_tempo, chord_count, notes_guide, checksum, parent_id, attribution, is_public, is_recommended, updated_at
                FROM user_chord_sets 
                WHERE song_id = ? AND (set_name = ? COLLATE NOCASE OR username || '__' || set_name = ? COLLATE NOCASE)
                  AND " . self::READABLE_SQL . "
                ORDER BY (set_name = ?) DESC, id ASC
                LIMIT 1
            ");
            $stmt->execute([$songId, $name, $name, Auth::userId() ?? 0, $name]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        } catch (Throwable $e) {
            return null;
        }
    }
}
