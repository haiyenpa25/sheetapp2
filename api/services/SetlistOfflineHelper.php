<?php
/**
 * api/services/SetlistOfflineHelper.php
 * Trợ thủ đóng gói dữ liệu ngoại tuyến (Offline Setlist Package) cho SetlistService (Epic 3.2)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/ChordSetService.php';

class SetlistOfflineHelper {

    /**
     * Đóng gói trọn vẹn dữ liệu nốt nhạc MusicXML, Metadata & Hợp âm cho setlist ngoại tuyến
     */
    public static function getOfflinePackage(int $setlistId, ?array $setlist = null): ?array {
        if ($setlist === null) {
            require_once __DIR__ . '/SetlistService.php';
            $setlist = SetlistService::getById($setlistId);
        }
        if (!$setlist) return null;

        $items = $setlist['items'] ?? [];
        $songIds = [];
        $requiredProfiles = [];

        foreach ($items as $item) {
            $sid = trim((string)($item['song_id'] ?? ''));
            if ($sid !== '') {
                $songIds[$sid] = true;
                $profile = trim((string)($item['chord_profile'] ?? 'HD')) ?: 'HD';
                $requiredProfiles[$sid][$profile] = true;
                $requiredProfiles[$sid]['HD'] = true;
            }
        }

        $songsMap = [];
        $chordSetsMap = [];
        $rootDir = dirname(__DIR__, 2);

        if (!empty($songIds)) {
            $placeholders = implode(',', array_fill(0, count($songIds), '?'));
            $sql = "SELECT id, title, httlvnId, xmlPath, defaultKey FROM songs WHERE id IN ({$placeholders})";
            $songRows = DB::run($sql, array_keys($songIds))->fetchAll(PDO::FETCH_ASSOC);

            foreach ($songRows as $row) {
                $sid = (string)$row['id'];
                $xmlRel = ltrim($row['xmlPath'] ?? '', '/\\');
                $xmlFull = $rootDir . '/' . $xmlRel;
                $exists = !empty($xmlRel) && file_exists($xmlFull);
                $mtime = $exists ? (int)filemtime($xmlFull) : 0;
                $size = $exists ? (int)filesize($xmlFull) : 0;
                $hash = $exists ? hash_file('crc32b', $xmlFull) : null;

                $songsMap[$sid] = [
                    'id' => $sid,
                    'title' => $row['title'] ?? '',
                    'httlvnId' => $row['httlvnId'] ?? null,
                    'xmlPath' => $row['xmlPath'] ?? '',
                    'defaultKey' => $row['defaultKey'] ?? '',
                    'xml_exists' => $exists,
                    'xml_size' => $size,
                    'xml_mtime' => $mtime,
                    'xml_hash' => $hash,
                ];

                $profiles = array_keys($requiredProfiles[$sid] ?? ['HD' => true]);
                $chordSetsMap[$sid] = [];

                foreach ($profiles as $prof) {
                    $chords = ChordSetService::loadSet($sid, $prof);
                    $chordSetsMap[$sid][$prof] = $chords;
                }
            }
        }

        $itemSignatures = [];
        foreach ($items as $it) {
            $itemSignatures[] = [
                $it['id'] ?? 0,
                $it['song_id'] ?? '',
                $it['chord_profile'] ?? '',
                $it['transpose_key'] ?? 0,
                $it['bpm'] ?? 0,
            ];
        }

        $versionSource = [
            $setlist['id'],
            $setlist['title'] ?? '',
            $setlist['scheduled_date'] ?? '',
            $itemSignatures,
            array_keys($songsMap)
        ];
        $packageVersion = 'pkg-' . $setlistId . '-' . hash('crc32b', json_encode($versionSource));

        return [
            'package_version' => $packageVersion,
            'generated_at' => date('Y-m-d H:i:s'),
            'setlist' => $setlist,
            'songs' => $songsMap,
            'chord_sets' => $chordSetsMap,
            'total_songs' => count($songsMap),
        ];
    }
}
