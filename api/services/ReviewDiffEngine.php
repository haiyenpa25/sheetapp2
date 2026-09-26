<?php
/**
 * api/services/ReviewDiffEngine.php
 *
 * Động cơ so sánh khác biệt (Diff Engine) cho Hợp Âm & Phiên Bản Bản Nhạc (Epic 4.2):
 * - Chuẩn hóa định dạng hợp âm (Map m_n hoặc Array objects) thành cấu trúc tra cứu thống nhất.
 * - Phát hiện chính xác các ô nhịp/nốt được Thêm mới (added), Sửa đổi (modified), Bị xóa (removed), Giữ nguyên (unchanged).
 * - Sắp xếp theo trình tự thời gian bản nhạc (Measure ASC, Note ASC).
 * - So sánh tóm tắt phiên bản MusicXML (số ô nhịp, số nốt, thay đổi cấu trúc).
 */

declare(strict_types=1);

class ReviewDiffEngine {
    /**
     * Chuẩn hóa dữ liệu hợp âm về dạng Map chuẩn:
     * Key: 'm{measureIdx}_n{noteIdx}'
     * Value: ['measure' => int, 'note' => int, 'chord' => string]
     */
    public static function normalizeChords(array|string|null $input): array {
        if ($input === null) return [];
        if (is_string($input)) {
            $decoded = json_decode($input, true);
            $input = is_array($decoded) ? $decoded : [];
        }

        $normalized = [];

        foreach ($input as $k => $v) {
            $measure = 0;
            $note = 0;
            $chord = '';

            if (is_array($v) && (isset($v['measureIdx']) || isset($v['measure']))) {
                // Định dạng Array of objects: [{"measureIdx":0, "noteIdx":1, "chord":"Am"}]
                $measure = (int)($v['measureIdx'] ?? $v['measure'] ?? 0);
                $note = (int)($v['noteIdx'] ?? $v['note'] ?? 0);
                $chord = trim((string)($v['chord'] ?? ''));
            } elseif (is_string($k) && preg_match('/^m(\d+)_n(\d+)$/', $k, $m)) {
                // Định dạng Key-Value map: {"m0_n1": "Am"} hoặc {"m0_n1": {"chord": "Am"}}
                $measure = (int)$m[1];
                $note = (int)$m[2];
                $chord = is_array($v) ? trim((string)($v['chord'] ?? '')) : trim((string)$v);
            } elseif (is_array($v) && isset($v['chord'])) {
                $chord = trim((string)$v['chord']);
                $measure = (int)($v['m'] ?? 0);
                $note = (int)($v['n'] ?? 0);
            }

            if ($chord !== '') {
                $key = "m{$measure}_n{$note}";
                $normalized[$key] = [
                    'location' => $key,
                    'measure' => $measure,
                    'note' => $note,
                    'chord' => $chord
                ];
            }
        }

        return $normalized;
    }

    /**
     * So sánh khác biệt giữa 2 bộ hợp âm (Snapshot gốc vs Snapshot đề xuất)
     */
    public static function diffChordSets(array|string|null $baseInput, array|string|null $proposedInput): array {
        $base = self::normalizeChords($baseInput);
        $proposed = self::normalizeChords($proposedInput);

        $changes = [];
        $addedCount = 0;
        $modifiedCount = 0;
        $removedCount = 0;
        $unchangedCount = 0;

        $allKeys = array_unique(array_merge(array_keys($base), array_keys($proposed)));

        foreach ($allKeys as $key) {
            $inBase = isset($base[$key]);
            $inProp = isset($proposed[$key]);

            if ($inBase && $inProp) {
                $oldChord = $base[$key]['chord'];
                $newChord = $proposed[$key]['chord'];

                if ($oldChord === $newChord) {
                    $unchangedCount++;
                } else {
                    $modifiedCount++;
                    $changes[] = [
                        'location'  => $key,
                        'measure'   => $proposed[$key]['measure'],
                        'note'      => $proposed[$key]['note'],
                        'type'      => 'modified',
                        'old_chord' => $oldChord,
                        'new_chord' => $newChord
                    ];
                }
            } elseif (!$inBase && $inProp) {
                $addedCount++;
                $changes[] = [
                    'location'  => $key,
                    'measure'   => $proposed[$key]['measure'],
                    'note'      => $proposed[$key]['note'],
                    'type'      => 'added',
                    'old_chord' => null,
                    'new_chord' => $proposed[$key]['chord']
                ];
            } elseif ($inBase && !$inProp) {
                $removedCount++;
                $changes[] = [
                    'location'  => $key,
                    'measure'   => $base[$key]['measure'],
                    'note'      => $base[$key]['note'],
                    'type'      => 'removed',
                    'old_chord' => $base[$key]['chord'],
                    'new_chord' => null
                ];
            }
        }

        // Sắp xếp các thay đổi theo trình tự ô nhịp (Measure ASC, Note ASC)
        usort($changes, function($a, $b) {
            if ($a['measure'] !== $b['measure']) {
                return $a['measure'] <=> $b['measure'];
            }
            return $a['note'] <=> $b['note'];
        });

        $totalChanges = $addedCount + $modifiedCount + $removedCount;

        return [
            'summary' => [
                'added_count'     => $addedCount,
                'modified_count'  => $modifiedCount,
                'removed_count'   => $removedCount,
                'unchanged_count' => $unchangedCount,
                'total_changes'   => $totalChanges,
                'base_total'      => count($base),
                'proposed_total'  => count($proposed)
            ],
            'changes' => $changes
        ];
    }

    /**
     * So sánh tóm tắt 2 phiên bản MusicXML (nếu có)
     */
    public static function diffMusicXml(?string $baseXml, ?string $proposedXml): array {
        $baseMeasures = $baseXml ? substr_count($baseXml, '<measure') : 0;
        $propMeasures = $proposedXml ? substr_count($proposedXml, '<measure') : 0;
        $baseNotes = $baseXml ? substr_count($baseXml, '<note') : 0;
        $propNotes = $proposedXml ? substr_count($proposedXml, '<note') : 0;

        $hasChanges = ($baseMeasures !== $propMeasures) || ($baseNotes !== $propNotes) || (strcmp((string)$baseXml, (string)$proposedXml) !== 0);

        return [
            'summary' => [
                'base_measures'     => $baseMeasures,
                'proposed_measures' => $propMeasures,
                'base_notes'        => $baseNotes,
                'proposed_notes'    => $propNotes,
                'measures_diff'     => $propMeasures - $baseMeasures,
                'notes_diff'        => $propNotes - $baseNotes,
                'has_changes'       => $hasChanges
            ],
            'text_diff_bytes' => strlen((string)$proposedXml) - strlen((string)$baseXml)
        ];
    }
}
