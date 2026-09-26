<?php
/**
 * api/services/DomainEventService.php
 *
 * Ghi nhận sự kiện miền nội bộ (Internal Domain Event Log — Epic 4.0 Lát 4.0-b)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/NotificationService.php';

class DomainEvents {
    /**
     * Ghi nhận một sự kiện domain sau khi transaction nghiệp vụ thành công
     */
    public static function record(
        string $type,
        ?int $actorUserId,
        string $subjectType,
        string|int $subjectId,
        array $payload = []
    ): int {
        $pdo = DB::get();
        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}';

        $stmt = $pdo->prepare("
            INSERT INTO domain_events (type, actor_user_id, subject_type, subject_id, payload_json)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $type,
            $actorUserId,
            $subjectType,
            (string)$subjectId,
            $payloadJson
        ]);

        $eventId = (int)$pdo->lastInsertId();

        // Kích hoạt phân phối thông báo (In-app Fan-out)
        try {
            NotificationService::fanOut($eventId, $type, $actorUserId, $subjectType, $subjectId, $payload);
        } catch (Throwable $e) {
            error_log("[DomainEvents::fanOut Error] " . $e->getMessage());
        }

        return $eventId;
    }
}
