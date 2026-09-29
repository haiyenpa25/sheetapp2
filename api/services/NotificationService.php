<?php
/**
 * api/services/NotificationService.php
 *
 * Quản lý Trung tâm thông báo trong ứng dụng (In-app Notification Center — Epic 4.0 Lát 4.0-c)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';

class NotificationService {
    /**
     * Tạo một thông báo mới cho người dùng
     */
    public static function create(int $userId, ?int $eventId, string $title, string $body = '', string $link = ''): int {
        $pdo = DB::get();
        $stmt = $pdo->prepare("
            INSERT INTO notifications (user_id, event_id, title, body, link, read_at)
            VALUES (?, ?, ?, ?, ?, NULL)
        ");
        $stmt->execute([$userId, $eventId, $title, $body, $link]);
        return (int)$pdo->lastInsertId();
    }

    /**
     * Lấy danh sách thông báo của người dùng (kèm phân trang và số lượng chưa đọc)
     */
    public static function getList(int $userId, int $limit = 20, int $offset = 0): array {
        $pdo = DB::get();
        
        $unreadCount = self::getUnreadCount($userId);

        $stmt = $pdo->prepare("
            SELECT id, user_id, event_id, title, body, link, read_at, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items'         => $items,
            'notifications' => $items,
            'unread_count'  => $unreadCount,
            'limit'         => $limit,
            'offset'        => $offset,
        ];
    }

    /**
     * Lấy số lượng thông báo chưa đọc
     */
    public static function getUnreadCount(int $userId): int {
        $pdo = DB::get();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL");
        $stmt->execute([$userId]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Đánh dấu 1 thông báo là đã đọc (bảo mật: chỉ chủ sở hữu mới được đánh dấu)
     */
    public static function markRead(int $userId, int $notifId): bool {
        $pdo = DB::get();
        $stmt = $pdo->prepare("
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND read_at IS NULL
        ");
        $stmt->execute([$notifId, $userId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
     */
    public static function markAllRead(int $userId): bool {
        $pdo = DB::get();
        $stmt = $pdo->prepare("
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND read_at IS NULL
        ");
        $stmt->execute([$userId]);
        return true;
    }

    /**
     * Gửi thông báo đa kênh có kiểm tra tùy chọn kênh (inapp, email, push)
     */
    public static function notifyUser(
        int $userId,
        ?int $eventId,
        string $eventType,
        string $title,
        string $body = '',
        string $link = ''
    ): ?int {
        require_once __DIR__ . '/NotificationPreferenceService.php';

        $notifId = null;

        // 1. Kênh in-app
        if (NotificationPreferenceService::isChannelEnabled($userId, $eventType, 'inapp')) {
            $notifId = self::create($userId, $eventId, $title, $body, $link);
        }

        // Nếu inapp bị tắt nhưng email hoặc push bật, vẫn cần tạo record để liên kết delivery
        if ($notifId === null && (
            NotificationPreferenceService::isChannelEnabled($userId, $eventType, 'email') ||
            NotificationPreferenceService::isChannelEnabled($userId, $eventType, 'push')
        )) {
            $notifId = self::create($userId, $eventId, $title, $body, $link);
            self::markRead($userId, $notifId); // Đánh dấu đọc ngay để không hiện badge in-app
        }

        if ($notifId !== null) {
            // 2. Kênh email
            if (NotificationPreferenceService::isChannelEnabled($userId, $eventType, 'email')) {
                NotificationPreferenceService::queueDelivery($notifId, $userId, 'email');
            }

            // 3. Kênh push
            if (NotificationPreferenceService::isChannelEnabled($userId, $eventType, 'push')) {
                NotificationPreferenceService::queueDelivery($notifId, $userId, 'push');
            }
        }

        return $notifId;
    }

    /**
     * Phân phối thông báo tự động (Fan-out) dựa trên sự kiện domain
     */
    public static function fanOut(int $eventId, string $type, ?int $actorUserId, string $subjectType, string|int $subjectId, array $payload = []): void {
        $pdo = DB::get();

        switch ($type) {
            case 'plan.published':
                $setlistId = (int)$subjectId;
                $planTitle = $payload['title'] ?? 'Chương trình thờ phượng';

                // Tìm tất cả thành viên được phân công trong chương trình này
                $stmt = $pdo->prepare("
                    SELECT DISTINCT user_id, role
                    FROM service_plan_assignments
                    WHERE setlist_id = ?
                ");
                $stmt->execute([$setlistId]);
                $assignees = $stmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($assignees as $assignee) {
                    $targetUserId = (int)$assignee['user_id'];
                    $userRole     = $assignee['role'] ?? 'Ca viên';

                    self::notifyUser(
                        $targetUserId,
                        $eventId,
                        'plan.published',
                        'Chương trình thờ phượng đã phát hành',
                        "Chương trình '{$planTitle}' vừa được phát hành. Nhiệm vụ của bạn: {$userRole}.",
                        "?setlist={$setlistId}"
                    );
                }
                break;

            case 'plan.role_assigned':
            case 'assignment.created':
                $targetUserId = (int)($payload['user_id'] ?? 0);
                $setlistId    = (int)($payload['setlist_id'] ?? 0);
                $rawRole      = (string)($payload['role'] ?? '');
                $roleMap = [
                    'pastor'           => 'Mục sư / Truyền đạo',
                    'worship_leader'   => 'Hướng dẫn chương trình',
                    'scripture_reader' => 'Đọc Kinh Thánh',
                    'leader'           => 'Người hướng dẫn / Hát chính',
                    'vocal'            => 'Hát dẫn',
                    'piano'            => 'Piano / Đệm chính',
                    'organ'            => 'Organ',
                    'guitar'           => 'Guitar Acoustic / Solo',
                    'bass'             => 'Guitar Bass',
                    'drums'            => 'Trống / Bộ gõ',
                    'vocal_soprano'    => 'Nữ cao (Soprano)',
                    'vocal_alto'       => 'Nữ trầm (Alto)',
                    'vocal_tenor'      => 'Nam cao (Tenor)',
                    'vocal_bass'       => 'Nam trầm (Bass)',
                    'sound'            => 'Kỹ thuật âm thanh',
                    'slides'           => 'Trình chiếu / Máy chiếu',
                ];
                $roleName = $roleMap[$rawRole] ?? ($rawRole !== '' ? $rawRole : 'thành viên');

                if ($targetUserId > 0) {
                    self::notifyUser(
                        $targetUserId,
                        $eventId,
                        'plan.role_assigned',
                        'Bạn có nhiệm vụ mới trong chương trình thờ phượng',
                        "Bạn vừa được phân công vai trò {$roleName}.",
                        $setlistId > 0 ? "?setlist={$setlistId}" : ''
                    );
                }
                break;

            case 'practice.assigned':
                $userIds = [];
                if (!empty($payload['user_ids']) && is_array($payload['user_ids'])) {
                    $userIds = array_map('intval', $payload['user_ids']);
                } elseif (!empty($payload['user_id'])) {
                    $userIds = [(int)$payload['user_id']];
                }

                $title = $payload['title'] ?? 'Bài tập luyện hát mới';
                $assignmentId = (string)$subjectId;
                $link = 'learn/index.php?assignment=' . $assignmentId;

                foreach ($userIds as $uid) {
                    if ($uid > 0) {
                        self::notifyUser(
                            $uid,
                            $eventId,
                            'practice.assigned',
                            'Bạn có bài tập luyện mới',
                            "Bạn vừa được giao bài tập '{$title}'. Hãy vào tập luyện nhé!",
                            $link
                        );
                    }
                }
                break;

            case 'assignment.due_soon':
                $targetUserId = (int)($payload['user_id'] ?? 0);
                $songTitle    = $payload['song_title'] ?? 'Bài thánh ca';
                $dueAt        = $payload['due_at'] ?? '';
                if ($targetUserId > 0) {
                    self::notifyUser(
                        $targetUserId,
                        $eventId,
                        'assignment.due_soon',
                        'Nhắc nhở: Bài tập sắp tới hạn',
                        "Bài tập '{$songTitle}' của bạn sắp tới hạn vào {$dueAt}. Hãy hoàn thành sớm nhé!",
                        'learn/index.php?assignment=' . ($payload['assignment_id'] ?? '')
                    );
                }
                break;

            case 'review.submitted':
                $songId = $payload['song_id'] ?? '';
                $leaders = $pdo->query("SELECT id FROM users WHERE role IN ('leader', 'admin') AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
                foreach ($leaders as $lId) {
                    self::notifyUser(
                        (int)$lId,
                        $eventId,
                        'review.submitted',
                        'Có đề xuất hợp âm mới cần duyệt',
                        "Thành viên vừa gửi đề xuất duyệt hợp âm cho bài '{$songId}'.",
                        'manager/index.php#tab-reviews'
                    );
                }
                break;

            case 'review.decided':
                $submittedBy = (int)($payload['submitted_by'] ?? 0);
                $decision    = $payload['decision'] ?? 'approved';
                $songId      = $payload['song_id'] ?? '';
                $isApproved  = ($decision === 'approved');

                if ($submittedBy > 0) {
                    self::notifyUser(
                        $submittedBy,
                        $eventId,
                        'review.decided',
                        $isApproved ? '🎉 Đề xuất được phê duyệt!' : 'Đề xuất chưa được duyệt',
                        $isApproved 
                            ? "Đề xuất hợp âm cho bài '{$songId}' đã được Ca Trưởng phê duyệt."
                            : "Đề xuất hợp âm cho bài '{$songId}' chưa được phê duyệt. Lý do: " . ($payload['reason'] ?? 'Cần hoàn thiện thêm'),
                        'manager/index.php#tab-community'
                    );
                }
                break;

            default:
                break;
        }
    }
}
