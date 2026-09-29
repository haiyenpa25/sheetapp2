<?php
/**
 * tools/clean_test_setlists.php
 *
 * Công cụ rà soát và dọn dẹp dữ liệu thử nghiệm trong bảng setlists (Ticket R3-8).
 * Mặc định luôn chạy ở chế độ --dry-run (không sửa dữ liệu thật).
 *
 * Cách dùng CLI:
 *   php tools/clean_test_setlists.php              # Chạy dry-run mặc định
 *   php tools/clean_test_setlists.php --dry-run    # Chạy dry-run rõ ràng
 *   php tools/clean_test_setlists.php --status     # Xem thống kê tổng quan
 *   php tools/clean_test_setlists.php --backup     # Sao lưu danh sách test ra storage/backups/
 *   php tools/clean_test_setlists.php --execute    # Thực hiện dọn dẹp thật (yêu cầu chủ dự án duyệt)
 *   php tools/clean_test_setlists.php --db=PATH    # Chỉ định file CSDL cụ thể (dành cho test)
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Forbidden: CLI only\n");
}

$options = getopt('', [
    'dry-run',
    'execute',
    'status',
    'backup',
    'force',
    'db::',
    'format::', // 'table' (default) hoặc 'json'
]);

$dbPath = $options['db'] ?? __DIR__ . '/../storage/data/app.sqlite';
if (!file_exists($dbPath)) {
    fwrite(STDERR, "❌ Không tìm thấy database tại: {$dbPath}\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON;');
$pdo->exec('PRAGMA journal_mode = WAL;');

/**
 * Các mẫu nhận diện chương trình/setlist thử nghiệm
 * @return list<array{pattern: string, description: string}>
 */
function getTestSetlistPatterns(): array {
    return [
        ['pattern' => '%Test%', 'description' => 'Chứa từ khóa "Test"'],
        ['pattern' => 'E2E%', 'description' => 'Bắt đầu bằng "E2E" (bài test tự động)'],
        ['pattern' => '%Phụng Vụ%', 'description' => 'Chứa từ ngữ phụng vụ cũ (Setlist Phụng Vụ)'],
        ['pattern' => '%Mock%', 'description' => 'Chứa từ khóa "Mock"'],
        ['pattern' => '%Sample%', 'description' => 'Chứa từ khóa "Sample"'],
    ];
}

/**
 * Quét toàn bộ setlists và phân loại
 * @return array{
 *     test_setlists: list<array<string, mixed>>,
 *     real_setlists: list<array<string, mixed>>,
 *     stats: array<string, int>
 * }
 */
function scanSetlists(PDO $pdo): array {
    $all = $pdo->query("SELECT id, title, created_by, status, created_at, scheduled_date FROM setlists ORDER BY id ASC")->fetchAll();
    
    $testSetlists = [];
    $realSetlists = [];
    $patterns = getTestSetlistPatterns();

    foreach ($all as $s) {
        $id = (int)$s['id'];
        $title = (string)$s['title'];
        $matchedReasons = [];

        foreach ($patterns as $p) {
            $like = $p['pattern'];
            // Chuyển SQLite LIKE sang regex đơn giản
            $regex = '/^' . str_replace('%', '.*', preg_quote($like, '/')) . '$/iu';
            if (preg_match($regex, $title)) {
                $matchedReasons[] = $p['description'];
            }
        }

        // Đếm các bản ghi liên kết
        $stmtItems = $pdo->prepare("SELECT count(*) FROM setlist_items WHERE setlist_id = ?");
        $stmtItems->execute([$id]);
        $itemCount = (int)$stmtItems->fetchColumn();

        $stmtPlans = $pdo->prepare("SELECT count(*) FROM service_plan_assignments WHERE setlist_id = ?");
        $stmtPlans->execute([$id]);
        $planCount = (int)$stmtPlans->fetchColumn();

        $stmtUsage = $pdo->prepare("SELECT count(*) FROM song_usage_history WHERE setlist_id = ?");
        $stmtUsage->execute([$id]);
        $usageCount = (int)$stmtUsage->fetchColumn();

        $record = array_merge($s, [
            'item_count' => $itemCount,
            'plan_count' => $planCount,
            'usage_count' => $usageCount,
            'reasons' => $matchedReasons,
        ]);

        if (!empty($matchedReasons)) {
            $testSetlists[] = $record;
        } else {
            $realSetlists[] = $record;
        }
    }

    $totalTestItems = array_sum(array_column($testSetlists, 'item_count'));
    $totalTestPlans = array_sum(array_column($testSetlists, 'plan_count'));
    $totalTestUsages = array_sum(array_column($testSetlists, 'usage_count'));

    return [
        'test_setlists' => $testSetlists,
        'real_setlists' => $realSetlists,
        'stats' => [
            'total' => count($all),
            'test_count' => count($testSetlists),
            'real_count' => count($realSetlists),
            'test_items' => $totalTestItems,
            'test_plans' => $totalTestPlans,
            'test_usages' => $totalTestUsages,
        ],
    ];
}

/**
 * Tạo bản sao lưu danh sách test ra JSON
 */
function backupTestSetlists(PDO $pdo, array $testSetlists): string {
    $backupDir = __DIR__ . '/../storage/backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0755, true);
    }

    $ids = array_column($testSetlists, 'id');
    $backupData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'test_setlists' => $testSetlists,
        'details' => [],
    ];

    if (!empty($ids)) {
        $inClause = implode(',', array_map('intval', $ids));
        $backupData['details']['setlist_items'] = $pdo->query("SELECT * FROM setlist_items WHERE setlist_id IN ({$inClause})")->fetchAll();
        $backupData['details']['service_plan_assignments'] = $pdo->query("SELECT * FROM service_plan_assignments WHERE setlist_id IN ({$inClause})")->fetchAll();
        $backupData['details']['song_usage_history'] = $pdo->query("SELECT * FROM song_usage_history WHERE setlist_id IN ({$inClause})")->fetchAll();
    }

    $filename = $backupDir . '/test_setlists_backup_' . date('Ymd_His') . '.json';
    file_put_contents($filename, json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $filename;
}

/**
 * Thực hiện xóa dữ liệu test (kèm transaction và cascade)
 * @return array{deleted_setlists: int, deleted_items: int, deleted_plans: int, deleted_usages: int}
 */
function executeCleanup(PDO $pdo, array $testSetlists): array {
    if (empty($testSetlists)) {
        return ['deleted_setlists' => 0, 'deleted_items' => 0, 'deleted_plans' => 0, 'deleted_usages' => 0];
    }

    $ids = array_map('intval', array_column($testSetlists, 'id'));
    $inClause = implode(',', $ids);

    $pdo->beginTransaction();
    try {
        // Đếm trước khi xóa để báo cáo chính xác
        $deletedItems = (int)$pdo->query("SELECT count(*) FROM setlist_items WHERE setlist_id IN ({$inClause})")->fetchColumn();
        $deletedPlans = (int)$pdo->query("SELECT count(*) FROM service_plan_assignments WHERE setlist_id IN ({$inClause})")->fetchColumn();
        $deletedUsages = (int)$pdo->query("SELECT count(*) FROM song_usage_history WHERE setlist_id IN ({$inClause})")->fetchColumn();

        // Xóa cascade
        $pdo->exec("DELETE FROM setlist_items WHERE setlist_id IN ({$inClause})");
        $pdo->exec("DELETE FROM service_plan_assignments WHERE setlist_id IN ({$inClause})");
        $pdo->exec("DELETE FROM song_usage_history WHERE setlist_id IN ({$inClause})");
        
        // Cập nhật gỡ setlist_id trong practice_assignments nếu có
        $pdo->exec("UPDATE practice_assignments SET setlist_id = NULL WHERE setlist_id IN ({$inClause})");

        // Xóa setlists
        $stmtDel = $pdo->prepare("DELETE FROM setlists WHERE id IN ({$inClause})");
        $stmtDel->execute();
        $deletedSetlists = $stmtDel->rowCount();

        $pdo->commit();

        return [
            'deleted_setlists' => $deletedSetlists,
            'deleted_items' => $deletedItems,
            'deleted_plans' => $deletedPlans,
            'deleted_usages' => $deletedUsages,
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

// ─────────────────────────────────────────────────────────────
// XỬ LÝ LỆNH
// ─────────────────────────────────────────────────────────────

$scan = scanSetlists($pdo);
$format = $options['format'] ?? 'table';
$isExecute = isset($options['execute']);
$isBackupOnly = isset($options['backup']);
$isStatusOnly = isset($options['status']);

// 1. Chế độ xem trạng thái --status
if ($isStatusOnly) {
    if ($format === 'json') {
        echo json_encode($scan, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        exit(0);
    }
    echo "========================================================\n";
    echo " THỐNG KÊ DỮ LIỆU CHƯƠNG TRÌNH (SETLISTS)\n";
    echo "========================================================\n";
    echo "Tổng số chương trình trong CSDL: {$scan['stats']['total']}\n";
    echo " • Số chương trình thực tế:        {$scan['stats']['real_count']}\n";
    echo " • Số chương trình thử nghiệm:     {$scan['stats']['test_count']}\n";
    echo "   - Bài hát trong test:          {$scan['stats']['test_items']}\n";
    echo "   - Phân công trong test:        {$scan['stats']['test_plans']}\n";
    echo "   - Lịch sử sử dụng trong test:  {$scan['stats']['test_usages']}\n";
    exit(0);
}

// 2. Chế độ sao lưu --backup
if ($isBackupOnly) {
    $file = backupTestSetlists($pdo, $scan['test_setlists']);
    echo "✅ Đã tạo file sao lưu dữ liệu test: {$file}\n";
    echo "   Số lượng setlists đã sao lưu: " . count($scan['test_setlists']) . "\n";
    exit(0);
}

// 3. Chế độ thực thi thật --execute (Yêu cầu xác nhận)
if ($isExecute) {
    echo "========================================================\n";
    echo " THỰC HIỆN DỌN DẸP DỮ LIỆU THỬ NGHIỆM (--execute)\n";
    echo "========================================================\n";

    if (empty($scan['test_setlists'])) {
        echo "ℹ️  Không có dữ liệu thử nghiệm nào cần dọn dẹp.\n";
        exit(0);
    }

    // Tự động backup an toàn trước khi xóa
    $backupFile = backupTestSetlists($pdo, $scan['test_setlists']);
    echo "📦 Đã tự động tạo bản sao lưu an toàn trước khi dọn: {$backupFile}\n";

    $result = executeCleanup($pdo, $scan['test_setlists']);

    echo "✅ DỌN DẸP HOÀN TẤT THÀNH CÔNG:\n";
    echo " • Số setlists đã xóa:           {$result['deleted_setlists']}\n";
    echo " • Số bài hát setlist_items:     {$result['deleted_items']}\n";
    echo " • Số phân công đã dọn:          {$result['deleted_plans']}\n";
    echo " • Số bản ghi lịch sử sử dụng:   {$result['deleted_usages']}\n";
    exit(0);
}

// 4. Mặc định: Chế độ DRY-RUN (không chỉnh sửa CSDL)
if ($format === 'json') {
    echo json_encode([
        'mode' => 'dry-run',
        'scan' => $scan,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}

echo "=========================================================================================\n";
echo " BẢNG DANH SÁCH DRY-RUN: CÁC CHƯƠNG TRÌNH THỬ NGHIỆM ĐỀ XUẤT DỌN DẸP (R3-8)\n";
echo " (Chế độ DRY-RUN: Dữ liệu chưa hề bị thay đổi. Cần chủ dự án duyệt trước khi xóa thật)\n";
echo "=========================================================================================\n\n";

if (empty($scan['test_setlists'])) {
    echo "ℹ️  Không phát hiện chương trình thử nghiệm nào trong CSDL.\n";
    exit(0);
}

printf("| %-4s | %-42s | %-12s | %-19s | %-6s | %-24s |\n",
    "ID", "Tên Chương Trình", "Trạng thái", "Ngày tạo", "Số bài", "Lý do nhận diện");
echo "|------|--------------------------------------------|--------------|---------------------|--------|--------------------------|\n";

foreach ($scan['test_setlists'] as $item) {
    $titleTruncated = mb_strimwidth((string)$item['title'], 0, 42, '...');
    $reasonStr = mb_strimwidth(implode(', ', $item['reasons']), 0, 24, '...');
    printf("| %-4d | %-42s | %-12s | %-19s | %-6d | %-24s |\n",
        $item['id'],
        $titleTruncated,
        $item['status'] ?? 'N/A',
        $item['created_at'] ?? 'N/A',
        $item['item_count'],
        $reasonStr
    );
}

echo "\n-----------------------------------------------------------------------------------------\n";
echo "Tổng kết Dry-Run:\n";
echo " • Tổng số chương trình thử nghiệm: {$scan['stats']['test_count']} (trên tổng số {$scan['stats']['total']})\n";
echo " • Tổng số mục bài hát liên kết:    {$scan['stats']['test_items']}\n";
echo " • Tổng số phân công phụng vụ/thờ:  {$scan['stats']['test_plans']}\n";
echo " • Tổng số lượt lịch sử sử dụng:    {$scan['stats']['test_usages']}\n";
echo "-----------------------------------------------------------------------------------------\n";
echo "👉 Để dọn dẹp thật sau khi chủ dự án đồng ý, chạy:\n";
echo "   php tools/clean_test_setlists.php --execute\n";
echo "=========================================================================================\n";
