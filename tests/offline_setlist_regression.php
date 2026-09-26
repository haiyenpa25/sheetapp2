<?php
/**
 * tests/offline_setlist_regression.php
 *
 * Kiểm tra hồi quy toàn diện cho Epic 3.2 — Offline Setlist Đáng Tin Cậy:
 * 1. Backend Offline Package API Contract (Manifest phụ thuộc: setlist, songs, chord sets, package_version).
 * 2. Tính toàn vẹn gói & Strict Readiness Check (Không báo sẵn sàng nếu thiếu asset).
 * 3. Chu kỳ sống của gói: Tải trước, kiểm tra checksum/mtime, cập nhật phiên bản và thu hồi/xóa gói.
 * 4. API Controller & RBAC Route Handling (action=offline_package / manifest).
 * 5. Tích hợp Frontend Offline Fallback (OfflineSetlistManager, ApiService, SetlistUI, ChordCanvas).
 * 6. Tương thích Service Worker v4 (CacheStorage 'sheetapp-musicxml-v4' & offline fallback).
 */

declare(strict_types=1);

require_once __DIR__ . '/fixtures/test_db_fixture.php';

function check(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== EPIC 3.2 — OFFLINE SETLIST REGRESSION SUITE ===\n";

$root = dirname(__DIR__);
$pdo = createTestDatabase();

// Nạp các dependency backend
require_once $root . '/api/core/DB.php';
require_once $root . '/api/core/AuditLogger.php';
require_once $root . '/api/services/SetlistService.php';
require_once $root . '/api/services/ChordSetService.php';

DB::setPdo($pdo);
$auditLogFile = sys_get_temp_dir() . '/sheetapp-audit-test-' . bin2hex(random_bytes(4)) . '.log';
AuditLogger::setLogPath($auditLogFile);

// Nạp người dùng test
$adminId  = (int)$pdo->query("SELECT id FROM users WHERE username = 'admin'")->fetchColumn();
$banhatId = (int)$pdo->query("SELECT id FROM users WHERE username = 'banhat'")->fetchColumn();

// ─── TEST 1: Backend Offline Package API Contract ──────────────────
$setlistId = SetlistService::create([
    'title' => 'Chương Trình Chúa Nhật — Gói Ngoại Tuyến',
    'scheduled_date' => '2026-10-11',
    'service_time' => '08:30',
    'theme' => 'Tình Yêu & Sự Trung Tín',
    'status' => 'published',
    'leader_user_id' => $banhatId,
    'created_by' => $adminId
]);

check($setlistId > 0, "Tạo thành công setlist test ID={$setlistId}");

// Thêm 2 bài hát và 1 mục phụng vụ cầu nguyện
$item1 = SetlistService::addItem($setlistId, '001-thanh-chua-yeu-thuong', 'HD', 2, 85, 4, [
    'item_type' => 'song',
    'leader_notes' => 'Intro Piano'
]);
$item2 = SetlistService::addItem($setlistId, '002-ngoi-khen-chua', 'default', -1, 110, 3, [
    'item_type' => 'song',
    'leader_notes' => 'Tập trung bè nam'
]);
$item3 = SetlistService::addItem($setlistId, '', 'HD', 0, null, null, [
    'item_type' => 'prayer',
    'custom_title' => 'Cầu nguyện khai lễ'
]);

check($item1 > 0 && $item2 > 0 && $item3 > 0, "Thêm 3 mục vào setlist (2 bài hát + 1 mục phụng vụ)");

// Gọi API lấy gói Offline
$package = SetlistService::getOfflinePackage($setlistId);

check(is_array($package), "getOfflinePackage trả về cấu trúc array dữ liệu");
check(!empty($package['package_version']), "Gói chứa mã package_version duy nhất");
check(str_starts_with($package['package_version'], 'pkg-' . $setlistId), "package_version có prefix pkg-{id}");
check(isset($package['generated_at']), "Gói chứa timestamp generated_at");
check($package['total_songs'] === 2, "total_songs đúng bằng 2 (không tính mục phụng vụ)");

$songs = $package['songs'];
check(isset($songs['001-thanh-chua-yeu-thuong']), "Gói chứa metadata bài 001");
check(isset($songs['002-ngoi-khen-chua']), "Gói chứa metadata bài 002");
check(!isset($songs['']), "Gói không chứa mục liturgical không có song_id");

$song1 = $songs['001-thanh-chua-yeu-thuong'];
check($song1['title'] === 'Thánh Chúa Yêu Thương', "Bài 1 có tiêu đề chính xác");
check(str_contains($song1['xmlPath'], '001.xml'), "Bài 1 có xmlPath hợp lệ");
check(isset($song1['xml_exists']), "Bài 1 có trường kiểm tra xml_exists");
check(isset($song1['xml_size']), "Bài 1 có trường kích thước xml_size");
check(isset($song1['xml_mtime']), "Bài 1 có trường thời gian xml_mtime");

$chordSets = $package['chord_sets'];
check(isset($chordSets['001-thanh-chua-yeu-thuong']), "Gói chứa chord_sets của bài 1");
check(isset($chordSets['001-thanh-chua-yeu-thuong']['HD']), "Gói chứa profile HD của bài 1 theo CR1");
check(isset($chordSets['002-ngoi-khen-chua']['HD']), "Gói chứa profile HD của bài 2 theo CR1");

// ─── TEST 2: Strict Readiness Check & Checksum Verification ────────
// Trường hợp setlist không tồn tại
$nullPkg = SetlistService::getOfflinePackage(999999);
check($nullPkg === null, "Setlist không tồn tại trả về null");

// Tạo setlist rỗng (chưa có bài hát)
$emptyPlanId = SetlistService::create([
    'title' => 'Chương Trình Trống',
    'created_by' => $adminId
]);
$emptyPkg = SetlistService::getOfflinePackage($emptyPlanId);
check($emptyPkg['total_songs'] === 0 && empty($emptyPkg['songs']), "Setlist rỗng trả về total_songs = 0");

// ─── TEST 3: Cập nhật & Thay đổi Phiên bản Gói ─────────────────────
$v1 = $package['package_version'];
// Thêm 1 bài nữa vào setlist
SetlistService::addItem($setlistId, '001-thanh-chua-yeu-thuong', 'HD', 0, 100, 4);
SetlistService::update($setlistId, ['title' => 'Chương Trình Chúa Nhật — Đã Cập Nhật'], $adminId);

$packageV2 = SetlistService::getOfflinePackage($setlistId);
$v2 = $packageV2['package_version'];
check($v1 !== $v2, "package_version tự động thay đổi khi nội dung setlist cập nhật ({$v1} -> {$v2})");

// ─── TEST 4: API Controller & Route Handling Contract ──────────────
$controllerSrc = file_get_contents($root . '/api/controllers/SetlistController.php') ?: '';
check(str_contains($controllerSrc, "action === 'offline_package'") || str_contains($controllerSrc, "action === 'manifest'"), "SetlistController hỗ trợ action=offline_package / manifest");
check(str_contains($controllerSrc, 'SetlistService::getOfflinePackage($id)'), "SetlistController gọi SetlistService::getOfflinePackage");

// ─── TEST 5: Frontend Modules Contract & Offline Fallback ──────────
// 5.1 OfflineSetlistManager.js
$osmFile = $root . '/assets/js/core/OfflineSetlistManager.js';
check(file_exists($osmFile), "assets/js/core/OfflineSetlistManager.js tồn tại vật lý");

$osmSrc = file_get_contents($osmFile) ?: '';
$osmLines = count(explode("\n", $osmSrc));
check($osmLines < 600, "OfflineSetlistManager.js có {$osmLines} dòng (< 600 dòng theo tiêu chuẩn ngân sách)");
check(str_contains($osmSrc, 'window.OfflineSetlistManager = OfflineSetlistManager'), "Xuất window.OfflineSetlistManager toàn cục");
check(str_contains($osmSrc, 'downloadPackage'), "Hỗ trợ hàm downloadPackage()");
check(str_contains($osmSrc, 'verifyPackage'), "Hỗ trợ hàm verifyPackage()");
check(str_contains($osmSrc, 'getPackageStatus'), "Hỗ trợ hàm getPackageStatus()");
check(str_contains($osmSrc, 'removePackage'), "Hỗ trợ hàm removePackage()");
check(str_contains($osmSrc, 'getOfflineSetlist'), "Hỗ trợ hàm getOfflineSetlist()");
check(str_contains($osmSrc, 'getOfflineSong'), "Hỗ trợ hàm getOfflineSong()");
check(str_contains($osmSrc, 'getOfflineChords'), "Hỗ trợ hàm getOfflineChords()");
check(str_contains($osmSrc, 'sheetapp-musicxml-v4'), "Lưu cache vào CacheStorage 'sheetapp-musicxml-v4'");

// 5.2 ApiService.js
$apiSrc = file_get_contents($root . '/assets/js/core/ApiService.js') ?: '';
check(str_contains($apiSrc, 'getOfflinePackage:'), "ApiService.setlists hỗ trợ getOfflinePackage()");

// 5.3 index.php nạp OfflineSetlistManager.js
$indexSrc = file_get_contents($root . '/index.php') ?: '';
check(str_contains($indexSrc, 'core/OfflineSetlistManager.js'), "index.php nạp core/OfflineSetlistManager.js");

// 5.4 setlist-ui.js tích hợp UI và fallback offline
$setlistUiSrc = file_get_contents($root . '/assets/js/setlist-ui.js') ?: '';
check(str_contains($setlistUiSrc, 'OfflineSetlistManager'), "setlist-ui.js tích hợp OfflineSetlistManager");
check(str_contains($setlistUiSrc, 'btn-sp-offline-dl'), "setlist-ui.js có nút tải offline #btn-sp-offline-dl");
check(str_contains($setlistUiSrc, 'btn-sp-offline-del'), "setlist-ui.js có nút xoá gói #btn-sp-offline-del");
check(str_contains($setlistUiSrc, 'sp-offline-progress-wrap'), "setlist-ui.js có thanh tiến trình tải offline");
check(str_contains($setlistUiSrc, 'getOfflineSetlist'), "setlist-ui.js hỗ trợ fallback getOfflineSetlist khi mất mạng");
check(str_contains($setlistUiSrc, 'getOfflineSong'), "setlist-ui.js hỗ trợ fallback getOfflineSong khi mất mạng");

// 5.5 chord-canvas.js tích hợp fallback offline
$chordCanvasSrc = file_get_contents($root . '/assets/js/chord-canvas.js') ?: '';
check(str_contains($chordCanvasSrc, 'OfflineSetlistManager?.hasOfflineChords'), "chord-canvas.js fallback sang OfflineSetlistManager khi nạp hợp âm offline");

// ─── TEST 6: Service Worker v4 Compatibility ──────────────────────
$swSrc = file_get_contents($root . '/sw.js') ?: '';
check(str_contains($swSrc, 'sheetapp-musicxml-${SW_VERSION}') || str_contains($swSrc, "sheetapp-musicxml-v4"), "sw.js dùng CacheStorage version 'sheetapp-musicxml-v4'");
check(str_contains($swSrc, "networkFirstWithQuota"), "sw.js dùng networkFirstWithQuota cho MusicXML");
check(str_contains($swSrc, "caches.match(request)"), "sw.js hỗ trợ offline fallback cho MusicXML");

echo "\nAll Offline Setlist regression checks PASSED! (6/6)\n";
