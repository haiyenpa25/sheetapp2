<?php
/**
 * 001_initial_schema.php
 * Khởi tạo lược đồ bảng cốt lõi của SheetApp2 (Fresh Install)
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // 1. Users
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            display_name TEXT,
            instrument TEXT,
            chord_code TEXT,
            avatar_url TEXT,
            bio TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 2. Songs
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            httlvnId INTEGER,
            xmlPath TEXT NOT NULL,
            defaultKey TEXT,
            category_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 3. Setlists & Items
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS setlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_by INTEGER,
            scheduled_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS setlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setlist_id INTEGER NOT NULL,
            song_id TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            chord_profile TEXT DEFAULT 'HD',
            transpose_key INTEGER DEFAULT 0,
            bpm INTEGER DEFAULT 100,
            beats_per_measure INTEGER DEFAULT 4,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE
        );
    ");

    // 4. Categories
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            icon TEXT DEFAULT '🎵',
            description TEXT,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 5. Song Sections & Arrangements
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS song_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'verse',
            start_measure INTEGER NOT NULL DEFAULT 1,
            end_measure INTEGER NOT NULL DEFAULT 4,
            color TEXT NOT NULL DEFAULT '#6366f1',
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS arrangements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS arrangement_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arrangement_id INTEGER NOT NULL,
            seq INTEGER NOT NULL DEFAULT 0,
            section_id INTEGER NOT NULL,
            repeat_count INTEGER NOT NULL DEFAULT 1,
            transpose_delta INTEGER NOT NULL DEFAULT 0,
            bpm INTEGER,
            cue_text TEXT,
            FOREIGN KEY (arrangement_id) REFERENCES arrangements(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES song_sections(id) ON DELETE CASCADE
        );
    ");

    // 6. Song Versions
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS song_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            version_name TEXT NOT NULL,
            version_slug TEXT NOT NULL,
            xml_path TEXT NOT NULL,
            description TEXT,
            is_default INTEGER DEFAULT 0,
            is_public INTEGER DEFAULT 1,
            is_recommended INTEGER DEFAULT 0,
            parent_song_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
    ");

    // 7. User Chord Sets
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_chord_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            set_name TEXT NOT NULL,
            instrument_type TEXT NOT NULL DEFAULT 'guitar',
            capo_fret INTEGER NOT NULL DEFAULT 0,
            custom_tempo INTEGER,
            chord_count INTEGER NOT NULL DEFAULT 0,
            notes_guide TEXT,
            chords_json TEXT NOT NULL DEFAULT '[]',
            is_public INTEGER NOT NULL DEFAULT 1,
            is_recommended INTEGER NOT NULL DEFAULT 0,
            views_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");

    // 8. Learning Patterns & Arrangements
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS learning_patterns (
            id TEXT PRIMARY KEY,
            family TEXT NOT NULL,
            instrument TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            meter TEXT NOT NULL,
            difficulty TEXT DEFAULT 'basic',
            pattern_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS learning_arrangements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            song_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT 'Mặc định',
            chord_set_name TEXT DEFAULT 'HD',
            instrument_mode TEXT DEFAULT 'piano',
            pattern_id TEXT DEFAULT 'piano-block-4-4-v1',
            difficulty TEXT DEFAULT 'basic',
            bpm_start INTEGER DEFAULT 76,
            bpm_target INTEGER DEFAULT 100,
            settings_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
    ");

    // 9. Practice Sessions & Stats
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            song_id TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'piano',
            started_at INTEGER NOT NULL DEFAULT 0,
            ended_at INTEGER DEFAULT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            start_bpm INTEGER NOT NULL DEFAULT 76,
            max_bpm INTEGER NOT NULL DEFAULT 76,
            accuracy_total REAL NOT NULL DEFAULT 100.0,
            notes_total INTEGER NOT NULL DEFAULT 0,
            notes_correct INTEGER NOT NULL DEFAULT 0,
            timing_score REAL NOT NULL DEFAULT 100.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS practice_measure_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id INTEGER NOT NULL,
            measure_no INTEGER NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 1,
            accuracy REAL NOT NULL DEFAULT 100.0,
            timing_score REAL NOT NULL DEFAULT 100.0,
            best_bpm INTEGER NOT NULL DEFAULT 76,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE
        );
    ");

    // 10. OMR Workspace
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS omr_workspace (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT UNIQUE NOT NULL,
            original_filename TEXT,
            status TEXT DEFAULT 'pending',
            result_xml_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");
};
