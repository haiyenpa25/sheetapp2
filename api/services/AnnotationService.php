<?php
declare(strict_types=1);
require_once __DIR__ . '/AnnotationDocumentStore.php';

class AnnotationService {
    public const BASE_DIR = __DIR__ . '/../../storage/data/annotations';
    public const LEGACY_DIR = __DIR__ . '/../../data/annotations';
    private const BAND_STYLE_MAX = 40;
    private const BAND_TEXT_MAX = 1000;
    private const TEMPO_MIN = 20;
    private const TEMPO_MAX = 300;
    private const DEFAULT_INSTRUMENTS = [
        ['id' => 'general', 'name' => 'Chung', 'color' => '#64748b'], ['id' => 'guitar', 'name' => 'Guitar', 'color' => '#15803d'],
        ['id' => 'keyboard', 'name' => 'Keyboard', 'color' => '#1d4ed8'], ['id' => 'bass', 'name' => 'Bass', 'color' => '#7e22ce'],
        ['id' => 'drums', 'name' => 'Trống', 'color' => '#c2410c'], ['id' => 'vocals', 'name' => 'Hát', 'color' => '#be185d'],
    ];

    public static function load(string $songId): array {
        return self::document($songId)['annotations'];
    }

    public static function document(string $songId, ?string $directory = null): array {
        self::validateSongId($songId);
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->read($songId, self::legacy($songId, $directory));
        return self::response($data) + self::instruments($directory);
    }

    /**
     * $actor = ['id' => ?int, 'name' => string, 'admin' => bool]; null = công cụ nội bộ/test (không kiểm chủ sở hữu).
     * Thành viên không phải Admin chỉ thêm/sửa/xóa ghi chú do chính mình tạo; ghi chú người khác phải giữ nguyên.
     */
    public static function saveDocument(string $songId, array $annotations, string $revision, ?string $directory = null, ?array $actor = null): array {
        self::validateSongId($songId);
        $registry = self::instruments($directory);
        $allowed = array_column($registry['instruments'], 'id');
        if (!array_is_list($annotations) || count($annotations) > 2000) throw new HttpException(422, 'Danh sách ghi chú không hợp lệ.');
        $seen = [];
        $clean = [];
        foreach ($annotations as $note) {
            $entry = self::validateNote($note, $allowed);
            if (isset($seen[$entry['id']])) throw new HttpException(422, 'ID ghi chú bị trùng.');
            $seen[$entry['id']] = true;
            $clean[] = $entry;
        }
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->write($songId, $revision, function (array $current) use ($clean, $actor, $seen): array {
            $previous = [];
            foreach (self::response($current)['annotations'] as $note) $previous[$note['id']] = $note;
            $next = [];
            foreach ($clean as $entry) {
                $old = $previous[$entry['id']] ?? null;
                if ($old !== null) {
                    foreach (['createdBy', 'author'] as $field) if (isset($old[$field])) $entry[$field] = $old[$field];
                    if (!self::ownedBy($old, $actor) && self::comparable($old) !== self::comparable($entry)) {
                        throw new HttpException(403, 'Chỉ sửa được ghi chú do bạn tạo.');
                    }
                } elseif ($actor !== null) {
                    $entry['createdBy'] = $actor['id'];
                    $entry['author'] = $actor['name'];
                }
                $next[] = $entry;
            }
            foreach ($previous as $id => $old) {
                if (!isset($seen[$id]) && !self::ownedBy($old, $actor)) throw new HttpException(403, 'Chỉ xóa được ghi chú do bạn tạo.');
            }
            return self::withBandNote(['schemaVersion' => 2, 'arrangementId' => 'default', 'annotations' => $next], $current);
        }, self::legacy($songId, $directory));
        return self::response($data) + $registry;
    }

    /** Ghi chú chung của bài cho cả ban nhạc (điệu, tempo, lời dặn). Rỗng toàn bộ = xóa. */
    public static function saveBandNote(string $songId, array $note, string $revision, ?string $directory = null, ?array $actor = null): array {
        self::validateSongId($songId);
        $style = $note['style'] ?? '';
        $text = $note['text'] ?? '';
        $tempo = $note['tempo'] ?? null;
        if (!is_string($style) || !is_string($text) || mb_strlen(trim($style)) > self::BAND_STYLE_MAX
            || mb_strlen(trim($text)) > self::BAND_TEXT_MAX || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', $style . $text)) {
            throw new HttpException(422, 'Ghi chú ban nhạc không hợp lệ.');
        }
        if ($tempo === '' ) $tempo = null;
        if ($tempo !== null && (!is_int($tempo) || $tempo < self::TEMPO_MIN || $tempo > self::TEMPO_MAX)) {
            throw new HttpException(422, 'Tempo cần từ ' . self::TEMPO_MIN . ' đến ' . self::TEMPO_MAX . '.');
        }
        $band = ['style' => trim($style), 'tempo' => $tempo, 'text' => trim($text)];
        $empty = $band['style'] === '' && $band['text'] === '' && $band['tempo'] === null;
        if (!$empty) $band += ['updatedBy' => $actor['name'] ?? '', 'updatedAt' => gmdate('c')];
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->write($songId, $revision, function (array $current) use ($band, $empty): array {
            $next = ['schemaVersion' => 2, 'arrangementId' => 'default', 'annotations' => self::response($current)['annotations']];
            if (!$empty) $next['bandNote'] = $band;
            return $next;
        }, self::legacy($songId, $directory));
        return self::response($data) + self::instruments($directory);
    }

    private static function ownedBy(array $note, ?array $actor): bool {
        if ($actor === null || !empty($actor['admin'])) return true;
        return isset($note['createdBy']) && $actor['id'] !== null && (int)$note['createdBy'] === (int)$actor['id'];
    }

    private static function comparable(array $note): string {
        unset($note['createdBy'], $note['author']);
        ksort($note);
        return json_encode($note, JSON_UNESCAPED_UNICODE);
    }

    private static function withBandNote(array $next, array $current): array {
        if (!array_is_list($current) && isset($current['bandNote']) && is_array($current['bandNote'])) $next['bandNote'] = $current['bandNote'];
        return $next;
    }

    public static function instruments(?string $directory = null): array {
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->read('.instruments', self::DEFAULT_INSTRUMENTS);
        return ['instruments' => self::withColors($data), 'registryRevision' => AnnotationDocumentStore::revision($data)];
    }

    public static function saveInstrument(string $id, string $name, string $revision, ?string $directory = null, ?string $color = null): array {
        if ($color !== null && !preg_match('/^#[0-9a-fA-F]{6}$/D', $color)) throw new HttpException(422, 'Màu nhạc cụ không hợp lệ.');
        $name = trim($name);
        if ($name === '' || mb_strlen($name) > 40 || preg_match('/[\x00-\x1F]/u', $name)) {
            throw new HttpException(422, 'Tên nhạc cụ cần từ 1 đến 40 ký tự.');
        }
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->write('.instruments', $revision, function (array $current) use ($id, $name, $color): array {
            $current = self::withColors($current);
            if (count($current) >= 40 && $id === '') throw new HttpException(422, 'Tối đa 40 nhạc cụ.');
            foreach ($current as $instrument) {
                if ($instrument['id'] !== $id && mb_strtolower($instrument['name']) === mb_strtolower($name)) {
                    throw new HttpException(422, 'Tên nhạc cụ đã tồn tại.');
                }
            }
            if ($id === '') { $current[] = ['id' => 'inst-' . bin2hex(random_bytes(6)), 'name' => $name, 'color' => $color ?? self::colorAt(count($current))]; return $current; }
            foreach ($current as &$instrument) {
                if ($instrument['id'] === $id) { $instrument['name'] = $name; if ($color !== null) $instrument['color'] = strtolower($color); return $current; }
            }
            throw new HttpException(422, 'Nhạc cụ không tồn tại.');
        }, self::DEFAULT_INSTRUMENTS);
        return ['instruments' => self::withColors($data), 'registryRevision' => AnnotationDocumentStore::revision($data)];
    }

    private static function colorAt(int $index): string {
        $palette = ['#64748b', '#15803d', '#1d4ed8', '#7e22ce', '#c2410c', '#be185d', '#0e7490', '#854d0e'];
        return $palette[$index % count($palette)];
    }

    private static function withColors(array $instruments): array {
        foreach ($instruments as $index => &$instrument) {
            $instrument['color'] ??= self::colorAt($index);
        }
        return $instruments;
    }

    private static function validateSongId(string $id): void {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,180}$/D', $id)) throw new HttpException(422, 'Mã bài không hợp lệ.');
    }

    private static function validateNote(mixed $note, array $allowed): array {
        if (!is_array($note)) throw new HttpException(422, 'Ghi chú không hợp lệ.');
        $id = $note['id'] ?? '';
        $text = $note['text'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $id)
            || !is_string($text) || trim($text) === '' || mb_strlen($text) > 500
            || !in_array($note['instrumentId'] ?? '', $allowed, true)) throw new HttpException(422, 'Nội dung hoặc nhạc cụ không hợp lệ.');
        $clean = ['id' => $id, 'instrumentId' => $note['instrumentId'], 'text' => trim($text)];
        foreach (['measureIdx', 'noteIdx', 'staffIdx'] as $field) {
            $value = $note[$field] ?? ($field === 'staffIdx' ? 0 : null);
            if (!is_int($value) || $value < 0 || $value > 100000) throw new HttpException(422, 'Vị trí ghi chú không hợp lệ.');
            $clean[$field] = $value;
        }
        foreach (['beat' => '/^\d{1,9}\/[1-9]\d{0,8}$/D', 'scoreFingerprint' => '/^[a-f0-9]{8}$/D'] as $field => $pattern) {
            if (!isset($note[$field]) || $note[$field] === '') continue;
            if (!is_string($note[$field]) || !preg_match($pattern, $note[$field])) throw new HttpException(422, 'Dấu vị trí bản nhạc không hợp lệ.');
            $clean[$field] = $note[$field];
        }
        $clean['color'] = in_array($note['color'] ?? '', ['yellow', 'blue', 'red', 'green', 'purple'], true) ? $note['color'] : 'yellow';
        $customColor = $note['customColor'] ?? null;
        if ($customColor !== null && $customColor !== '') {
            if (!is_string($customColor) || !preg_match('/^#[0-9a-fA-F]{6}$/D', $customColor)) throw new HttpException(422, 'Màu ghi chú không hợp lệ.');
            $clean['customColor'] = strtolower($customColor);
        }
        $clean['icon'] = is_string($note['icon'] ?? null) ? mb_substr($note['icon'], 0, 8) : '';
        return $clean;
    }

    private static function response(array $data): array {
        $list = $data['annotations'] ?? $data;
        if (!array_is_list($list)) throw new HttpException(500, 'Định dạng ghi chú không đọc được.');
        foreach ($list as $index => &$note) {
            if (!is_array($note)) throw new HttpException(500, 'Ghi chú không đọc được.');
            $note['id'] ??= 'legacy-' . $index;
            $note['instrumentId'] ??= 'general';
            $note['staffIdx'] ??= 0;
        }
        $band = !array_is_list($data) && is_array($data['bandNote'] ?? null) ? $data['bandNote'] : null;
        return ['schemaVersion' => 2, 'arrangementId' => 'default', 'annotations' => $list, 'bandNote' => $band, 'revision' => AnnotationDocumentStore::revision($data)];
    }

    private static function legacy(string $songId, ?string $directory): array {
        if ($directory !== null || !is_file(self::LEGACY_DIR . '/' . $songId . '.json')) return [];
        try {
            $data = json_decode(file_get_contents(self::LEGACY_DIR . '/' . $songId . '.json'), true, 64, JSON_THROW_ON_ERROR);
            if (is_array($data)) return $data;
        } catch (Throwable $error) { throw new HttpException(500, 'Không đọc được ghi chú cũ.', $error); }
        throw new HttpException(500, 'Không đọc được ghi chú cũ.');
    }
}
