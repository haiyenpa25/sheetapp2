<?php
/**
 * api/migrations/010_practice_assignments.php
 *
 * Migration cho Epic 4.1 — Giao bài & Tập bè cho ca đoàn:
 * - Bảng practice_assignments (quản lý bài tập ca đoàn & ad-hoc)
 * - Bảng practice_assignment_targets (mục tiêu ca viên, bè gán, tiến độ)
 * - Mở rộng practice_sessions với cột assignment_id
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Tạo bảng practice_assignments
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS practice_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setlist_id INTEGER NULL,
            song_id TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            title TEXT NULL,
            due_at TEXT NULL,
            target_bpm INTEGER NULL,
            target_transpose INTEGER NULL,
            chord_profile TEXT DEFAULT 'HD',
            completion_rule TEXT DEFAULT 'manual',
            completion_threshold REAL NULL,
            notes TEXT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE SET NULL,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pa_setlist ON practice_assignments(setlist_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pa_song ON practice_assignments(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pa_due ON practice_assignments(due_at);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pa_status ON practice_assignments(status);");

    // 2. Tạo bảng practice_assignment_targets
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS practice_assignment_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            voice_part TEXT NULL,
            status TEXT DEFAULT 'assigned',
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            last_practiced_at DATETIME NULL,
            UNIQUE (assignment_id, user_id),
            FOREIGN KEY (assignment_id) REFERENCES practice_assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pat_user_status ON practice_assignment_targets(user_id, status);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pat_assignment ON practice_assignment_targets(assignment_id);");

    // 3. Mở rộng practice_sessions với assignment_id
    $sessionCols = $pdo->query("PRAGMA table_info(practice_sessions)")->fetchAll(PDO::FETCH_ASSOC);
    $sessionColNames = array_column($sessionCols, 'name');
    if (!in_array('assignment_id', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN assignment_id INTEGER DEFAULT NULL");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_practice_sessions_assignment ON practice_sessions(assignment_id);");
    }
};
