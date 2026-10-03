<?php
/**
 * 003_add_performance_indexes.php
 * Thiết lập đầy đủ chỉ mục hiệu năng cho các bảng khóa ngoại và trường tìm kiếm
 */

declare(strict_types=1);

return function(PDO $pdo): void {
    // Indexes cho setlists & setlist_items
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_setlist_items_setlist_id ON setlist_items(setlist_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_setlist_items_song_id ON setlist_items(song_id);");

    // Indexes cho songs
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_songs_category_id ON songs(category_id);");

    // Indexes cho arrangements & steps
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_arrangements_song_id ON arrangements(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_arrangement_steps_arr_id ON arrangement_steps(arrangement_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_song_sections_song_id ON song_sections(song_id);");

    // Indexes cho categories
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);");

    // Indexes cho practice & learning
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_song ON practice_sessions(user_id, song_id);");
    $learningColumns = $pdo->query("PRAGMA table_info(learning_arrangements)")->fetchAll(PDO::FETCH_ASSOC);
    $hasLearningUserId = in_array('user_id', array_column($learningColumns, 'name'), true);
    if ($hasLearningUserId) {
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_learning_arrangements_user_song ON learning_arrangements(user_id, song_id);");
    } else {
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_learning_arrangements_song_id ON learning_arrangements(song_id);");
    }

    // Indexes cho song_versions
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_song_versions_song_id ON song_versions(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_song_versions_user_id ON song_versions(user_id);");

    // Indexes cho user_chord_sets
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_song_id ON user_chord_sets(song_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_user_id ON user_chord_sets(user_id);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_public ON user_chord_sets(is_public);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ucs_recommended ON user_chord_sets(is_recommended);");
};
