<?php
/**
 * api/migrations/009_domain_events_and_notifications.php
 *
 * Migration cho Epic 4.0 — Nền tảng Giai đoạn 4:
 *  - Lát 4.0-b: Bảng domain_events (Event Log nội bộ)
 *  - Lát 4.0-c: Bảng notifications (Trung tâm thông báo trong ứng dụng)
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Tạo bảng domain_events
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS domain_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            actor_user_id INTEGER NULL,
            subject_type TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            payload_json TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_domain_events_type_created ON domain_events(type, created_at);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_domain_events_subject ON domain_events(subject_type, subject_id);");

    // 2. Tạo bảng notifications
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            event_id INTEGER NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            link TEXT DEFAULT '',
            read_at DATETIME NULL DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES domain_events(id) ON DELETE CASCADE
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at, created_at);");
};
