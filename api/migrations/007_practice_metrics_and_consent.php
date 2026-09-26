<?php
/**
 * api/migrations/007_practice_metrics_and_consent.php
 * Migration cho Epic 3.6 — Tiến độ tập thật trong Learn & Góc nhìn Ca Trưởng có Consent
 */
return function(PDO $pdo): void {
    // 1. Bổ sung consent_practice_share vào bảng users
    $userCols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $userColNames = array_column($userCols, 'name');

    if (!in_array('consent_practice_share', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN consent_practice_share INTEGER NOT NULL DEFAULT 1");
    }

    // 2. Mở rộng bảng practice_sessions với các cột nghiệp vụ
    $sessionCols = $pdo->query("PRAGMA table_info(practice_sessions)")->fetchAll(PDO::FETCH_ASSOC);
    $sessionColNames = array_column($sessionCols, 'name');

    if (!in_array('mode', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'piano'");
    }
    if (!in_array('started_at', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN started_at INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('ended_at', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN ended_at INTEGER DEFAULT NULL");
    }
    if (!in_array('start_bpm', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN start_bpm INTEGER NOT NULL DEFAULT 76");
    }
    if (!in_array('max_bpm', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN max_bpm INTEGER NOT NULL DEFAULT 76");
    }
    if (!in_array('accuracy_total', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN accuracy_total REAL NOT NULL DEFAULT 100.0");
    }
    if (!in_array('notes_total', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN notes_total INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('notes_correct', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN notes_correct INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('timing_score', $sessionColNames, true)) {
        $pdo->exec("ALTER TABLE practice_sessions ADD COLUMN timing_score REAL NOT NULL DEFAULT 100.0");
    }

    // 3. Mở rộng bảng practice_measure_stats
    $statCols = $pdo->query("PRAGMA table_info(practice_measure_stats)")->fetchAll(PDO::FETCH_ASSOC);
    $statColNames = array_column($statCols, 'name');
    if (!in_array('practice_session_id', $statColNames, true)) {
        $pdo->exec("ALTER TABLE practice_measure_stats ADD COLUMN practice_session_id INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('measure_no', $statColNames, true)) {
        $pdo->exec("ALTER TABLE practice_measure_stats ADD COLUMN measure_no INTEGER NOT NULL DEFAULT 1");
    }

    // 3. Tạo index tối ưu truy vấn dashboard và ca trưởng
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_time ON practice_sessions(user_id, started_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_practice_measure_stats_session ON practice_measure_stats(practice_session_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_consent_role ON users(consent_practice_share, role)");
};
