<?php
/**
 * api/migrations/011_review_workflow.php
 *
 * Migration cho Epic 4.2 — Quy trình duyệt bộ hợp âm & phiên bản MusicXML:
 * 1. Bảng review_requests: Quản lý hàng đợi và quyết định đề xuất khuyên dùng / cập nhật HD.
 * 2. Bảng chord_set_history: Lưu lịch sử các phiên bản bộ hợp âm HD để hoàn tác (bảo vệ Core Rule 4 & Rollback).
 * 3. Mở rộng user_chord_sets và song_versions với review_status, approved_by, approved_at.
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Tạo bảng review_requests
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS review_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            song_id TEXT NOT NULL,
            review_type TEXT NOT NULL DEFAULT 'recommend',
            base_snapshot_json TEXT NULL,
            proposed_snapshot_json TEXT NULL,
            diff_summary_json TEXT NULL,
            submitted_by INTEGER NOT NULL,
            reviewer_id INTEGER NULL,
            status TEXT DEFAULT 'pending',
            submit_note TEXT NULL,
            review_note TEXT NULL,
            decided_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rev_status_created ON review_requests(status, created_at);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rev_song ON review_requests(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rev_target ON review_requests(target_type, target_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_rev_submitter ON review_requests(submitted_by);");

    // 2. Tạo bảng chord_set_history (Lịch sử lưu trữ snapshot bộ HD khi cập nhật để hoàn tác an toàn)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS chord_set_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            set_name TEXT NOT NULL DEFAULT 'HD',
            chords_json TEXT NOT NULL,
            created_by INTEGER NULL,
            review_request_id INTEGER NULL,
            change_reason TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (review_request_id) REFERENCES review_requests(id) ON DELETE SET NULL
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_csh_song_set ON chord_set_history(song_id, set_name, created_at);");

    // 3. Mở rộng user_chord_sets với các trường kiểm duyệt
    $colsUcs = $pdo->query("PRAGMA table_info(user_chord_sets)")->fetchAll(PDO::FETCH_ASSOC);
    $existingUcs = array_column($colsUcs, 'name');

    if (!in_array('review_status', $existingUcs, true)) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN review_status TEXT DEFAULT 'none';");
    }
    if (!in_array('approved_by', $existingUcs, true)) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN approved_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;");
    }
    if (!in_array('approved_at', $existingUcs, true)) {
        $pdo->exec("ALTER TABLE user_chord_sets ADD COLUMN approved_at DATETIME NULL;");
    }

    // 4. Mở rộng song_versions với các trường kiểm duyệt (nếu bảng tồn tại)
    $hasVersionsTable = (int)$pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='song_versions'")->fetchColumn() > 0;
    if ($hasVersionsTable) {
        $colsVer = $pdo->query("PRAGMA table_info(song_versions)")->fetchAll(PDO::FETCH_ASSOC);
        $existingVer = array_column($colsVer, 'name');

        if (!in_array('review_status', $existingVer, true)) {
            $pdo->exec("ALTER TABLE song_versions ADD COLUMN review_status TEXT DEFAULT 'none';");
        }
        if (!in_array('approved_by', $existingVer, true)) {
            $pdo->exec("ALTER TABLE song_versions ADD COLUMN approved_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;");
        }
        if (!in_array('approved_at', $existingVer, true)) {
            $pdo->exec("ALTER TABLE song_versions ADD COLUMN approved_at DATETIME NULL;");
        }
    }
};
