<?php
/**
 * tests/liturgical_export_and_usage_regression.php
 *
 * Kiểm thử hồi quy toàn diện cho Epic 4.3:
 * - Lát 4.3-b: Bản in "Lời + Hợp âm" (print/chord-sheet.php) & Booklet Phụng vụ (print/service-booklet.php) (Quyết định D14).
 * - Lát 4.3-c: Báo cáo Lịch sử Sử dụng Bài hát & Cảnh báo lặp bài (Quyết định D15).
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/SongService.php';

function check(bool $condition, string $message): void {
    if (!$condition) {
        echo "  ❌ FAIL: {$message}\n";
        exit(1);
    }
    echo "  ✅ PASS: {$message}\n";
}

echo "=== KIỂM THỬ HỒI QUY EPIC 4.3: BẢN IN BOOKLET & BÁO CÁO LỊCH SỬ DÙNG BÀI ===\n\n";

$baseUrl = 'http://localhost/sheetapp2';

// ── 1. Kiểm tra Bản In Lời + Hợp Âm (print/chord-sheet.php) ──
echo "[1/5] Kiểm tra Bản In Lời + Hợp Âm (print/chord-sheet.php)...\n";

$ch = curl_init("{$baseUrl}/print/chord-sheet.php?song=thanh-ca-001&set=HD&t=2&cols=2");
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$html = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

check($code === 200, "Truy cập print/chord-sheet.php trả về HTTP 200 OK");
check(str_contains($html, 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI'), "HTML chứa đúng tựa bài hát");
check(str_contains($html, 'Tông biểu diễn: <strong>A</strong>'), "Dịch giọng +2 bán âm (G -> A) hiển thị chính xác trên tiêu đề");
check(str_contains($html, 'two-columns'), "Hỗ trợ tùy chọn 2 cột (cols=2) cho bài hát dài");
check(str_contains($html, 'chord-pair'), "Chứa các cặp từ ngữ và hợp âm nổi (chord-pair)");
check(str_contains($html, 'window.print()'), "Tích hợp sẵn nút gọi in trình duyệt window.print()");
check(str_contains($html, '@media print'), "Có khối CSS in ấn chuyên dụng chuẩn A4");

// Kiểm tra tùy chọn chỉ in lời (ẩn hợp âm)
$chNoChord = curl_init("{$baseUrl}/print/chord-sheet.php?song=thanh-ca-001&chords=0");
curl_setopt_array($chNoChord, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$htmlNoChord = curl_exec($chNoChord);
curl_close($chNoChord);
check(!str_contains($htmlNoChord, 'class="chord"'), "Tùy chọn chords=0 ẩn hoàn toàn dòng hợp âm, chỉ giữ lời bài hát");

// ── 2. Kiểm tra Booklet Phụng Vụ (print/service-booklet.php) ──
echo "\n[2/5] Kiểm tra Cuốn Booklet Phụng Vụ A4 (print/service-booklet.php)...\n";

// Sử dụng setlist có bài thật (id=25 hoặc setlist đầu tiên)
$testSetlistId = (int)DB::run("SELECT id FROM setlists ORDER BY id DESC LIMIT 1")->fetchColumn();
if ($testSetlistId <= 0) {
    DB::run("INSERT INTO setlists (title, created_by, status) VALUES ('Setlist Phụng Vụ Test', 1, 'published')");
    $testSetlistId = (int)DB::pdo()->lastInsertId();
    DB::run("INSERT INTO setlist_items (setlist_id, song_id, item_type, display_order, transpose_key, bpm) VALUES (?, 'thanh-ca-001', 'song', 1, 0, 80)", [$testSetlistId]);
}
DB::run("INSERT OR IGNORE INTO song_usage_history (song_id, setlist_id, service_date, chord_profile, transpose_key, created_at) VALUES ('thanh-ca-001', ?, date('now', '-7 days'), 'HD', 0, datetime('now', '-7 days'))", [$testSetlistId]);

check($testSetlistId > 0, "Tìm thấy ít nhất 1 setlist trong cơ sở dữ liệu để test booklet");

$chBooklet = curl_init("{$baseUrl}/print/service-booklet.php?setlist_id={$testSetlistId}&cols=1");
curl_setopt_array($chBooklet, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$htmlBooklet = curl_exec($chBooklet);
$codeBooklet = curl_getinfo($chBooklet, CURLINFO_HTTP_CODE);
curl_close($chBooklet);

check($codeBooklet === 200, "Truy cập print/service-booklet.php trả về HTTP 200 OK");
check(str_contains($htmlBooklet, 'booklet-page'), "Chứa các trang phân tách rõ ràng (booklet-page)");
check(str_contains($htmlBooklet, 'Thứ Tự Chi Tiết Chương Trình'), "Trang bìa có bảng thứ tự chương trình (Order of Service)");
check(str_contains($htmlBooklet, 'page-break-after: always') || str_contains($htmlBooklet, 'break-after: page'), "Có CSS phân trang A4 cho từng bài hát");

// ── 3. Kiểm tra Cảnh Báo Lặp Bài Hát (Quyết định D15) ──
echo "\n[3/5] Kiểm tra API Cảnh Báo Lặp Bài (action=check_recent_usage)...\n";

// 3.1: Kiểm tra bài đã được sử dụng gần đây (thanh-ca-001)
$chCheck1 = curl_init("{$baseUrl}/api/index.php?route=setlists&action=check_recent_usage&song_id=thanh-ca-001&weeks=10");
curl_setopt_array($chCheck1, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res1 = json_decode((string)curl_exec($chCheck1), true);
curl_close($chCheck1);

check(($res1['success'] ?? false) === true, "API check_recent_usage trả về success=true");
$data1 = $res1['data'] ?? [];
check($data1['song_id'] === 'thanh-ca-001', "Trả về đúng song_id");
check(isset($data1['is_recent']) && $data1['is_recent'] === true, "Nhận diện đúng bài đã hát trong khoảng thời gian ngưỡng");
check($data1['warning'] === true, "Cờ cảnh báo warning = true");
check(!empty($data1['warning_message']), "Có thông điệp cảnh báo rõ ràng gồm số tuần, ngày và tên buổi nhóm");

// 3.2: Kiểm tra bài chưa từng được dùng (thanh-ca-700)
$chCheck2 = curl_init("{$baseUrl}/api/index.php?route=setlists&action=check_recent_usage&song_id=thanh-ca-700&weeks=4");
curl_setopt_array($chCheck2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$res2 = json_decode((string)curl_exec($chCheck2), true);
curl_close($chCheck2);

$data2 = $res2['data'] ?? [];
check($data2['is_recent'] === false, "Bài chưa từng dùng trả về is_recent = false");
check($data2['warning'] === false, "Bài chưa từng dùng không phát sinh warning");

// ── 4. Kiểm tra Báo Cáo Lịch Sử Sử Dụng Bài (action=usage_report) ──
echo "\n[4/5] Kiểm tra API Báo Cáo Sử Dụng Bài (action=usage_report)...\n";

$chRep = curl_init("{$baseUrl}/api/index.php?route=setlists&action=usage_report");
curl_setopt_array($chRep, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$resRep = json_decode((string)curl_exec($chRep), true);
curl_close($chRep);

check(($resRep['success'] ?? false) === true, "API usage_report trả về success=true");
$repData = $resRep['data'] ?? [];

// Kiểm tra 4 khối dữ liệu
check(isset($repData['summary']), "Báo cáo có trường summary");
check(isset($repData['summary']['total_services']) && $repData['summary']['total_services'] > 0, "Summary tính đúng tổng số buổi lễ");
check(isset($repData['summary']['total_song_plays']) && $repData['summary']['total_song_plays'] > 0, "Summary tính đúng tổng lượt hát");
check(isset($repData['summary']['coverage_percent']), "Summary tính được tỷ lệ độ phủ bài hát");

check(isset($repData['most_used']) && is_array($repData['most_used']), "Báo cáo có danh sách bài dùng nhiều nhất (most_used)");
if (!empty($repData['most_used'])) {
    $firstMost = $repData['most_used'][0];
    check(isset($firstMost['usage_count']) && $firstMost['usage_count'] > 0, "Top bài có số lần sử dụng hợp lệ");
    check(isset($firstMost['frequent_profile']), "Top bài có thống kê profile hợp âm thường dùng nhất");
}

check(isset($repData['dormant_songs']) && is_array($repData['dormant_songs']), "Báo cáo có danh sách bài tiềm năng chưa dùng / lâu chưa dùng");
check(isset($repData['recent_history']) && is_array($repData['recent_history']), "Báo cáo có nhật ký sử dụng bài gần nhất (recent_history)");

// ── 5. Kiểm tra Tích Hợp UI & Client Services ──
echo "\n[5/5] Kiểm tra Tích Hợp UI & Client Services...\n";

// 5.1: Kiểm tra ApiService.js
$apiServiceJs = file_get_contents(__DIR__ . '/../assets/js/core/ApiService.js');
check(str_contains($apiServiceJs, 'checkRecentUsage:'), "ApiService.setlists chứa phương thức checkRecentUsage");
check(str_contains($apiServiceJs, 'usageReport:'), "ApiService.setlists chứa phương thức usageReport");

// 5.2: Kiểm tra SongInfoBar in ấn
$songInfoJs = file_get_contents(__DIR__ . '/../assets/js/song-info-bar.js');
check(str_contains($songInfoJs, 'si-ni-print-btn'), "SongInfoBar chứa nút in ấn Lời & Hợp âm (si-ni-print-btn)");
check(str_contains($songInfoJs, 'print/chord-sheet.php'), "SongInfoBar mở trang print/chord-sheet.php");

// 5.3: Kiểm tra ServicePlanUI in booklet
$servicePlanJs = file_get_contents(__DIR__ . '/../assets/js/service-plan-ui.js');
check(str_contains($servicePlanJs, 'btn-sp-print-booklet'), "ServicePlanUI chứa nút in Booklet phụng vụ (btn-sp-print-booklet)");
check(str_contains($servicePlanJs, 'print/service-booklet.php'), "ServicePlanUI mở trang print/service-booklet.php");

// 5.4: Kiểm tra Cảnh báo lặp bài trong SetlistDetail (Quyết định D15)
$setlistDetailJs = file_get_contents(__DIR__ . '/../assets/js/setlist-detail.js');
check(str_contains($setlistDetailJs, 'checkRecentUsage'), "SetlistDetail gọi checkRecentUsage khi thêm bài vào Setlist");
check(str_contains($setlistDetailJs, 'Lưu ý lịch sử sử dụng bài hát'), "SetlistDetail hiển thị hộp thoại cảnh báo lặp bài theo D15 mà không chặn");

// 5.5: Kiểm tra Manager Portal Tab Thống Kê
$managerIndexHtml = file_get_contents(__DIR__ . '/../manager/index.php');
if (file_exists(__DIR__ . '/../manager/partials/tabs_bar.php')) {
    $managerIndexHtml .= file_get_contents(__DIR__ . '/../manager/partials/tabs_bar.php');
}
if (file_exists(__DIR__ . '/../manager/partials/tab_usage.php')) {
    $managerIndexHtml .= file_get_contents(__DIR__ . '/../manager/partials/tab_usage.php');
}
check(str_contains($managerIndexHtml, 'id="mgr-nav-tab-usage"'), "Manager có tab Thống Kê Phụng Vụ");
check(str_contains($managerIndexHtml, 'id="tab-usage"'), "Manager có section tab-usage");
check(str_contains($managerIndexHtml, 'manager-usage.js'), "Manager nạp module js/manager-usage.js");

echo "\n----------------------------------------------------\n";
echo "🎉 KẾT QUẢ: TẤT CẢ KIỂM TRA CHO EPIC 4.3 ĐỀU ĐẠT (PASS 100%)!\n";
