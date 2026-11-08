<?php
/**
 * api/services/MusicXmlHealthService.php
 * Phân tích MusicXML khi nhập: lỗi cấu trúc nhẹ + phát hiện bài trùng. CHỈ BÁO CÁO, không sửa file, không chặn lưu.
 * KHÔNG biết HTTP. Phụ thuộc: PDO (bảng songs).
 */
class MusicXmlHealthService {
    private const MAX_MATCHES = 6;
    private const MAX_MEASURES_LISTED = 5;

    /** @return string[] Danh sách cảnh báo tiếng Việt (rỗng = sạch) */
    public static function analyze(string $xml): array {
        $warnings = [];
        $prev = libxml_use_internal_errors(true);
        $doc = new DOMDocument();
        $loaded = @$doc->loadXML($xml);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        if (!$loaded) return ['Không đọc được cấu trúc XML'];

        $xp = new DOMXPath($doc);
        $dupMeasures = self::measuresWithDuplicateChords($xp);
        if ($dupMeasures) {
            $extra = count($dupMeasures) - self::MAX_MEASURES_LISTED;
            $warnings[] = 'Hợp âm trùng cùng vị trí ở ô nhịp ' . implode(', ', array_slice($dupMeasures, 0, self::MAX_MEASURES_LISTED))
                . ($extra > 0 ? " và $extra ô khác" : '');
        }
        if ($xp->query('//part')->length === 0) {
            $warnings[] = 'Không có phần nhạc (part) nào';
        } elseif ($xp->query('//part//note[not(rest)]')->length === 0) {
            $warnings[] = 'Không có nốt nhạc nào (chỉ toàn dấu lặng)';
        }
        if ($xp->query('//lyric')->length === 0) {
            $warnings[] = 'Bản nhạc không có lời';
        } else {
            foreach ($xp->query('//lyric/text') as $text) {
                if (trim($text->textContent) === '') { $warnings[] = 'Có lời (lyric) rỗng'; break; }
            }
        }
        return $warnings;
    }

    /** @return string[] Số ô nhịp có hợp âm lặp lại cùng vị trí (cùng gốc + loại) */
    private static function measuresWithDuplicateChords(DOMXPath $xp): array {
        $bad = [];
        foreach ($xp->query('//measure') as $measure) {
            $seen = [];
            foreach ($xp->query('.//harmony', $measure) as $harmony) {
                $notesBefore = 0;
                for ($n = $harmony->previousSibling; $n; $n = $n->previousSibling) {
                    if ($n->nodeName === 'note') $notesBefore++;
                }
                $step = $xp->query('root/root-step', $harmony)->item(0)?->textContent ?? '';
                $alter = $xp->query('root/root-alter', $harmony)->item(0)?->textContent ?? '';
                $kind = $xp->query('kind', $harmony)->item(0)?->textContent ?? '';
                $key = "$notesBefore|$step|$alter|$kind";
                if (isset($seen[$key])) { $bad[] = $measure->getAttribute('number') ?: '?'; break; }
                $seen[$key] = true;
            }
        }
        return $bad;
    }

    /** Chuẩn hoá tên để so trùng: bỏ số thứ tự đầu, dấu câu, khoảng trắng, hoa/thường. */
    public static function normalizeTitle(string $title): string {
        $title = mb_strtolower($title, 'UTF-8');
        $title = preg_replace('/^\s*\d+[\s.\-_]*/u', '', $title) ?? $title;
        return preg_replace('/[^\p{L}\p{N}]+/u', '', $title) ?? '';
    }

    /**
     * Tìm bài công khai đã có trùng tên chuẩn hoá hoặc trùng nội dung XML y hệt.
     * Chỉ so với bài công khai (không lộ tên bài riêng tư của người khác).
     * @return array<int,array{id:string,title:string,reason:string}>
     */
    public static function findDuplicates(PDO $pdo, string $title, string $xml, string $rootDir): array {
        $wantTitle = self::normalizeTitle($title);
        $size = strlen($xml);
        $hash = null;
        $found = [];
        $rows = $pdo->query('SELECT id, title, xmlPath FROM songs WHERE COALESCE(is_public, 1) = 1')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $reason = null;
            if ($wantTitle !== '' && self::normalizeTitle((string)$row['title']) === $wantTitle) {
                $reason = 'trùng tên';
            } else {
                $path = $rootDir . '/' . $row['xmlPath'];
                // So kích thước trước (rẻ) rồi mới băm, để không đọc cả kho mỗi lần nhập.
                if (is_file($path) && filesize($path) === $size) {
                    $hash ??= md5($xml);
                    if (md5_file($path) === $hash) $reason = 'nội dung XML y hệt';
                }
            }
            if ($reason !== null) {
                $found[] = ['id' => (string)$row['id'], 'title' => (string)$row['title'], 'reason' => $reason];
                if (count($found) >= self::MAX_MATCHES) break;
            }
        }
        return $found;
    }
}
