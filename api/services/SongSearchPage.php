<?php
declare(strict_types=1);

/** Bounded SQL pages, including an optional exact-number result ranked first. */
final class SongSearchPage {
    public static function fetch(string $sql, array $params, array $filters, ?array $exact = null): array {
        $limit = min(200, max(1, (int)($filters['limit'] ?? 200)));
        $offset = max(0, (int)($filters['offset'] ?? 0));
        $total = (int)DB::run('SELECT COUNT(*) FROM (' . $sql . ') search_count', $params)->fetchColumn();
        $take = $limit - ($exact !== null && $offset === 0 ? 1 : 0);
        $skip = max(0, $offset - ($exact !== null ? 1 : 0));
        $data = $take > 0 ? DB::run($sql . " LIMIT {$take} OFFSET {$skip}", $params)->fetchAll(PDO::FETCH_ASSOC) : [];
        if ($exact !== null && $offset === 0) array_unshift($data, $exact);
        return ['data' => $data, 'total' => $total + ($exact !== null ? 1 : 0), 'limit' => $limit, 'offset' => $offset];
    }
}
