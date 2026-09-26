<?php
/**
 * api/services/SongVersionHelper.php
 * Trợ thủ quản lý lưu trữ MusicXML, phiên bản người dùng (Song Versions) & khôi phục bản sao lưu
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';

class SongVersionHelper {

    public static function slugify(string $text): string {
        $text = mb_strtolower($text, 'UTF-8');
        $from = ['à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ',
                 'đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ',
                 'ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ',
                 'ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ',
                 'ỳ','ý','ỷ','ỹ','ỵ'];
        $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
                 'd','e','e','e','e','e','e','e','e','e','e','e',
                 'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
                 'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
                 'y','y','y','y','y'];
        $text = str_replace($from, $to, $text);
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        return substr(preg_replace('/[\s-]+/', '-', trim($text)), 0, 80);
    }

    public static function saveXml(string $filepath, string $xmlContent): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        require_once __DIR__ . '/SongService.php';
        $targetPath = SongService::resolveManagedXmlPath($filepath);

        if ($targetPath === null) {
            return ['success' => false, 'message' => 'Lỗi: File không tồn tại trên server: ' . htmlspecialchars($filepath)];
        }

        if (strpos($targetPath, $storageRoot) !== 0) {
            return ['success' => false, 'message' => 'Lỗi: Truy cập file ngoài vùng quản lý bị từ chối.'];
        }

        // BẢO VỆ BẢN GỐC: Không cho ghi đè trực tiếp kho bản gốc nếu không phải Super Admin
        $thanhCaRoot = realpath(__DIR__ . '/../../storage/Thanh ca');
        if ($thanhCaRoot && strpos($targetPath, $thanhCaRoot) === 0 && !Auth::isAdmin()) {
            return [
                'success' => false,
                'message' => '🛡️ Bản gốc được khóa bảo vệ an toàn. Vui lòng chọn "Lưu Thành Phiên Bản" để tạo bản chỉnh sửa theo tài khoản của bạn.'
            ];
        }

        if (pathinfo($targetPath, PATHINFO_EXTENSION) !== 'xml') {
             return ['success' => false, 'message' => 'Lỗi: Chỉ cho phép ghi file .xml'];
        }

        // Tự động sao lưu an toàn bản gốc .xml.bak trước khi ghi đè
        $backupPath = $targetPath . '.bak';
        @copy($targetPath, $backupPath);

        $result = file_put_contents($targetPath, $xmlContent);

        if ($result === false) {
            return ['success' => false, 'message' => 'Lỗi: Không có quyền ghi đè (Permission denied). Hãy kiểm tra Folder Permissions!'];
        }

        return ['success' => true, 'message' => 'Đã lưu thành công vào file MusicXML. Đã tạo bản sao lưu dự phòng an toàn (.bak).'];
    }

    public static function restoreXmlBackup(string $filepath): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        require_once __DIR__ . '/SongService.php';
        $targetPath = SongService::resolveManagedXmlPath($filepath);
        if ($targetPath === null) {
            return ['success' => false, 'message' => 'Lỗi: File gốc không tồn tại.'];
        }
        if (strpos($targetPath, $storageRoot) !== 0) {
            return ['success' => false, 'message' => 'Lỗi: Quyền truy cập bị từ chối.'];
        }
        $backupPath = $targetPath . '.bak';
        if (!file_exists($backupPath)) {
            return ['success' => false, 'message' => 'Chưa có bản sao lưu .bak cho bài hát này.'];
        }
        $res = @copy($backupPath, $targetPath);
        if (!$res) {
            return ['success' => false, 'message' => 'Không thể khôi phục từ file sao lưu.'];
        }
        return ['success' => true, 'message' => 'Đã khôi phục thành công bản nhạc từ file sao lưu .bak!'];
    }

    /**
     * Lấy danh sách các phiên bản của bài hát
     */
    public static function getVersions(string $songId): array {
        try {
            $stmt = DB::run("SELECT * FROM song_versions WHERE song_id = ? ORDER BY created_at DESC", [$songId]);
            return $stmt->fetchAll();
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * Lưu phiên bản sheet nhạc theo người dùng
     */
    public static function saveVersion(string $songId, string $xmlContent, string $versionName, ?int $versionId = null, ?string $description = null): array {
        $storageRoot = realpath(__DIR__ . '/../../storage');
        if (!$storageRoot) {
            return ['success' => false, 'message' => 'Lỗi: Thư mục storage không tồn tại'];
        }

        $userId = Auth::userId() ?? 1;
        $username = Auth::username() ?: 'banhat';
        $safeUsername = preg_replace('/[^a-zA-Z0-9_\-]/', '_', strtolower($username));
        $safeSongId   = preg_replace('/[^a-zA-Z0-9_\-]/', '_', strtolower($songId));

        $userSongDir = $storageRoot . '/users/' . $safeUsername . '/' . $safeSongId;
        if (!is_dir($userSongDir)) {
            if (!mkdir($userSongDir, 0775, true) && !is_dir($userSongDir)) {
                return ['success' => false, 'message' => 'Lỗi: Không thể tạo thư mục người dùng trên server'];
            }
        }

        // Trường hợp 1: Ghi đè phiên bản hiện có
        if ($versionId) {
            $ver = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
            if (!$ver) {
                return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
            }
            if ($ver['user_id'] != $userId && !Auth::isAdmin()) {
                return ['success' => false, 'message' => 'Bạn không có quyền sửa phiên bản của người khác'];
            }

            $targetPath = realpath(__DIR__ . '/../../' . ltrim($ver['xml_path'], '/\\'));
            if (!$targetPath) {
                $targetPath = $storageRoot . '/' . ltrim(str_replace('storage/', '', $ver['xml_path']), '/\\');
            }

            // Backup trước khi ghi đè
            if (file_exists($targetPath)) {
                @copy($targetPath, $targetPath . '.bak');
            }

            $res = file_put_contents($targetPath, $xmlContent);
            if ($res === false) {
                return ['success' => false, 'message' => 'Lỗi: Không thể ghi đè file phiên bản'];
            }

            $finalName = !empty($versionName) ? $versionName : $ver['version_name'];
            $finalDesc = $description !== null ? $description : $ver['description'];

            DB::run("UPDATE song_versions SET version_name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
                [$finalName, $finalDesc, $versionId]
            );

            $updated = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
            return [
                'success' => true,
                'message' => "Đã cập nhật thành công phiên bản '{$finalName}'!",
                'data' => $updated
            ];
        }

        // Trường hợp 2: Tạo phiên bản mới
        $existingCount = (int)DB::run("SELECT COUNT(*) FROM song_versions WHERE song_id = ? AND user_id = ?", [$songId, $userId])->fetchColumn();
        $nextIdx = $existingCount + 1;

        $cleanName = trim($versionName);
        if ($cleanName === '') {
            $cleanName = "Phiên bản {$nextIdx} (" . date('d/m/Y') . ")";
        }
        $slugPart = self::slugify($cleanName);
        $slugPart = substr(preg_replace('/[^a-z0-9\-]/', '', $slugPart), 0, 30);
        if (!$slugPart) $slugPart = "ver-{$nextIdx}";

        $versionSlug = "v{$nextIdx}_{$slugPart}";
        $filename = "{$versionSlug}.xml";
        $fullFilePath = $userSongDir . '/' . $filename;
        $relativeXmlPath = "storage/users/{$safeUsername}/{$safeSongId}/{$filename}";

        $res = file_put_contents($fullFilePath, $xmlContent);
        if ($res === false) {
            return ['success' => false, 'message' => 'Lỗi: Không thể lưu file MusicXML của phiên bản mới'];
        }
        // Tạo luôn bản .bak ban đầu
        @copy($fullFilePath, $fullFilePath . '.bak');

        DB::run(
            "INSERT INTO song_versions (song_id, user_id, username, version_name, version_slug, xml_path, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [$songId, $userId, $username, $cleanName, $versionSlug, $relativeXmlPath, $description ?? '']
        );
        $newId = DB::lastId();
        $newRecord = DB::run("SELECT * FROM song_versions WHERE id = ?", [$newId])->fetch();

        return [
            'success' => true,
            'message' => "Đã tạo thành công phiên bản mới: '{$cleanName}'!",
            'data' => $newRecord
        ];
    }

    /**
     * Xóa một phiên bản
     */
    public static function deleteVersion(int $versionId): array {
        $userId = Auth::userId() ?? 1;
        $ver = DB::run("SELECT * FROM song_versions WHERE id = ?", [$versionId])->fetch();
        if (!$ver) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }
        if ($ver['user_id'] != $userId && !Auth::isAdmin()) {
            return ['success' => false, 'message' => 'Bạn không có quyền xóa phiên bản này'];
        }

        $filePath = __DIR__ . '/../../' . ltrim($ver['xml_path'], '/\\');
        if (file_exists($filePath)) @unlink($filePath);
        if (file_exists($filePath . '.bak')) @unlink($filePath . '.bak');

        DB::run("DELETE FROM song_versions WHERE id = ?", [$versionId]);
        return ['success' => true, 'message' => 'Đã xóa phiên bản thành công'];
    }
}
