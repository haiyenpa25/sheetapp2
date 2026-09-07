<?php
/**
 * api/services/LearningService.php
 * Quản lý mẫu đệm (patterns) và cấu hình học tập (arrangements) cho /learn
 */
require_once __DIR__ . '/../core/DB.php';

class LearningService {
    /**
     * Lấy danh sách mẫu đệm
     */
    public static function getPatterns(?string $instrumentFamily = null, ?string $meter = null): array {
        $sql = "SELECT * FROM learning_patterns WHERE is_active = 1";
        $params = [];

        if ($instrumentFamily) {
            $sql .= " AND instrument_family = ?";
            $params[] = $instrumentFamily;
        }
        if ($meter) {
            $sql .= " AND meter = ?";
            $params[] = $meter;
        }

        $sql .= " ORDER BY id ASC";
        $rows = DB::run($sql, $params)->fetchAll();

        return array_map(function($row) {
            if (!empty($row['pattern_json'])) {
                $row['pattern'] = json_decode($row['pattern_json'], true);
            }
            return $row;
        }, $rows);
    }

    /**
     * Lấy cấu hình bài tập theo bài hát
     */
    public static function getArrangement(int $songId): ?array {
        $sql = "SELECT * FROM learning_arrangements WHERE song_id = ? ORDER BY id DESC LIMIT 1";
        $row = DB::run($sql, [$songId])->fetch();

        if ($row && !empty($row['settings_json'])) {
            $row['settings'] = json_decode($row['settings_json'], true);
        }
        return $row ?: null;
    }

    /**
     * Lưu cấu hình bài tập cho bài hát
     */
    public static function saveArrangement(array $data): array {
        $songId         = (int)($data['song_id'] ?? 0);
        $name           = trim($data['name'] ?? 'Mặc định');
        $chordSetName   = trim($data['chord_set_name'] ?? 'HD');
        $instrumentMode = trim($data['instrument_mode'] ?? 'piano');
        $patternId      = trim($data['pattern_id'] ?? 'piano-block-4-4-v1');
        $difficulty     = trim($data['difficulty'] ?? 'basic');
        $bpmStart       = (int)($data['bpm_start'] ?? 76);
        $bpmTarget      = (int)($data['bpm_target'] ?? 100);
        $settingsJson   = !empty($data['settings']) ? json_encode($data['settings'], JSON_UNESCAPED_UNICODE) : null;

        if ($songId <= 0) {
            throw new InvalidArgumentException('Mã bài hát (song_id) không hợp lệ');
        }

        // Kiểm tra xem đã có arrangement cho song_id này chưa
        $existing = DB::run("SELECT id FROM learning_arrangements WHERE song_id = ?", [$songId])->fetch();

        if ($existing) {
            $sql = "UPDATE learning_arrangements SET 
                        name = ?, chord_set_name = ?, instrument_mode = ?, 
                        pattern_id = ?, difficulty = ?, bpm_start = ?, bpm_target = ?, 
                        settings_json = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?";
            DB::run($sql, [$name, $chordSetName, $instrumentMode, $patternId, $difficulty, $bpmStart, $bpmTarget, $settingsJson, $existing['id']]);
            $id = $existing['id'];
        } else {
            $sql = "INSERT INTO learning_arrangements 
                        (song_id, name, chord_set_name, instrument_mode, pattern_id, difficulty, bpm_start, bpm_target, settings_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            DB::run($sql, [$songId, $name, $chordSetName, $instrumentMode, $patternId, $difficulty, $bpmStart, $bpmTarget, $settingsJson]);
            $id = DB::lastId();
        }

        return self::getArrangement($songId);
    }
}
