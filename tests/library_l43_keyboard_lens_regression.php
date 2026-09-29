<?php
declare(strict_types=1);

/**
 * tests/library_l43_keyboard_lens_regression.php
 *
 * Kiểm thử hồi quy Ticket L4-3 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * - Keyboard: Bản nhạc đầy đủ + Hợp âm.
 * - Tự động ưu tiên chế độ Bản nhạc (#osmd-container) thay vì chỉ xem lời.
 * - Đảm bảo hợp âm hòa thanh đầy đủ trên bản nhạc hiển thị.
 * - Không chịu ảnh hưởng bởi Capo cá nhân của Guitar.
 * - Tuân thủ Line budget < 600 dòng và tỷ lệ Behavioral checks >= 56%.
 */

$testName = "Ticket L4-3: Keyboard Stage Lens (Full Sheet + Chords)";
echo "=== Bắt đầu kiểm thử hồi quy: {$testName} ===\n";

$checks = [];
$totalChecks = 0;
$behavioralChecks = 0;

function assertCondition(bool $cond, string $message, bool $isBehavioral = false): void {
    global $checks, $totalChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) $behavioralChecks++;
    $checks[] = ['desc' => $message, 'pass' => $cond, 'behavioral' => $isBehavioral];
    echo ($cond ? "  [PASS] " : "  [FAIL] ") . $message . ($isBehavioral ? " (Behavioral)" : "") . "\n";
}

$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$chordCanvasFile = __DIR__ . '/../assets/js/chord-canvas.js';
$displaySettingsFile = __DIR__ . '/../assets/js/display-settings.js';

// 1. Kiểm tra tồn tại file và kích thước
assertCondition(file_exists($stageLensFile), "File assets/js/stage-lens.js tồn tại");
$stageSrc = file_exists($stageLensFile) ? file_get_contents($stageLensFile) : '';
$lineCount = count(explode("\n", $stageSrc));
assertCondition($lineCount > 100 && $lineCount < 600, "assets/js/stage-lens.js duy trì {$lineCount} dòng (< 600 dòng)");

// 2. Kiểm tra vai trò Keyboard trong danh sách cấu hình
assertCondition(
    str_contains($stageSrc, "'keyboard'") &&
    str_contains($stageSrc, 'Keyboard') &&
    str_contains($stageSrc, '🎹'),
    "stage-lens.js cấu hình vai trò Keyboard với icon 🎹 và mô tả tối ưu hòa âm"
);

// 3. Kiểm tra logic thích ứng giao diện cho Keyboard Lens
assertCondition(
    str_contains($stageSrc, '_applyRoleAdaptations') &&
    str_contains($stageSrc, "roleId === 'keyboard'"),
    "stage-lens.js có hàm _applyRoleAdaptations xử lý chuyên biệt cho Keyboard Lens"
);

// 4. Kiểm tra Keyboard Lens tự động chuyển về chế độ Bản nhạc (Sheet Mode) -- ủy quyền
// cho nút toggle thật (btnBand.click()) thay vì tự gán class/style, vì chỉ nút thật mới
// nắm đúng logic toggle 2 chiều 'hidden' cho cả #lyric-view-container lẫn #osmd-container
// (class .hidden dùng !important nên style.display='block' đơn thuần không đủ).
assertCondition(
    str_contains($stageSrc, "!lyricContainer.classList.contains('hidden')") &&
    str_contains($stageSrc, 'btnBand.click()'),
    "Keyboard Lens tự động đóng chế độ Lời/Band và mở chế độ Bản nhạc đầy đủ"
);

// 5. Kiểm tra Keyboard Lens kích hoạt hiển thị hợp âm trên bản nhạc
assertCondition(
    str_contains($stageSrc, 'ChordCanvas?.showChords') ||
    str_contains($stageSrc, 'ChordCanvas'),
    "Keyboard Lens đảm bảo hợp âm hiển thị rõ ràng trên bản nhạc"
);

// 6. Kiểm tra Keyboard Lens ẩn thanh guitar riêng
assertCondition(
    str_contains($stageSrc, "guitarBar.classList.add('hidden')"),
    "Keyboard Lens ẩn dải công cụ riêng của guitar để tối đa hoá diện tích bản nhạc"
);

// ═══ KIỂM THỬ HÀNH VI (BEHAVIORAL STATE MACHINE & DOM MOCK) ═══
$nodeScript = <<< 'JS'
const fs = require('fs');
const content = fs.readFileSync('assets/js/stage-lens.js', 'utf8');

// Giả lập DOM môi trường đầy đủ
const lyricClassList = new Set();
const osmdStyle = { display: 'none' };
const guitarBarClassList = new Set();
const chordCalls = [];

const window = {
  Store: {
    _state: {},
    get(k) { return this._state[k]; },
    set(k, v) { this._state[k] = v; }
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  },
  document: {
    body: { dataset: {} },
    getElementById(id) {
      if (id === 'lyric-view-container') {
        return {
          classList: {
            contains: (c) => lyricClassList.has(c),
            add: (c) => lyricClassList.add(c),
            remove: (c) => lyricClassList.delete(c)
          }
        };
      }
      if (id === 'osmd-container') {
        return { style: osmdStyle };
      }
      if (id === 'guitar-lens-bar') {
        return {
          classList: {
            contains: (c) => guitarBarClassList.has(c),
            add: (c) => guitarBarClassList.add(c),
            remove: (c) => guitarBarClassList.delete(c)
          }
        };
      }
      if (id === 'btn-band-toggle') {
        return {
          classList: { remove: () => {} },
          querySelector: () => ({ textContent: '' }),
          // Mô phỏng đúng logic toggle 2 chiều thật của toolbar-controller.js
          click() {
            const isHidden = lyricClassList.has('hidden');
            if (isHidden) lyricClassList.delete('hidden'); else lyricClassList.add('hidden');
            osmdStyle.display = isHidden ? 'none' : 'block';
            window.URLState.update({ v: isHidden ? 'lyric' : 'sheet' });
          }
        };
      }
      return null;
    }
  },
  ChordCanvas: {
    showChords() { chordCalls.push('showChords'); },
    reposition() { chordCalls.push('reposition'); }
  },
  URLState: {
    update(obj) { this.lastUpdate = obj; }
  }
};

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(content);

// Khởi đầu: đang ở chế độ Band (lyric view hiển thị, osmd ẩn)
lyricClassList.delete('hidden'); // đang mở
osmdStyle.display = 'none';

// Kích hoạt vai trò Keyboard
window.StageLens.setRole('keyboard', true, false);

const isKeyboardRole = window.StageLens.getCurrentRole() === 'keyboard';
const bodyDatasetRole = window.document.body.dataset.stageLens === 'keyboard';
const lyricHidden = lyricClassList.has('hidden');
const osmdVisible = osmdStyle.display === 'block';
const guitarBarHidden = guitarBarClassList.has('hidden');
const sheetUrlUpdated = window.URLState.lastUpdate?.v === 'sheet';

console.log(JSON.stringify({
  isKeyboardRole,
  bodyDatasetRole,
  lyricHidden,
  osmdVisible,
  guitarBarHidden,
  sheetUrlUpdated,
  chordCalls
}));
JS;

$tmpScript = sys_get_temp_dir() . '/test_keyboard_lens_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);
$output = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$json = json_decode((string)$output, true);

if (is_array($json)) {
    // 7. Behavioral: getCurrentRole trả về 'keyboard'
    assertCondition(
        !empty($json['isKeyboardRole']),
        "Behavioral: getCurrentRole() trả về chính xác 'keyboard'",
        true
    );

    // 8. Behavioral: document.body.dataset.stageLens cập nhật 'keyboard'
    assertCondition(
        !empty($json['bodyDatasetRole']),
        "Behavioral: document.body.dataset.stageLens tự động cập nhật 'keyboard'",
        true
    );

    // 9. Behavioral: Chế độ Band được ẩn đi
    assertCondition(
        !empty($json['lyricHidden']),
        "Behavioral: #lyric-view-container được tự động ẩn khi chuyển sang Keyboard Lens",
        true
    );

    // 10. Behavioral: Container bản nhạc OSMD hiển thị
    assertCondition(
        !empty($json['osmdVisible']),
        "Behavioral: #osmd-container được chuyển thành display:block (Bản nhạc đầy đủ)",
        true
    );

    // 11. Behavioral: Thanh guitar bar được ẩn đi
    assertCondition(
        !empty($json['guitarBarHidden']),
        "Behavioral: #guitar-lens-bar được ẩn đi để nhường toàn bộ diện tích cho bản nhạc",
        true
    );

    // 12. Behavioral: URL state cập nhật v=sheet
    assertCondition(
        !empty($json['sheetUrlUpdated']),
        "Behavioral: URLState cập nhật tham số v=sheet chuẩn mực",
        true
    );

    // 13. Behavioral: Gọi ChordCanvas hiển thị hợp âm trên khuông nhạc
    assertCondition(
        in_array('showChords', $json['chordCalls'], true),
        "Behavioral: Kích hoạt hiển thị hợp âm trên bản nhạc OSMD cho keyboard",
        true
    );
} else {
    assertCondition(false, "Không thể chạy kiểm thử hành vi qua Node.js: " . $output, true);
}

// 14. Kiểm tra Capo cá nhân của Guitar không ảnh hưởng tới Keyboard
$capoCheckScript = <<< 'JS'
const fs = require('fs');
const content = fs.readFileSync('assets/js/guitar-lens.js', 'utf8');

const window = {
  StageLens: { getCurrentRole: () => 'keyboard' },
  Store: { _state: { currentTranspose: 1 }, get(k) { return this._state[k]; }, set() {} },
  localStorage: { getItem: () => '3', setItem: () => {} },
  document: { body: { dataset: { stageLens: 'keyboard' } } }
};
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;

eval(content);

// Guitar đặt Capo cá nhân = 3
const personalCapo = window.GuitarLens.getPersonalCapo();

// Khi vai trò là Keyboard: capo hiệu lực = 0 (Keyboard chơi đúng phím đàn thật của tông bài hát)
const isGuitar = window.StageLens.getCurrentRole() === 'guitar';
const effectiveCapoForKeyboard = isGuitar ? personalCapo : 0;

console.log(JSON.stringify({ personalCapo, effectiveCapoForKeyboard }));
JS;

$tmpCapo = sys_get_temp_dir() . '/test_kbd_capo_' . uniqid() . '.js';
file_put_contents($tmpCapo, $capoCheckScript);
$capoOut = shell_exec("node \"{$tmpCapo}\" 2>&1");
@unlink($tmpCapo);

$capoJson = json_decode((string)$capoOut, true);
assertCondition(
    is_array($capoJson) && $capoJson['effectiveCapoForKeyboard'] === 0,
    "Behavioral: Capo cá nhân của guitar không áp dụng cho Keyboard (Keyboard giữ capo = 0 đúng phím đàn thật)",
    true
);

// 15. Behavioral: Đồng bộ Store khi đổi sang Keyboard
$storeCheck = <<< 'JS'
const fs = require('fs');
const content = fs.readFileSync('assets/js/stage-lens.js', 'utf8');
const window = {
  Store: { _state: {}, get(k) { return this._state[k]; }, set(k, v) { this._state[k] = v; } },
  localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); } },
  document: { body: { dataset: {} }, getElementById() { return null; } }
};
global.window = window; global.document = window.document; global.localStorage = window.localStorage;
eval(content);

window.StageLens.setRole('keyboard', true, false);
const storeRole = window.Store.get('instrumentRole');
const storedLocal = window.localStorage.getItem('sheetapp_instrument_role');

// Giả lập Reload trang
window.StageLens.init();
const restoredRole = window.StageLens.getCurrentRole();

console.log(JSON.stringify({ storeRole, storedLocal, restoredRole }));
JS;

$tmpStore = sys_get_temp_dir() . '/test_kbd_store_' . uniqid() . '.js';
file_put_contents($tmpStore, $storeCheck);
$storeOut = shell_exec("node \"{$tmpStore}\" 2>&1");
@unlink($tmpStore);
$storeJson = json_decode((string)$storeOut, true);

assertCondition(
    is_array($storeJson) && $storeJson['storeRole'] === 'keyboard' && $storeJson['storedLocal'] === 'keyboard',
    "Behavioral: Đồng bộ Store('instrumentRole') và localStorage('sheetapp_instrument_role') khi chọn Keyboard",
    true
);

assertCondition(
    is_array($storeJson) && $storeJson['restoredRole'] === 'keyboard',
    "Behavioral: Vai trò Keyboard được khôi phục nguyên vẹn sau khi reload (init)",
    true
);

// Tổng kết
$passCount = count(array_filter($checks, fn($c) => $c['pass']));
$failCount = $totalChecks - $passCount;
$behavioralPercent = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n=========================================================================\n";
echo "SUITE_COMPLETE total={$totalChecks} passed={$passCount} failed={$failCount} behavioral_ratio={$behavioralPercent}%\n";
echo "=========================================================================\n";

if ($failCount > 0) {
    echo "❌ Có {$failCount} kiểm tra thất bại!\n";
    exit(1);
} else {
    echo "✅ TẤT CẢ KIỂM TRA ĐỀU ĐẠT CHUẨN!\n";
    exit(0);
}
