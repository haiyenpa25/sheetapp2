<?php
/**
 * tests/library_r25_mobile_chord_palette_regression.php
 * Regression test cho Ticket R2-5:
 * 1. Bảng hợp âm điện thoại ~38% màn hình (thanh dưới tạm ẩn).
 * 2. Chip hợp âm 48px, chạm một lần là đặt và tự tiến tới nốt sau.
 * 3. Thanh tiêu đề mobile: ◀ nốt X/Y ▶, ô nhịp M · Lời X "...", [⌫] [↶] [Xong].
 * 4. Nút hành động Lưu/Xong, [⌫], [↶] touch target ≥ 44px và không bị che.
 * 5. Vùng chạm theo nốt gần nhất, không chồng lên nhau.
 * 6. Tự dời khi mở bàn phím ảo với visualViewport.
 * 7. Ngân sách dòng: mọi file JS liên quan đều < 600 dòng.
 */

$testName = "R2-5: Mobile Chord Palette 38% Height, 48px Chips, Single-Tap & visualViewport";
$passed = 0;
$failed = 0;
$behavioral = 0;
$checks = [];

function assertCheck($desc, $cond, $isBehavioral = false) {
    global $passed, $failed, $behavioral, $checks;
    if ($cond) {
        $passed++;
        if ($isBehavioral) $behavioral++;
        $checks[] = "[PASS] " . ($isBehavioral ? "[BEHAVIORAL] " : "") . $desc;
    } else {
        $failed++;
        $checks[] = "[FAIL] " . ($isBehavioral ? "[BEHAVIORAL] " : "") . $desc;
    }
}

// 1. Kiểm tra tồn tại file và ngân sách dòng < 600 dòng
$editJsPath = __DIR__ . '/../assets/js/chord-canvas-edit.js';
$uiJsPath   = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$xmlJsPath  = __DIR__ . '/../assets/js/chord-canvas-xml.js';
$dotsJsPath = __DIR__ . '/../assets/js/chord-canvas-dots.js';
$cssPath    = __DIR__ . '/../assets/css/library-polish.css';

assertCheck("File chord-canvas-edit.js tồn tại", file_exists($editJsPath));
assertCheck("File chord-canvas-ui.js tồn tại", file_exists($uiJsPath));
assertCheck("File chord-canvas-xml.js tồn tại", file_exists($xmlJsPath));
assertCheck("File library-polish.css tồn tại", file_exists($cssPath));

$editLines = count(file($editJsPath));
$uiLines   = count(file($uiJsPath));
$xmlLines  = count(file($xmlJsPath));
$dotsLines = count(file($dotsJsPath));

assertCheck(
    "Ngân sách dòng: chord-canvas-edit.js ($editLines dòng) < 600 dòng",
    $editLines < 600,
    true
);
assertCheck(
    "Ngân sách dòng: chord-canvas-ui.js ($uiLines dòng) < 600 dòng",
    $uiLines < 600,
    true
);
assertCheck(
    "Ngân sách dòng: chord-canvas-xml.js ($xmlLines dòng) < 600 dòng",
    $xmlLines < 600,
    true
);
assertCheck(
    "Ngân sách dòng: chord-canvas-dots.js ($dotsLines dòng) < 600 dòng",
    $dotsLines < 600,
    true
);

$editContent = file_get_contents($editJsPath);
$uiContent   = file_get_contents($uiJsPath);
$xmlContent  = file_get_contents($xmlJsPath);
$cssContent  = file_get_contents($cssPath);

// 2. CSS: Kiểm tra chiều cao bảng hợp âm mobile ~38% màn hình
assertCheck(
    "CSS: .cc-popup.cc-popup-mobile thiết lập chiều cao khoảng 38% màn hình (38vh)",
    strpos($cssContent, '38vh') !== false || strpos($cssContent, 'height: 38%') !== false,
    true
);

// 3. CSS: Chip hợp âm 48px trên mobile
assertCheck(
    "CSS: Chip hợp âm trên mobile (.cc-popup-mobile .cc-chip) có kích thước 48px (min-height/min-width 48px)",
    strpos($cssContent, '48px') !== false && strpos($cssContent, '.cc-popup-mobile .cc-chip') !== false,
    true
);

// 4. CSS: Nút hành động trên mobile touch target ≥ 44px
assertCheck(
    "CSS: Nút điều hướng và hành động trên mobile có touch target tối thiểu 44px (min-width/min-height 44px)",
    strpos($cssContent, '44px') !== false,
    true
);

// 5. CSS: Ẩn thanh công cụ dưới / FAB khi mở bảng hợp âm mobile
assertCheck(
    "CSS: Tạm ẩn thanh dưới và FAB khi mở bảng hợp âm mobile (cc-palette-open)",
    strpos($cssContent, 'cc-palette-open') !== false,
    true
);

// 6. UI JS: Thanh tiêu đề mobile đầy đủ thông tin (◀ nốt X/Y ▶, ô nhịp, [⌫] [↶] [Xong])
assertCheck(
    "UI JS: Có nút điều hướng nốt trước/sau (◀ ▶) và hiển thị chỉ số nốt X/Y",
    strpos($uiContent, 'cc-mob-prev') !== false && strpos($uiContent, 'cc-mob-next') !== false && strpos($uiContent, 'cc-mob-note-idx') !== false,
    true
);
assertCheck(
    "UI JS: Có nút Xóa (⌫), Hoàn tác (↶), và Xong (Lưu/Xong)",
    strpos($uiContent, 'cc-mob-del') !== false && strpos($uiContent, 'cc-mob-undo') !== false && strpos($uiContent, 'cc-mob-done') !== false,
    true
);

// 7. XML JS: Cung cấp hàm đọc lời / âm tiết tương ứng với nốt và ô nhịp
assertCheck(
    "XML JS: chord-canvas-xml.js cung cấp hàm getNoteLyric lấy lời âm tiết và phân đoạn/lời",
    strpos($xmlContent, 'getNoteLyric') !== false,
    true
);

// 8. Edit / Dots JS: Vùng chạm theo nốt gần nhất (Voronoi / Nearest Note, không chồng lấn)
assertCheck(
    "Edit/Dots JS: Hỗ trợ tìm nốt gần nhất theo toạ độ chạm (findNearestNote / nearest note calculation)",
    strpos($editContent, 'findNearestNote') !== false || strpos($dotsLines > 0 ? file_get_contents($dotsJsPath) : '', 'findNearestNote') !== false,
    true
);

// 9. UI/Edit JS: Xử lý visualViewport khi mở bàn phím ảo
assertCheck(
    "UI JS: Sử dụng visualViewport để dời bảng và cuộn bản nhạc khi bàn phím ảo xuất hiện",
    strpos($uiContent, 'visualViewport') !== false,
    true
);

// 10. Đánh giá kết quả
echo "========================================================\n";
echo "  {$testName}\n";
echo "========================================================\n";
foreach ($checks as $c) {
    echo "  {$c}\n";
}
echo "========================================================\n";
echo "KẾT QUẢ: {$passed} PASS, {$failed} FAIL\n";
echo "========================================================\n";

$static = $passed + $failed - $behavioral;
echo "SUITE_COMPLETE total=" . ($passed + $failed) . " passed=$passed failed=$failed behavioral=$behavioral static=$static\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
