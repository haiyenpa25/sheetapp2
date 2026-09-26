<?php
/**
 * api/services/ReviewService.php
 *
 * Dịch vụ Quản trị Quy trình Phê duyệt & Lịch sử Bộ Hợp Âm (Epic 4.2):
 * - Quản lý hàng đợi đề xuất duyệt bộ hợp âm khuyên dùng hoặc cập nhật bộ HD chính.
 * - Tích hợp Diff Engine phân tích sự thay đổi chi tiết giữa bản gốc và bản đề xuất.
 * - Bảo vệ Core Rules:
 *   + CR1: Không cho phép duyệt đề xuất làm bộ HD rỗng.
 *   + CR3: Khóa tuyệt đối không xóa bộ HD hoặc TLH.
 *   + CR4: Mọi lần cập nhật HD đều ghi nhận snapshot lịch sử vào chord_set_history để hoàn tác an toàn.
 * - Cơ chế phân quyền: Chỉ Ca Trưởng (leader) hoặc Quản trị viên (admin) mới có quyền duyệt / từ chối / hoàn tác.
 * - Ghi nhật ký kiểm toán (AuditLogger) và kích hoạt Domain Events (NotificationService).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/ReviewDiffEngine.php';
require_once __DIR__ . '/DomainEventService.php';
require_once __DIR__ . '/NotificationService.php';
require_once __DIR__ . '/ReviewActionHelper.php';

class ReviewService {
    /**
     * Gửi đề xuất phê duyệt bộ hợp âm hoặc phiên bản
     */
    public static function submit(
        int $userId,
        string $targetType,
        int $targetId,
        string $songId,
        string $reviewType = 'recommend',
        ?string $submitNote = null
    ): array {
        if ($targetId <= 0 || empty($songId)) {
            throw new InvalidArgumentException("Dữ liệu đề xuất không hợp lệ");
        }

        if (!in_array($targetType, ['chord_set', 'song_version'], true)) {
            throw new InvalidArgumentException("target_type không hợp lệ: {$targetType}");
        }

        if (!in_array($reviewType, ['recommend', 'update_hd'], true)) {
            throw new InvalidArgumentException("review_type không hợp lệ: {$reviewType}");
        }

        $pdo = DB::get();

        // 1. Kiểm tra target tồn tại và lấy snapshot
        $proposedSnapshot = null;
        $baseSnapshot = null;
        $targetTitle = '';

        if ($targetType === 'chord_set') {
            $stmt = $pdo->prepare("SELECT * FROM user_chord_sets WHERE id = ?");
            $stmt->execute([$targetId]);
            $chordSet = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chordSet) {
                throw new InvalidArgumentException("Bộ hợp âm không tồn tại");
            }

            // Kiểm tra quyền sở hữu (hoặc admin/leader)
            if ((int)$chordSet['user_id'] !== $userId && !Auth::isAdmin() && !Auth::isLeader()) {
                throw new DomainException("Chỉ chủ sở hữu bộ hợp âm mới có quyền gửi đề xuất");
            }

            $targetTitle = $chordSet['set_name'];
            $proposedSnapshot = $chordSet['chords_json'] ?: '[]';

            // Base snapshot
            if ($reviewType === 'update_hd') {
                $hdChords = ChordSetService::loadSet($songId, 'HD');
                $baseSnapshot = json_encode($hdChords, JSON_UNESCAPED_UNICODE);
            } else {
                // Với recommend, base là bộ HD hiện tại để so sánh sự khác biệt
                $hdChords = ChordSetService::loadSet($songId, 'HD');
                $baseSnapshot = json_encode($hdChords, JSON_UNESCAPED_UNICODE);
            }

            $diffData = ReviewDiffEngine::diffChordSets($baseSnapshot, $proposedSnapshot);
        } else {
            // Target là song_version
            $stmt = $pdo->prepare("SELECT * FROM song_versions WHERE id = ?");
            $stmt->execute([$targetId]);
            $version = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$version) {
                throw new InvalidArgumentException("Phiên bản bài hát không tồn tại");
            }

            if ((int)$version['user_id'] !== $userId && !Auth::isAdmin() && !Auth::isLeader()) {
                throw new DomainException("Chỉ chủ sở hữu phiên bản mới có quyền gửi đề xuất");
            }

            $targetTitle = $version['version_name'];
            $xmlPath = $version['xml_path'];
            $proposedXml = file_exists($xmlPath) ? file_get_contents($xmlPath) : '';
            $proposedSnapshot = json_encode(['xml_path' => $xmlPath, 'version_name' => $version['version_name']], JSON_UNESCAPED_UNICODE);

            $song = SongService::getById($songId);
            $baseXmlPath = $song['xmlPath'] ?? '';
            $baseXml = file_exists($baseXmlPath) ? file_get_contents($baseXmlPath) : '';
            $baseSnapshot = json_encode(['xml_path' => $baseXmlPath, 'version_name' => 'Bản gốc'], JSON_UNESCAPED_UNICODE);

            $diffData = ReviewDiffEngine::diffMusicXml($baseXml, $proposedXml);
        }

        $diffSummaryJson = json_encode($diffData['summary'] ?? [], JSON_UNESCAPED_UNICODE);

        // 2. Chuyển các đề xuất pending cũ của cùng target thành 'superseded'
        $pdo->prepare("
            UPDATE review_requests 
            SET status = 'superseded', updated_at = CURRENT_TIMESTAMP 
            WHERE target_type = ? AND target_id = ? AND status = 'pending'
        ")->execute([$targetType, $targetId]);

        // 3. Tạo đề xuất mới
        $ins = $pdo->prepare("
            INSERT INTO review_requests (
                target_type, target_id, song_id, review_type,
                base_snapshot_json, proposed_snapshot_json, diff_summary_json,
                submitted_by, status, submit_note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $ins->execute([
            $targetType,
            $targetId,
            $songId,
            $reviewType,
            $baseSnapshot,
            $proposedSnapshot,
            $diffSummaryJson,
            $userId,
            $submitNote
        ]);
        $reviewId = (int)$pdo->lastInsertId();

        // 4. Cập nhật review_status trên bảng target
        if ($targetType === 'chord_set') {
            $pdo->prepare("UPDATE user_chord_sets SET review_status = 'pending' WHERE id = ?")->execute([$targetId]);
        } else {
            $pdo->prepare("UPDATE song_versions SET review_status = 'pending' WHERE id = ?")->execute([$targetId]);
        }

        // 5. Ghi nhật ký & Domain Event
        AuditLogger::log('review_submit', $userId, $reviewId, [
            'target_type' => $targetType,
            'target_id'   => $targetId,
            'song_id'     => $songId,
            'review_type' => $reviewType
        ]);

        DomainEvents::record('review.submitted', $userId, 'review_request', (string)$reviewId, [
            'target_type'  => $targetType,
            'target_title' => $targetTitle,
            'song_id'      => $songId,
            'review_type'  => $reviewType
        ]);

        return [
            'success'      => true,
            'id'           => $reviewId,
            'request_id'   => $reviewId,
            'status'       => 'pending',
            'review_type'  => $reviewType,
            'target_type'  => $targetType,
            'diff_summary' => $diffData['summary'] ?? []
        ];
    }

    /**
     * Lấy hàng đợi phê duyệt dành cho Ca Trưởng / Quản Trị Viên
     */
    public static function getQueue(array $filters = [], int $page = 1, int $limit = 20): array {
        $pdo = DB::get();
        $where = ["1=1"];
        $params = [];

        $status = $filters['status'] ?? 'pending';
        if ($status !== 'all') {
            $where[] = "r.status = ?";
            $params[] = $status;
        }

        if (!empty($filters['target_type'])) {
            $where[] = "r.target_type = ?";
            $params[] = $filters['target_type'];
        }

        if (!empty($filters['review_type'])) {
            $where[] = "r.review_type = ?";
            $params[] = $filters['review_type'];
        }

        if (!empty($filters['song_id'])) {
            $where[] = "r.song_id = ?";
            $params[] = $filters['song_id'];
        }

        $whereSql = implode(" AND ", $where);
        $offset = max(0, ($page - 1) * $limit);

        // Đếm tổng
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM review_requests r WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Lấy danh sách
        $sql = "
            SELECT r.*,
                   u.username AS submitter_username,
                   u.display_name AS submitter_display_name,
                   u.role AS submitter_role,
                   rev.display_name AS reviewer_display_name,
                   so.title AS song_title,
                   so.defaultKey,
                   so.httlvnId
            FROM review_requests r
            JOIN users u ON u.id = r.submitted_by
            LEFT JOIN users rev ON rev.id = r.reviewer_id
            LEFT JOIN songs so ON so.id = r.song_id
            WHERE {$whereSql}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ";
        $fetchParams = array_merge($params, [$limit, $offset]);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($fetchParams);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Giải mã JSON summary
        foreach ($items as &$it) {
            $it['diff_summary'] = $it['diff_summary_json'] ? json_decode($it['diff_summary_json'], true) : [];
            unset($it['base_snapshot_json'], $it['proposed_snapshot_json']); // Giảm tải dữ liệu trong danh sách
        }

        return [
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
            'items' => $items
        ];
    }

    /**
     * Lấy danh sách đề xuất của cá nhân
     */
    public static function getMyRequests(int $userId): array {
        $pdo = DB::get();
        $sql = "
            SELECT r.*,
                   so.title AS song_title,
                   rev.display_name AS reviewer_display_name
            FROM review_requests r
            LEFT JOIN songs so ON so.id = r.song_id
            LEFT JOIN users rev ON rev.id = r.reviewer_id
            WHERE r.submitted_by = ?
            ORDER BY r.created_at DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$it) {
            $it['diff_summary'] = $it['diff_summary_json'] ? json_decode($it['diff_summary_json'], true) : [];
            unset($it['base_snapshot_json'], $it['proposed_snapshot_json']);
        }

        return $items;
    }

    /**
     * Lấy chi tiết một đề xuất kèm Diff chi tiết đầy đủ
     */
    public static function getDetail(int $reviewId): ?array {
        $pdo = DB::get();
        $sql = "
            SELECT r.*,
                   u.username AS submitter_username,
                   u.display_name AS submitter_display_name,
                   rev.display_name AS reviewer_display_name,
                   so.title AS song_title,
                   so.defaultKey,
                   so.httlvnId
            FROM review_requests r
            JOIN users u ON u.id = r.submitted_by
            LEFT JOIN users rev ON rev.id = r.reviewer_id
            LEFT JOIN songs so ON so.id = r.song_id
            WHERE r.id = ?
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$reviewId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) return null;

        // Tính toán diff chi tiết đầy đủ
        $diff = [];
        if ($row['target_type'] === 'chord_set') {
            $diff = ReviewDiffEngine::diffChordSets($row['base_snapshot_json'], $row['proposed_snapshot_json']);
        } else {
            $base = json_decode((string)$row['base_snapshot_json'], true);
            $prop = json_decode((string)$row['proposed_snapshot_json'], true);
            $baseXml = isset($base['xml_path']) && file_exists($base['xml_path']) ? file_get_contents($base['xml_path']) : '';
            $propXml = isset($prop['xml_path']) && file_exists($prop['xml_path']) ? file_get_contents($prop['xml_path']) : '';
            $diff = ReviewDiffEngine::diffMusicXml($baseXml, $propXml);
        }

        $row['diff'] = $diff;
        return $row;
    }

    /**
     * Phê duyệt đề xuất (Chỉ dành cho Ca Trưởng hoặc Admin)
     */
    /**
     * Phê duyệt đề xuất (Chỉ dành cho Ca Trưởng hoặc Admin)
     */
    public static function approve(int $reviewId, int $reviewerId, ?string $reviewNote = null): array {
        return ReviewActionHelper::approve($reviewId, $reviewerId, $reviewNote);
    }

    /**
     * Từ chối đề xuất (Bắt buộc có lý do)
     */
    public static function reject(int $reviewId, int $reviewerId, string $reviewNote): array {
        return ReviewActionHelper::reject($reviewId, $reviewerId, $reviewNote);
    }

    /**
     * Người đề xuất tự rút lại đề xuất khi còn pending
     */
    public static function withdraw(int $reviewId, int $userId): array {
        return ReviewActionHelper::withdraw($reviewId, $userId);
    }

    /**
     * Hoàn tác (Rollback) bộ hợp âm HD về một bản ghi lịch sử trước đó
     */
    public static function rollbackHd(int $historyId, int $actorId): array {
        return ReviewActionHelper::rollbackHd($historyId, $actorId);
    }

    /**
     * Lấy danh sách lịch sử các phiên bản bộ HD của một bài hát
     */
    public static function getHdHistory(string $songId): array {
        return ReviewActionHelper::getHdHistory($songId);
    }
}
