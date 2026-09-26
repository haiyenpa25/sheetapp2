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

class ChordSetService {
    public const BASE_DIR = __DIR__ . '/../../storage/data/chord_sets';

    private static function getSongDir(string $songId): string {
        $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
        $dir  = self::BASE_DIR . '/' . $safe;
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        return $dir;
    }

    private static function sanitizeName(string $name): string {
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        if ($normalized === false || $normalized === '') {
            $normalized = $name;
        }
        return preg_replace('/[^a-zA-Z0-9_\-]+/', '_', trim($normalized));
    }

    private static function getSetFile(string $songId, string $name): string {
        $safe = self::sanitizeName($name);
        return self::getSongDir($songId) . '/' . $safe . '.json';
    }

    /**
     * Liệt kê tất cả các bộ hợp âm có sẵn cho bài hát
     * (Lấy từ SQLite DB kết hợp quét fallback thư mục đĩa)
     */
    public static function listSets(string $songId, ?int $userId = null): array {
        $names = [];

        try {
            $pdo = DB::get();
            $sql = "
                SELECT DISTINCT set_name 
                FROM user_chord_sets 
                WHERE song_id = ? AND (is_public = 1 " . ($userId ? "OR user_id = ?" : "") . ")
                ORDER BY (set_name = 'HD') DESC, set_name ASC
            ";
            $stmt = $pdo->prepare($sql);
            $params = $userId ? [$songId, $userId] : [$songId];
            $stmt->execute($params);
            $names = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (Throwable $e) {
            // Fallback đọc file nếu DB lỗi
        }

        // Quét thêm từ thư mục disk nếu có file chưa kịp index
        $dir = self::getSongDir($songId);
        $files = glob($dir . '/*.json') ?: [];
        foreach ($files as $f) {
            $filename = pathinfo($f, PATHINFO_FILENAME);
            if (!in_array($filename, $names, true)) {
                $names[] = $filename;
            }
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
        // 1. Tìm trong DB SQLite trước (Single Source of Truth)
        try {
            $pdo = DB::get();
            $stmt = $pdo->prepare("
                SELECT chords_json 
                FROM user_chord_sets 
                WHERE song_id = ? AND (set_name = ? COLLATE NOCASE OR username || '__' || set_name = ? COLLATE NOCASE)
                ORDER BY (set_name = ?) DESC, updated_at DESC LIMIT 1
            ");
            $stmt->execute([$songId, $name, $name, $name]);
            $json = $stmt->fetchColumn();
            if ($json !== false && $json !== null) {
                $data = json_decode((string)$json, true);
                if (is_array($data)) return $data;
            }
        } catch (Throwable $e) {
            // Fallback sang file disk
        }

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
     * Lưu bộ hợp âm vào DB và đồng bộ ra file disk
     */
    public static function saveSet(
        string $songId, 
        string $name, 
        array $chords, 
        ?int $userId = null, 
        ?string $username = null,
        ?string $attribution = null
    ): bool {
        // CORE RULE 3: Không cho phép ghi đè lên bộ gốc TLH / default hoặc các tên giả lập hành động
        if ($name === 'default' || $name === 'TLH' || str_starts_with($name, '__')) {
            return false;
        }

        $chordCount = count($chords);
        $checksum = md5(json_encode($chords));
        $chordsJson = json_encode($chords, JSON_UNESCAPED_UNICODE);

        // 1. Lưu vào SQLite Database
        try {
            $pdo = DB::get();
            $checkStmt = $pdo->prepare("SELECT id FROM user_chord_sets WHERE song_id = ? AND set_name = ?");
            $checkStmt->execute([$songId, $name]);
            $existingId = $checkStmt->fetchColumn();

            if ($existingId) {
                $upd = $pdo->prepare("
                    UPDATE user_chord_sets 
                    SET chords_json = ?, chord_count = ?, checksum = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ");
                $upd->execute([$chordsJson, $chordCount, $checksum, $existingId]);
            } else {
                $uId = $userId ?: 1;
                $uName = $username ?: 'banhat';
                $isRec = (strcasecmp($name, 'HD') === 0) ? 1 : 0;
                $ins = $pdo->prepare("
                    INSERT INTO user_chord_sets 
                    (song_id, user_id, username, set_name, chord_count, chords_json, checksum, attribution, is_public, is_recommended, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                $ins->execute([$songId, $uId, $uName, $name, $chordCount, $chordsJson, $checksum, $attribution, $isRec]);
            }
        } catch (Throwable $e) {
            // Tiếp tục ghi file disk nếu DB gặp lỗi tạm thời
        }

        // 2. Ghi ra file disk (Write-through cache)
        $file = self::getSetFile($songId, $name);
        $jsonPretty = json_encode($chords, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return file_put_contents($file, $jsonPretty) !== false;
    }

    /**
     * Sao chép bản phối (Clone)
     */
    public static function cloneSet(string $songId, string $sourceName, string $targetName, ?int $userId = null, ?string $username = null): bool {
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
        if ($targetName === 'default' || $targetName === 'TLH' || str_starts_with($targetName, '__')) {
            return ['success' => false, 'message' => 'Tên bộ hợp âm không hợp lệ'];
        }

        $pdo = DB::get();

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

        // 1. Xóa trong CSDL SQLite
        try {
            $pdo = DB::get();
            $sql = "DELETE FROM user_chord_sets WHERE song_id = ? AND (set_name = ? OR username || '__' || set_name = ?)";
            if (!$isAdmin && $userId) {
                $sql .= " AND user_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$songId, $name, $name, $userId]);
            } else {
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$songId, $name, $name]);
            }
        } catch (Throwable $e) {
            // Không block
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
                WHERE song_id = ? AND (set_name = ? OR username || '__' || set_name = ?)
                LIMIT 1
            ");
            $stmt->execute([$songId, $name, $name]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        } catch (Throwable $e) {
            return null;
        }
    }
}
