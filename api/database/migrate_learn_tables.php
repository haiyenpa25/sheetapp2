<?php
/**
 * api/database/migrate_learn_tables.php
 * Tạo các bảng lưu trữ cho tính năng /learn:
 * - learning_patterns: Thư viện mẫu đệm
 * - learning_arrangements: Cài đặt bài tập theo từng bài hát
 * - practice_sessions: Lịch sử phiên luyện tập
 * - practice_measure_stats: Thống kê chi tiết theo từng ô nhịp
 */
require_once __DIR__ . '/../core/DB.php';

try {
    $db = DB::get();

    // 1. learning_patterns
    $db->exec("
        CREATE TABLE IF NOT EXISTS learning_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE,
            name TEXT,
            instrument_family TEXT DEFAULT 'piano',
            meter TEXT DEFAULT '4/4',
            difficulty TEXT DEFAULT 'basic',
            pattern_json TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 2. learning_arrangements
    $db->exec("
        CREATE TABLE IF NOT EXISTS learning_arrangements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id INTEGER,
            name TEXT,
            chord_set_name TEXT DEFAULT 'HD',
            instrument_mode TEXT DEFAULT 'piano',
            pattern_id TEXT DEFAULT 'piano-block-4-4-v1',
            difficulty TEXT DEFAULT 'basic',
            bpm_start INTEGER DEFAULT 76,
            bpm_target INTEGER DEFAULT 100,
            settings_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 3. practice_sessions
    $db->exec("
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 0,
            song_id INTEGER,
            mode TEXT DEFAULT 'piano',
            started_at INTEGER,
            ended_at INTEGER,
            duration_seconds INTEGER DEFAULT 0,
            start_bpm INTEGER DEFAULT 76,
            max_bpm INTEGER DEFAULT 76,
            accuracy_total REAL DEFAULT 100.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 4. practice_measure_stats
    $db->exec("
        CREATE TABLE IF NOT EXISTS practice_measure_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id INTEGER,
            measure_no INTEGER,
            attempts INTEGER DEFAULT 1,
            accuracy REAL DEFAULT 100.0,
            timing_score REAL DEFAULT 100.0,
            best_bpm INTEGER DEFAULT 76,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE
        );
    ");

    echo "[MIGRATE] Learn tables created successfully!" . PHP_EOL;
} catch (Throwable $e) {
    echo "[MIGRATE ERROR] " . $e->getMessage() . PHP_EOL;
    exit(1);
}
