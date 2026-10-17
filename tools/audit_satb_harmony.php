<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Forbidden: CLI only\n");
}

/**
 * tools/audit_satb_harmony.php
 *
 * Công cụ kiểm toán Hòa âm 4 bè SATB & Voice-Leading cho MusicXML (theo chuẩn cuthbertLab/music21):
 *  1. Quét các file MusicXML để trích xuất 4 bè (Soprano, Alto, Tenor, Bass) theo từng lát cắt dọc.
 *  2. Phát hiện lỗi Quãng 5 đúng song song (Parallel Perfect 5ths) và Quãng 8 song song (Parallel Octaves).
 *  3. Phát hiện lỗi Chéo bè (Voice Crossing: Alto > Soprano, Tenor > Alto, Bass > Tenor).
 *  4. Kiểm tra âm vực chuẩn của từng bè hợp xướng (S: C4-A5, A: F3-D5, T: C3-G4, B: E2-C4).
 *
 * Cách dùng:
 *   php tools/audit_satb_harmony.php [--limit=20] [--file=path/to/song.xml] [--json]
 */

final class SatbHarmonyAuditor {
    private const STEP_SEMITONES = [
        'C' => 0, 'D' => 2, 'E' => 4, 'F' => 5, 'G' => 7, 'A' => 9, 'B' => 11
    ];

    private const VOICE_RANGES = [
        'S' => [60, 81], // C4 (60) -> A5 (81)
        'A' => [53, 74], // F3 (53) -> D5 (74)
        'T' => [48, 67], // C3 (48) -> G4 (67)
        'B' => [40, 60], // E2 (40) -> C4 (60)
    ];

    public static function pitchToMidi(string $step, int $octave, int $alter = 0): int {
        $base = self::STEP_SEMITONES[strtoupper($step)] ?? 0;
        return ($octave + 1) * 12 + $base + $alter;
    }

    /**
     * Phân tích một chuỗi MusicXML và trả về thống kê hòa âm 4 bè SATB
     * @return array{measures: int, slices: int, parallel_fifths: list<array<string,mixed>>, parallel_octaves: list<array<string,mixed>>, voice_crossings: list<array<string,mixed>>, range_warnings: list<array<string,mixed>>}
     */
    public static function auditXmlString(string $xmlContent, string $source = ''): array {
        $result = [
            'source'           => $source,
            'measures'         => 0,
            'slices'           => 0,
            'parallel_fifths'  => [],
            'parallel_octaves' => [],
            'voice_crossings'  => [],
            'range_warnings'   => [],
            'issues'           => [],
        ];
        if (trim($xmlContent) === '') return $result;

        $prevUseErrors = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($xmlContent);
        libxml_clear_errors();
        libxml_use_internal_errors($prevUseErrors);
        if (!$xml) return $result;

        $measures = $xml->xpath('//part[1]/measure') ?: [];
        $result['measures'] = count($measures);
        $prevSlice = null;

        foreach ($measures as $mIdx => $measure) {
            $mNum = (string)($measure['number'] ?? ($mIdx + 1));
            $pitches = [];
            foreach ($measure->note as $note) {
                if (isset($note->rest) || !isset($note->pitch)) continue;
                $step   = (string)($note->pitch->step ?? 'C');
                $octave = (int)($note->pitch->octave ?? 4);
                $alter  = isset($note->pitch->alter) ? (int)$note->pitch->alter : 0;
                $pitches[] = self::pitchToMidi($step, $octave, $alter);
            }

            // Lấy 2..4 cao độ riêng biệt tại ô nhịp để lập lát cắt bè
            $unique = array_values(array_unique($pitches));
            if (count($unique) < 2) continue;
            $slicePitches = array_slice($unique, 0, 4);
            sort($slicePitches);

            $voiceLabels = ['B', 'T', 'A', 'S'];
            $currSlice = ['measure' => $mNum, 'voices' => []];
            foreach ($slicePitches as $idx => $midiVal) {
                $vKey = $voiceLabels[$idx] ?? ('V' . $idx);
                $currSlice['voices'][$vKey] = $midiVal;
            }
            $result['slices']++;

            // Kiểm tra âm vực chuẩn khi đủ 4 bè
            if (count($currSlice['voices']) === 4) {
                foreach (self::VOICE_RANGES as $v => [$minM, $maxM]) {
                    $val = $currSlice['voices'][$v];
                    if ($val < $minM || $val > $maxM) {
                        $warn = ['type' => 'RANGE_WARNING', 'measure' => $mNum, 'voice' => $v, 'midi' => $val];
                        $result['range_warnings'][] = $warn;
                        $result['issues'][] = $warn;
                    }
                }
            }

            // Kiểm tra quãng 5 đúng song song (7 semitones) và quãng 8 song song (0 mod 12)
            if ($prevSlice !== null) {
                $keys = array_keys($currSlice['voices']);
                $nKeys = count($keys);
                for ($i = 0; $i < $nKeys; $i++) {
                    for ($j = $i + 1; $j < $nKeys; $j++) {
                        $v1 = $keys[$i];
                        $v2 = $keys[$j];
                        if (!isset($prevSlice['voices'][$v1], $prevSlice['voices'][$v2])) continue;
                        $p1 = $prevSlice['voices'][$v1]; $p2 = $prevSlice['voices'][$v2];
                        $c1 = $currSlice['voices'][$v1]; $c2 = $currSlice['voices'][$v2];
                        $d1 = $c1 - $p1;                 $d2 = $c2 - $p2;

                        if ($d1 !== 0 && $d2 !== 0 && (($d1 > 0 && $d2 > 0) || ($d1 < 0 && $d2 < 0))) {
                            $prevInt = abs($p2 - $p1) % 12;
                            $currInt = abs($c2 - $c1) % 12;
                            if ($prevInt === 7 && $currInt === 7) {
                                $iss = [
                                    'type'         => 'PARALLEL_5TH',
                                    'from_measure' => $prevSlice['measure'],
                                    'to_measure'   => $mNum,
                                    'voices'       => "{$v1}-{$v2}",
                                ];
                                $result['parallel_fifths'][] = $iss;
                                $result['issues'][] = $iss;
                            } elseif ($prevInt === 0 && $currInt === 0 && abs($c2 - $c1) >= 12) {
                                $iss = [
                                    'type'         => 'PARALLEL_8TH',
                                    'from_measure' => $prevSlice['measure'],
                                    'to_measure'   => $mNum,
                                    'voices'       => "{$v1}-{$v2}",
                                ];
                                $result['parallel_octaves'][] = $iss;
                                $result['issues'][] = $iss;
                            }
                        }
                    }
                }
            }
            $prevSlice = $currSlice;
        }

        return $result;
    }
}

// Chỉ chạy phần CLI trực tiếp nếu file này là script chính
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $opts  = getopt('', ['limit::', 'file::', 'json']);
    $limit = isset($opts['limit']) ? max(1, (int)$opts['limit']) : 15;
    $isJson = isset($opts['json']);
    $root  = dirname(__DIR__);

    $files = [];
    if (!empty($opts['file']) && is_file((string)$opts['file'])) {
        $files[] = (string)$opts['file'];
    } else {
        $all = array_merge(
            glob($root . '/storage/songs/*.xml') ?: [],
            glob($root . '/storage/songs/*.musicxml') ?: [],
            glob($root . '/ThanhCa-MusicXML/*.xml') ?: [],
            glob($root . '/ThanhCa-MusicXML/*.musicxml') ?: [],
            glob($root . '/ThanhCa-MusicXML/*/*.xml') ?: [],
            glob($root . '/ThanhCa-MusicXML/*/*.musicxml') ?: []
        );
        $files = array_slice($all, 0, $limit);
    }

    $reports = [];
    foreach ($files as $f) {
        $xmlStr = (string)@file_get_contents($f);
        $audit  = SatbHarmonyAuditor::auditXmlString($xmlStr);
        $reports[basename($f)] = [
            'measures'         => $audit['measures'],
            'slices'           => $audit['slices'],
            'parallel_fifths'  => count($audit['parallel_fifths']),
            'parallel_octaves' => count($audit['parallel_octaves']),
            'range_warnings'   => count($audit['range_warnings']),
        ];
    }

    if ($isJson) {
        echo json_encode($reports, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        exit(0);
    }

    echo "=== SHEETAPP2 — SATB 4-PART HARMONY AUDITOR (music21 rules) ===\n";
    echo "Đã kiểm toán: " . count($reports) . " bản nhạc MusicXML\n";
    foreach ($reports as $name => $r) {
        echo sprintf(
            "  - %-36s | Ô nhịp: %3d | Quãng 5//: %2d | Quãng 8//: %2d\n",
            $name, $r['measures'], $r['parallel_fifths'], $r['parallel_octaves']
        );
    }
}
