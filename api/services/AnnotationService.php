<?php
declare(strict_types=1);
require_once __DIR__ . '/AnnotationDocumentStore.php';

class AnnotationService {
    public const BASE_DIR = __DIR__ . '/../../storage/data/annotations';
    public const LEGACY_DIR = __DIR__ . '/../../data/annotations';
    private const DEFAULT_INSTRUMENTS = [
        ['id' => 'general', 'name' => 'Chung'], ['id' => 'guitar', 'name' => 'Guitar'],
        ['id' => 'keyboard', 'name' => 'Keyboard'], ['id' => 'bass', 'name' => 'Bass'],
        ['id' => 'drums', 'name' => 'Trống'], ['id' => 'vocals', 'name' => 'Hát'],
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

    public static function saveDocument(string $songId, array $annotations, string $revision, ?string $directory = null): array {
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
        $data = $store->write($songId, $revision, fn() => [
            'schemaVersion' => 2, 'arrangementId' => 'default', 'annotations' => $clean,
        ], self::legacy($songId, $directory));
        return self::response($data) + $registry;
    }

    public static function instruments(?string $directory = null): array {
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->read('.instruments', self::DEFAULT_INSTRUMENTS);
        return ['instruments' => $data, 'registryRevision' => AnnotationDocumentStore::revision($data)];
    }

    public static function saveInstrument(string $id, string $name, string $revision, ?string $directory = null): array {
        $name = trim($name);
        if ($name === '' || mb_strlen($name) > 40 || preg_match('/[\x00-\x1F]/u', $name)) {
            throw new HttpException(422, 'Tên nhạc cụ cần từ 1 đến 40 ký tự.');
        }
        $store = new AnnotationDocumentStore($directory ?? self::BASE_DIR);
        $data = $store->write('.instruments', $revision, function (array $current) use ($id, $name): array {
            if (count($current) >= 40 && $id === '') throw new HttpException(422, 'Tối đa 40 nhạc cụ.');
            foreach ($current as $instrument) {
                if ($instrument['id'] !== $id && mb_strtolower($instrument['name']) === mb_strtolower($name)) {
                    throw new HttpException(422, 'Tên nhạc cụ đã tồn tại.');
                }
            }
            if ($id === '') { $current[] = ['id' => 'inst-' . bin2hex(random_bytes(6)), 'name' => $name]; return $current; }
            foreach ($current as &$instrument) {
                if ($instrument['id'] === $id) { $instrument['name'] = $name; return $current; }
            }
            throw new HttpException(422, 'Nhạc cụ không tồn tại.');
        }, self::DEFAULT_INSTRUMENTS);
        return ['instruments' => $data, 'registryRevision' => AnnotationDocumentStore::revision($data)];
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
        return ['schemaVersion' => 2, 'arrangementId' => 'default', 'annotations' => $list, 'revision' => AnnotationDocumentStore::revision($data)];
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
