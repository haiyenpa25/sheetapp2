<?php
/**
 * api/services/ManagerVersionHelper.php
 * Trợ thủ xử lý các phiên bản MusicXML Fork (Tab 3) cho ManagerService
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/SongService.php';

class ManagerVersionHelper {

    /**
     * Lấy danh sách các phiên bản MusicXML Fork (Tab 3)
     */
    public static function getVersionsList(array $filters = []): array {
        $pdo = DB::get();

        $where = [SongService::visibilitySqlClause('s'), '(v.is_public = 1 OR v.user_id = ? OR ? = 1)'];
        $params = [Auth::userId() ?? 0, (int)Auth::isAdmin()];

        if (!empty($filters['song_id'])) {
            $where[] = "v.song_id = ?";
            $params[] = $filters['song_id'];
        }

        if (!empty($filters['user_id'])) {
            $where[] = "v.user_id = ?";
            $params[] = (int)$filters['user_id'];
        }

        if (!empty($filters['username'])) {
            $where[] = "v.username = ?";
            $params[] = $filters['username'];
        }

        if (!empty($filters['recommended_only'])) {
            $where[] = "v.is_recommended = 1";
        }

        if (!empty($filters['keyword'])) {
            $kw = '%' . $filters['keyword'] . '%';
            $where[] = "(v.version_name LIKE ? OR s.title LIKE ? OR s.httlvnId LIKE ? OR v.username LIKE ? OR u.display_name LIKE ?)";
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $limit = isset($filters['limit']) ? max(1, min(200, (int)$filters['limit'])) : 60;
        $offset = isset($filters['offset']) ? max(0, (int)$filters['offset']) : 0;

        $sql = "
            SELECT v.*,
                   s.title as song_title, s.httlvnId, s.defaultKey, s.xmlPath as master_xml_path,
                   u.display_name, u.role as user_role, u.instrument as user_instrument
            FROM song_versions v
            JOIN songs s ON v.song_id = s.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY v.is_recommended DESC, v.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $versions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Đếm tổng số để phân trang
        $countSql = "
            SELECT COUNT(*)
            FROM song_versions v
            JOIN songs s ON v.song_id = s.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE " . implode(' AND ', $where);
        $stmtCount = $pdo->prepare($countSql);
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        return [
            'versions' => $versions,
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset
        ];
    }

    /**
     * Xóa một phiên bản MusicXML Fork
     */
    public static function deleteVersion(int $versionId): array {
        Auth::requireLogin();
        $pdo = DB::get();
        $userId = Auth::userId();
        $isAdmin = Auth::isAdmin();

        $stmt = $pdo->prepare("SELECT * FROM song_versions WHERE id = ?");
        $stmt->execute([$versionId]);
        $version = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$version) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }

        if (!$isAdmin && $version['user_id'] != $userId) {
            return ['success' => false, 'message' => 'Bạn không có quyền xóa phiên bản này'];
        }

        // Xóa file MusicXML trên đĩa nếu tồn tại và nằm trong storage
        if (!empty($version['xml_path'])) {
            $absPath = __DIR__ . '/../../' . ltrim($version['xml_path'], '/\\');
            if (file_exists($absPath) && strpos(realpath($absPath), realpath(__DIR__ . '/../../storage')) === 0) {
                // Tuyệt đối không xóa file trong storage/Thanh ca/
                if (strpos($absPath, 'storage/Thanh ca/') === false) {
                    @unlink($absPath);
                    $bakFile = $absPath . '.bak';
                    if (file_exists($bakFile)) @unlink($bakFile);
                }
            }
        }

        $delStmt = $pdo->prepare("DELETE FROM song_versions WHERE id = ?");
        $delStmt->execute([$versionId]);

        return ['success' => true, 'message' => 'Đã xóa phiên bản MusicXML thành công'];
    }

    /**
     * Bật/Tắt ghim khuyên dùng cho phiên bản MusicXML
     */
    public static function toggleVersionRecommend(int $versionId): array {
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            Response::abort(403, 'Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền ghim/bỏ ghim khuyên dùng');
        }
        $pdo = DB::get();

        $stmt = $pdo->prepare("SELECT is_recommended FROM song_versions WHERE id = ?");
        $stmt->execute([$versionId]);
        $curr = $stmt->fetchColumn();

        if ($curr === false) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }

        $newVal = $curr == 1 ? 0 : 1;
        $upStmt = $pdo->prepare("UPDATE song_versions SET is_recommended = ? WHERE id = ?");
        $upStmt->execute([$newVal, $versionId]);

        return [
            'success' => true,
            'is_recommended' => $newVal,
            'message' => $newVal == 1 ? 'Đã ghim khuyên dùng cho phiên bản này' : 'Đã bỏ ghim khuyên dùng'
        ];
    }
}
