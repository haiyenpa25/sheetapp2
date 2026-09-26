<?php
/**
 * api/services/ReviewActionHelper.php
 *
 * Helper xử lý các hành động duyệt đề xuất, từ chối, rút lại và hoàn tác (Rollback HD).
 * Tách từ ReviewService nhằm bảo đảm ngân sách mã nguồn (Code Budget < 600 dòng).
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/AuditLogger.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/DomainEventService.php';
require_once __DIR__ . '/NotificationService.php';

class ReviewActionHelper {

    /**
     * Phê duyệt đề xuất (Chỉ dành cho Ca Trưởng hoặc Admin)
     */
    public static function approve(int $reviewId, int $reviewerId, ?string $reviewNote = null): array {
        // Kiểm tra quyền nghiêm ngặt
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            throw new DomainException("Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền phê duyệt đề xuất này");
        }

        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT * FROM review_requests WHERE id = ?");
        $stmt->execute([$reviewId]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            throw new InvalidArgumentException("Không tìm thấy đề xuất phê duyệt: {$reviewId}");
        }

        if ($req['status'] !== 'pending') {
            throw new DomainException("Đề xuất này đã được xử lý trước đó (Trạng thái: {$req['status']})");
        }

        // Quyết định B5: Leader không được tự duyệt đề xuất của chính mình, trừ Quản trị viên (Admin)
        if ((int)$req['submitted_by'] === $reviewerId && !Auth::isAdmin()) {
            Response::abort(403, "Người gửi đề xuất không được tự phê duyệt đề xuất của chính mình (Quyết định B5)");
        }

        $songId = $req['song_id'];
        $targetId = (int)$req['target_id'];
        $reviewType = $req['review_type'];
        $targetType = $req['target_type'];

        $isOuterTx = $pdo->inTransaction();
        if (!$isOuterTx) {
            $pdo->beginTransaction();
        }

        try {
            // ── 1. Xử lý theo loại đề xuất ───────────────────────────────
            if ($reviewType === 'recommend') {
                // Gắn cờ Khuyên Dùng (is_recommended = 1)
                if ($targetType === 'chord_set') {
                    $up = $pdo->prepare("
                        UPDATE user_chord_sets 
                        SET is_recommended = 1, review_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    ");
                    $up->execute([$reviewerId, $targetId]);
                } else {
                    $up = $pdo->prepare("
                        UPDATE song_versions 
                        SET is_recommended = 1, review_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    ");
                    $up->execute([$reviewerId, $targetId]);
                }
            } elseif ($reviewType === 'update_hd') {
                // Cập nhật vào bộ HD chính thức
                $proposedChords = json_decode((string)$req['proposed_snapshot_json'], true);
                if (!is_array($proposedChords) || empty($proposedChords)) {
                    // CORE RULE 1: Không cho phép đề xuất làm rỗng bộ HD
                    throw new DomainException("Không thể duyệt: Bộ hợp âm đề xuất rỗng (Vi phạm Core Rule 1)");
                }

                // CORE RULE 4: Lưu snapshot và ghi bộ HD duy nhất qua writeHd
                ChordSetService::writeHd(
                    $songId,
                    $proposedChords,
                    $reviewerId,
                    'HD',
                    "Cập nhật từ Đề xuất #{$reviewId} của người dùng #" . $req['submitted_by'],
                    $reviewId
                );

                // Cập nhật target review_status
                $pdo->prepare("
                    UPDATE user_chord_sets 
                    SET review_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ")->execute([$reviewerId, $targetId]);
            }

            // ── 2. Cập nhật review_requests ─────────────────────────────
            $pdo->prepare("
                UPDATE review_requests 
                SET status = 'approved', reviewer_id = ?, review_note = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ")->execute([$reviewerId, $reviewNote, $reviewId]);

            // ── 3. Audit & Domain Event ──────────────────────────────────
            AuditLogger::log('review_approve', $reviewerId, $reviewId, [
                'review_type' => $reviewType,
                'target_type' => $targetType,
                'target_id'   => $targetId,
                'song_id'     => $songId
            ]);

            // Phát sự kiện miền: DomainEvents tự động gọi NotificationService::fanOut để gửi thông báo 1 lần duy nhất
            DomainEvents::record('review.decided', $reviewerId, 'review_request', (string)$reviewId, [
                'decision'     => 'approved',
                'submitted_by' => $req['submitted_by'],
                'song_id'      => $songId,
                'review_type'  => $reviewType
            ]);

            if (!$isOuterTx) {
                $pdo->commit();
            }

            return ['success' => true, 'status' => 'approved'];
        } catch (Throwable $e) {
            if (!$isOuterTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Từ chối đề xuất (Bắt buộc có lý do)
     */
    public static function reject(int $reviewId, int $reviewerId, string $reviewNote): array {
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            throw new DomainException("Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền từ chối đề xuất");
        }

        $trimmedNote = trim($reviewNote);
        if ($trimmedNote === '') {
            throw new InvalidArgumentException("Bắt buộc phải cung cấp lý do từ chối để người đề xuất cải thiện bản phối");
        }

        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT * FROM review_requests WHERE id = ?");
        $stmt->execute([$reviewId]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            throw new InvalidArgumentException("Không tìm thấy đề xuất: {$reviewId}");
        }

        if ($req['status'] !== 'pending') {
            throw new DomainException("Đề xuất này đã được xử lý trước đó");
        }

        $targetType = $req['target_type'];
        $targetId = (int)$req['target_id'];

        $isOuterTx = $pdo->inTransaction();
        if (!$isOuterTx) {
            $pdo->beginTransaction();
        }

        try {
            // Cập nhật target review_status
            if ($targetType === 'chord_set') {
                $pdo->prepare("UPDATE user_chord_sets SET review_status = 'rejected' WHERE id = ?")->execute([$targetId]);
            } else {
                $pdo->prepare("UPDATE song_versions SET review_status = 'rejected' WHERE id = ?")->execute([$targetId]);
            }

            // Cập nhật review_requests
            $pdo->prepare("
                UPDATE review_requests 
                SET status = 'rejected', reviewer_id = ?, review_note = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ")->execute([$reviewerId, $trimmedNote, $reviewId]);

            AuditLogger::log('review_reject', $reviewerId, $reviewId, [
                'reason'       => $trimmedNote,
                'submitted_by' => $req['submitted_by']
            ]);

            // Phát sự kiện miền: DomainEvents tự động gọi NotificationService::fanOut để gửi thông báo 1 lần duy nhất
            DomainEvents::record('review.decided', $reviewerId, 'review_request', (string)$reviewId, [
                'decision'     => 'rejected',
                'submitted_by' => $req['submitted_by'],
                'song_id'      => $req['song_id'],
                'reason'       => $trimmedNote
            ]);

            if (!$isOuterTx) {
                $pdo->commit();
            }

            return ['success' => true, 'status' => 'rejected'];
        } catch (Throwable $e) {
            if (!$isOuterTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Người đề xuất tự rút lại đề xuất khi còn pending
     */
    public static function withdraw(int $reviewId, int $userId): array {
        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT * FROM review_requests WHERE id = ?");
        $stmt->execute([$reviewId]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            throw new InvalidArgumentException("Không tìm thấy đề xuất: {$reviewId}");
        }

        if ((int)$req['submitted_by'] !== $userId && !Auth::isAdmin()) {
            throw new DomainException("Chỉ người gửi mới có quyền rút lại đề xuất");
        }

        if ($req['status'] !== 'pending') {
            throw new DomainException("Chỉ có thể rút lại khi đề xuất đang ở trạng thái chờ duyệt (pending)");
        }

        $targetType = $req['target_type'];
        $targetId = (int)$req['target_id'];

        if ($targetType === 'chord_set') {
            $pdo->prepare("UPDATE user_chord_sets SET review_status = 'none' WHERE id = ?")->execute([$targetId]);
        } else {
            $pdo->prepare("UPDATE song_versions SET review_status = 'none' WHERE id = ?")->execute([$targetId]);
        }

        $pdo->prepare("
            UPDATE review_requests 
            SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ")->execute([$reviewId]);

        AuditLogger::log('review_withdraw', $userId, $reviewId, []);

        return ['success' => true, 'status' => 'withdrawn'];
    }

    /**
     * Hoàn tác (Rollback) bộ hợp âm HD về một bản ghi lịch sử trước đó
     */
    public static function rollbackHd(int $historyId, int $actorId): array {
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            throw new DomainException("Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền hoàn tác bộ hợp âm HD");
        }

        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT * FROM chord_set_history WHERE id = ?");
        $stmt->execute([$historyId]);
        $hist = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$hist) {
            throw new InvalidArgumentException("Không tìm thấy bản ghi lịch sử: {$historyId}");
        }

        $songId = $hist['song_id'];
        $targetChords = json_decode((string)$hist['chords_json'], true);

        if (!is_array($targetChords) || empty($targetChords)) {
            throw new DomainException("Dữ liệu lịch sử không hợp lệ hoặc rỗng (Vi phạm Core Rule 1)");
        }

        $isOuterTx = $pdo->inTransaction();
        if (!$isOuterTx) {
            $pdo->beginTransaction();
        }

        try {
            // Lưu bản HD hiện tại trước khi hoàn tác và ghi đè targetChords qua writeHd
            ChordSetService::writeHd(
                $songId,
                $targetChords,
                $actorId,
                'HD',
                "Sao lưu tự động trước khi Hoàn tác về bản ghi #{$historyId}"
            );

            AuditLogger::log('review_rollback_hd', $actorId, $historyId, [
                'song_id' => $songId,
                'source_history_id' => $historyId
            ]);

            if (!$isOuterTx) {
                $pdo->commit();
            }

            return ['success' => true, 'song_id' => $songId];
        } catch (Throwable $e) {
            if (!$isOuterTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Lấy danh sách lịch sử các phiên bản bộ HD của một bài hát
     */
    public static function getHdHistory(string $songId): array {
        $pdo = DB::get();
        $sql = "
            SELECT h.*, u.display_name AS creator_name, u.username AS creator_username
            FROM chord_set_history h
            LEFT JOIN users u ON u.id = h.created_by
            WHERE h.song_id = ? AND h.set_name = 'HD'
            ORDER BY h.created_at DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$songId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$it) {
            $chords = json_decode((string)$it['chords_json'], true) ?: [];
            $it['chord_count'] = count($chords);
            unset($it['chords_json']); // Giảm tải
        }

        return $items;
    }
}
