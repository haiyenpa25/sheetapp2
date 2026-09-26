<?php
/**
 * api/services/ArrangementService.php
 * Handles Song Sections (Intro, Verse, Chorus, Bridge, Outro) and Performance Arrangements / Roadmaps
 */
require_once __DIR__ . '/../core/DB.php';

class ArrangementService {

    /**
     * Lấy danh sách Section của 1 bài hát
     */
    public static function getSections(string $songId): array {
        $stmt = DB::run(
            "SELECT * FROM song_sections WHERE song_id = ? ORDER BY display_order ASC, start_measure ASC, id ASC",
            [$songId]
        );
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Thêm hoặc Cập nhật 1 Section
     */
    public static function upsertSection(array $data): int {
        $id           = !empty($data['id']) ? (int)$data['id'] : null;
        $songId       = trim($data['song_id'] ?? '');
        $name         = trim($data['name'] ?? 'Section');
        $type         = trim($data['type'] ?? 'verse');
        $startMeasure = max(1, (int)($data['start_measure'] ?? 1));
        $endMeasure   = max($startMeasure, (int)($data['end_measure'] ?? $startMeasure));
        $color        = trim($data['color'] ?? '#6366f1');
        $displayOrder = (int)($data['display_order'] ?? 0);

        if (!$songId) {
            throw new InvalidArgumentException('song_id is required');
        }

        if ($id) {
            DB::run(
                "UPDATE song_sections 
                 SET name = ?, type = ?, start_measure = ?, end_measure = ?, color = ?, display_order = ? 
                 WHERE id = ? AND song_id = ?",
                [$name, $type, $startMeasure, $endMeasure, $color, $displayOrder, $id, $songId]
            );
            return $id;
        } else {
            DB::run(
                "INSERT INTO song_sections (song_id, name, type, start_measure, end_measure, color, display_order) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                [$songId, $name, $type, $startMeasure, $endMeasure, $color, $displayOrder]
            );
            return (int)DB::lastId();
        }
    }

    /**
     * Lưu hàng loạt Sections cho 1 bài hát (Sync all)
     */
    public static function saveAllSections(string $songId, array $sections): array {
        if (!$songId) {
            throw new InvalidArgumentException('song_id is required');
        }

        $pdo = DB::get();
        $pdo->beginTransaction();

        try {
            // Xóa các section cũ không còn trong payload
            $keptIds = [];
            foreach ($sections as $s) {
                if (!empty($s['id'])) {
                    $keptIds[] = (int)$s['id'];
                }
            }

            if (!empty($keptIds)) {
                $placeholders = implode(',', array_fill(0, count($keptIds), '?'));
                $params = array_merge([$songId], $keptIds);
                DB::run("DELETE FROM song_sections WHERE song_id = ? AND id NOT IN ($placeholders)", $params);
            } else {
                DB::run("DELETE FROM song_sections WHERE song_id = ?", [$songId]);
            }

            $order = 0;
            foreach ($sections as $s) {
                $s['song_id'] = $songId;
                $s['display_order'] = $order++;
                self::upsertSection($s);
            }

            $pdo->commit();
            return self::getSections($songId);
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Xóa 1 Section
     */
    public static function deleteSection(int $id): bool {
        DB::run("DELETE FROM song_sections WHERE id = ?", [$id]);
        return true;
    }

    /**
     * Lấy danh sách Arrangement của 1 bài hát kèm các steps
     */
    public static function getArrangements(string $songId): array {
        $stmt = DB::run(
            "SELECT * FROM arrangements WHERE song_id = ? ORDER BY is_default DESC, created_at ASC",
            [$songId]
        );
        $arrangements = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($arrangements as &$arr) {
            $arr['steps'] = self::getArrangementSteps((int)$arr['id']);
        }

        return $arrangements;
    }

    /**
     * Lấy chi tiết các bước trong 1 Arrangement
     */
    public static function getArrangementSteps(int $arrangementId): array {
        $stmt = DB::run(
            "SELECT ast.*, sec.name as section_name, sec.type as section_type, 
                    sec.start_measure, sec.end_measure, sec.color as section_color
             FROM arrangement_steps ast
             JOIN song_sections sec ON ast.section_id = sec.id
             WHERE ast.arrangement_id = ?
             ORDER BY ast.seq ASC",
            [$arrangementId]
        );
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Lưu (Tạo/Cập nhật) 1 Arrangement kèm Roadmap Steps
     */
    public static function saveArrangement(string $songId, array $data, array $steps = []): int {
        if (!$songId) {
            throw new InvalidArgumentException('song_id is required');
        }

        $id          = !empty($data['id']) ? (int)$data['id'] : null;
        $name        = trim($data['name'] ?? 'Default Roadmap');
        $description = trim($data['description'] ?? '');
        $isDefault   = !empty($data['is_default']) ? 1 : 0;

        $pdo = DB::get();
        $pdo->beginTransaction();

        try {
            if ($id) {
                DB::run(
                    "UPDATE arrangements SET name = ?, description = ?, is_default = ? WHERE id = ? AND song_id = ?",
                    [$name, $description, $isDefault, $id, $songId]
                );
                $arrId = $id;
            } else {
                DB::run(
                    "INSERT INTO arrangements (song_id, name, description, is_default) VALUES (?, ?, ?, ?)",
                    [$songId, $name, $description, $isDefault]
                );
                $arrId = (int)DB::lastId();
            }

            // Xóa steps cũ và insert lại các steps theo thứ tự seq
            DB::run("DELETE FROM arrangement_steps WHERE arrangement_id = ?", [$arrId]);

            $seq = 0;
            foreach ($steps as $st) {
                $sectionId      = (int)($st['section_id'] ?? 0);
                $repeatCount    = max(1, (int)($st['repeat_count'] ?? 1));
                $transposeDelta = (int)($st['transpose_delta'] ?? 0);
                $bpm            = !empty($st['bpm']) ? (int)$st['bpm'] : null;
                $cueText        = !empty($st['cue_text']) ? (is_array($st['cue_text']) ? json_encode($st['cue_text'], JSON_UNESCAPED_UNICODE) : (string)$st['cue_text']) : null;

                if ($sectionId > 0) {
                    DB::run(
                        "INSERT INTO arrangement_steps (arrangement_id, seq, section_id, repeat_count, transpose_delta, bpm, cue_text) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [$arrId, $seq++, $sectionId, $repeatCount, $transposeDelta, $bpm, $cueText]
                    );
                }
            }

            $pdo->commit();
            return $arrId;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Xóa 1 Arrangement
     */
    public static function deleteArrangement(int $id): bool {
        DB::run("DELETE FROM arrangements WHERE id = ?", [$id]);
        return true;
    }
}
