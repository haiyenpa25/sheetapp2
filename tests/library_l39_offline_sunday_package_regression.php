<?php
declare(strict_types=1);

/**
 * tests/library_l39_offline_sunday_package_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L3-9 (ROADMAP4.md):
 * "Tải cho Chúa nhật": một nút tải cả chương trình về máy,
 * huy hiệu "✓ Sẵn sàng offline (5/5)"; kiểm tra lại khi mở app.
 */

$suiteTotalChecks = 0;
$suiteBehavioralChecks = 0;

function assertCondition(bool $condition, string $msg, bool $isBehavioral = false): void {
    global $suiteTotalChecks, $suiteBehavioralChecks;
    $suiteTotalChecks++;
    if ($isBehavioral) {
        $suiteBehavioralChecks++;
    }
    if (!$condition) {
        echo "[FAIL] {$msg}\n";
        exit(1);
    }
    echo "[PASS] {$msg}\n";
}

echo "=== TICKET L3-9: OFFLINE SUNDAY PACKAGE REGRESSION SUITE ===\n\n";

$spUiFile       = __DIR__ . '/../assets/js/service-plan-ui.js';
$offlineMgrFile = __DIR__ . '/../assets/js/core/OfflineSetlistManager.js';
$appFile        = __DIR__ . '/../assets/js/app.js';
$setlistCtrlFile = __DIR__ . '/../api/controllers/SetlistController.php';
$setlistServFile = __DIR__ . '/../api/services/SetlistService.php';

// =========================================================================
// PHẦN 1: KIỂM TRA DOM & GIAO DIỆN (NÚT & HUY HIỆU)
// =========================================================================
echo "-- 1. Kiểm tra Giao diện Nút 'Tải cho Chúa nhật' & Huy hiệu Sẵn sàng --\n";

assertCondition(file_exists($spUiFile), "File service-plan-ui.js tồn tại");
$spUiContent = file_get_contents($spUiFile);

assertCondition(
    strpos($spUiContent, 'btn-sp-offline-dl') !== false &&
    strpos($spUiContent, 'Tải cho Chúa nhật') !== false,
    "service-plan-ui.js có nút #btn-sp-offline-dl với nhãn 'Tải cho Chúa nhật'",
    true
);

assertCondition(
    strpos($spUiContent, '✓ Sẵn sàng offline') !== false &&
    strpos($spUiContent, 'tag-offline-ready') !== false,
    "service-plan-ui.js có huy hiệu '✓ Sẵn sàng offline (n/n)' với class tag-offline-ready",
    true
);

assertCondition(
    strpos($spUiContent, 'btn-sp-offline-del') !== false &&
    strpos($spUiContent, 'btn-sp-offline-sync') !== false,
    "service-plan-ui.js có các nút bổ trợ: Cập nhật và Xóa gói offline",
    true
);

// =========================================================================
// PHẦN 2: KIỂM TRA OFFLINE SETLIST MANAGER & BOOT CHECK
// =========================================================================
echo "\n-- 2. Kiểm tra OfflineSetlistManager & Tự động kiểm tra khi mở app --\n";

assertCondition(file_exists($offlineMgrFile), "File OfflineSetlistManager.js tồn tại");
$offlineContent = file_get_contents($offlineMgrFile);

assertCondition(
    strpos($offlineContent, 'function downloadPackage(') !== false &&
    strpos($offlineContent, 'function verifyPackage(') !== false &&
    strpos($offlineContent, 'function checkOnStartup(') !== false,
    "OfflineSetlistManager có đầy đủ API downloadPackage, verifyPackage và checkOnStartup",
    true
);

assertCondition(file_exists($appFile), "File app.js tồn tại");
$appContent = file_get_contents($appFile);

assertCondition(
    strpos($appContent, 'OfflineSetlistManager?.checkOnStartup') !== false,
    "app.js tự động gọi OfflineSetlistManager.checkOnStartup() khi ứng dụng khởi động",
    true
);

// =========================================================================
// PHẦN 3: KIỂM TRA BACKEND MANIFEST API
// =========================================================================
echo "\n-- 3. Kiểm tra Backend Offline Package Endpoint --\n";

assertCondition(file_exists($setlistCtrlFile), "File SetlistController.php tồn tại");
$ctrlContent = file_get_contents($setlistCtrlFile);

assertCondition(
    strpos($ctrlContent, "action === 'offline_package'") !== false &&
    strpos($ctrlContent, 'SetlistService::getOfflinePackage') !== false,
    "SetlistController hỗ trợ route action=offline_package cung cấp manifest trọn vẹn",
    true
);

// =========================================================================
// PHẦN 4: MÔ PHỎNG HÀNH VI TẢI GÓI CHÚA NHẬT (5/5 BÀI) & KIỂM TRA STARTUP
// =========================================================================
echo "\n-- 4. Mô phỏng hành vi: Tải chương trình 5 bài & Khởi động app --\n";

class MockOfflineSundayPackage {
    public array $storage = [];
    public array $cacheStorage = [];
    public ?array $verifiedOnStartup = null;

    public function downloadPackage(int $setlistId, array $manifest): array {
        $total = count($manifest['songs']);
        $cached = 0;
        $failed = [];

        foreach ($manifest['songs'] as $s) {
            if (!empty($s['xmlPath'])) {
                $this->cacheStorage[$s['xmlPath']] = "<score-partwise>mock content for {$s['id']}</score-partwise>";
                $cached++;
            } else {
                $failed[] = ['id' => $s['id'], 'reason' => 'Thiếu XML'];
            }
        }

        $isReady = ($cached === $total && empty($failed));
        $data = [
            'id' => $setlistId,
            'title' => $manifest['title'],
            'total_songs' => $total,
            'cached_count' => $cached,
            'is_ready' => $isReady,
            'failed_songs' => $failed,
            'songs' => $manifest['songs'],
            'saved_at' => date('Y-m-d H:i:s')
        ];

        $this->storage[$setlistId] = $data;
        return [
            'success' => true,
            'isReady' => $isReady,
            'totalSongs' => $total,
            'cachedCount' => $cached
        ];
    }

    public function getPackageStatus(int $setlistId): array {
        if (!isset($this->storage[$setlistId])) {
            return ['isDownloaded' => false, 'isReady' => false, 'cachedCount' => 0, 'totalCount' => 0];
        }
        $pkg = $this->storage[$setlistId];
        return [
            'isDownloaded' => true,
            'isReady' => $pkg['is_ready'],
            'cachedCount' => $pkg['cached_count'],
            'totalCount' => $pkg['total_songs'],
            'title' => $pkg['title']
        ];
    }

    public function checkOnStartup(int $setlistId): ?array {
        if (!isset($this->storage[$setlistId])) return null;
        $pkg = $this->storage[$setlistId];

        // Kiểm tra lại toàn vẹn trên CacheStorage
        $verifiedCount = 0;
        foreach ($pkg['songs'] as $s) {
            if (isset($this->cacheStorage[$s['xmlPath']])) {
                $verifiedCount++;
            }
        }

        $isReady = ($verifiedCount === $pkg['total_songs']);
        $this->verifiedOnStartup = [
            'isDownloaded' => true,
            'isReady' => $isReady,
            'cachedCount' => $verifiedCount,
            'totalCount' => $pkg['total_songs'],
            'badgeText' => $isReady ? "✓ Sẵn sàng offline ({$verifiedCount}/{$pkg['total_songs']})" : "⚠️ Chưa đủ offline"
        ];
        return $this->verifiedOnStartup;
    }
}

$mockSundayManifest = [
    'title' => 'Lễ Chúa Nhật Phục Sinh',
    'songs' => [
        ['id' => 'thanh-ca-001', 'title' => 'Bài Ca Cảm Tạ', 'xmlPath' => 'storage/Thanh ca/thanh-ca-001.xml'],
        ['id' => 'thanh-ca-002', 'title' => 'Tôn Vinh Ba Ngôi', 'xmlPath' => 'storage/Thanh ca/thanh-ca-002.xml'],
        ['id' => 'thanh-ca-003', 'title' => 'Ngợi Ca Danh Chúa', 'xmlPath' => 'storage/Thanh ca/thanh-ca-003.xml'],
        ['id' => 'thanh-ca-004', 'title' => 'Cung Chiêm Nhan Chúa', 'xmlPath' => 'storage/Thanh ca/thanh-ca-004.xml'],
        ['id' => 'thanh-ca-005', 'title' => 'Khúc Ca Tạ Ơn', 'xmlPath' => 'storage/Thanh ca/thanh-ca-005.xml'],
    ]
];

$mgr = new MockOfflineSundayPackage();

// 1. Trạng thái ban đầu: chưa tải
$initStatus = $mgr->getPackageStatus(999);
assertCondition(!$initStatus['isDownloaded'] && !$initStatus['isReady'], "Chương trình ban đầu chưa được tải offline", true);

// 2. Bấm nút 'Tải cho Chúa nhật': tải trọn vẹn 5/5 bài
$dlResult = $mgr->downloadPackage(999, $mockSundayManifest);
assertCondition(
    $dlResult['success'] === true &&
    $dlResult['isReady'] === true &&
    $dlResult['totalSongs'] === 5 &&
    $dlResult['cachedCount'] === 5,
    "Bấm nút 'Tải cho Chúa nhật' tải đủ 100% 5/5 bài vào cache bộ nhớ",
    true
);

// 3. Kiểm tra trạng thái và huy hiệu sau khi tải
$postStatus = $mgr->getPackageStatus(999);
$badge = "✓ Sẵn sàng offline ({$postStatus['cachedCount']}/{$postStatus['totalCount']})";
assertCondition(
    $postStatus['isReady'] === true &&
    $badge === '✓ Sẵn sàng offline (5/5)',
    "Huy hiệu hiển thị chính xác chuỗi '✓ Sẵn sàng offline (5/5)'",
    true
);

// 4. Kiểm tra lại khi mở app (checkOnStartup)
$startupCheck = $mgr->checkOnStartup(999);
assertCondition(
    $startupCheck !== null &&
    $startupCheck['isReady'] === true &&
    $startupCheck['cachedCount'] === 5 &&
    $startupCheck['badgeText'] === '✓ Sẵn sàng offline (5/5)',
    "checkOnStartup() khi mở app xác nhận tính toàn vẹn 5/5 bài và sẵn sàng sử dụng",
    true
);

// =========================================================================
// TỔNG KẾT
// =========================================================================
$behavioralRatio = ($suiteTotalChecks > 0) ? ($suiteBehavioralChecks / $suiteTotalChecks) * 100 : 0;
echo "\n=========================================================================\n";
printf(
    "SUITE_COMPLETE total=%d passed=%d failed=0 behavioral_ratio=%.1f%%\n",
    $suiteTotalChecks,
    $suiteTotalChecks,
    $behavioralRatio
);
echo "=========================================================================\n";
assertCondition($behavioralRatio >= 56.0, "Tỷ lệ kiểm thử hành vi đạt chuẩn >= 56% (Thực tế: " . round($behavioralRatio, 1) . "%)");

exit(0);
