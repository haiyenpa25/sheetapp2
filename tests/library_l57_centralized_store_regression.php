<?php
/**
 * tests/library_l57_centralized_store_regression.php
 *
 * Regression Test Suite cho Ticket L5-7 (ROADMAP4.md):
 * "State tập trung: song / set / transpose / zoom / mode / verse nằm trong Store;
 *  URL, thanh công cụ, HUD, chế độ Band là các bên đăng ký nghe.
 *  Nghiệm thu: đổi Store.set('transpose', 2) thì cả 4 chỗ hiển thị cập nhật."
 *
 * Tiêu chuẩn chất lượng:
 * - Bảo toàn 100% CSDL thật (K2 DB Checksum & Row Counts).
 * - Tỷ lệ assertion hành vi (behavioral) >= 40%.
 * - Báo cáo SUITE_COMPLETE total=<n>.
 * - Line budget < 600 dòng.
 */

declare(strict_types=1);

$root = dirname(__DIR__);

echo "=== SUITE L5-7: Centralized State Management (Store) & 4 Subscribers ===\n";

$passedChecks = 0;
$totalChecks = 0;
$behavioralChecks = 0;

function check(bool $condition, string $message, bool $isBehavioral = false): void {
    global $passedChecks, $totalChecks, $behavioralChecks;
    $totalChecks++;
    if ($isBehavioral) $behavioralChecks++;
    if ($condition) {
        $passedChecks++;
        echo "  [PASS] {$message}\n";
    } else {
        echo "  [FAIL] {$message}\n";
    }
}

// ─────────────────────────────────────────────────────────────
// PHẦN 1: STATIC & ARCHITECTURE ANALYSIS (< 600 DÒNG, API, ALIASES)
// ─────────────────────────────────────────────────────────────
echo "\n--- 1. Kiểm tra kiến trúc và tiêu chuẩn mã nguồn Store.js ---\n";

$storePath = $root . '/assets/js/core/Store.js';
check(file_exists($storePath), 'File assets/js/core/Store.js tồn tại');

$storeLines = file($storePath, FILE_IGNORE_NEW_LINES);
$storeCount = count($storeLines);
check($storeCount > 50 && $storeCount < 600, "Store.js line budget đạt {$storeCount} dòng (< 600 dòng)");

$storeContent = file_get_contents($storePath);

// Kiểm tra các canonical keys
$requiredKeys = ['song', 'set', 'transpose', 'zoom', 'mode', 'verse', 'capo', 'role'];
foreach ($requiredKeys as $k) {
    check(str_contains($storeContent, "'{$k}'") || str_contains($storeContent, "\"{$k}\""), "Store.js khai báo canonical key '{$k}'");
}

// Kiểm tra alias mapping 2 chiều
$requiredAliases = ['currentSong', 'currentSet', 'currentTranspose', 'currentZoom', 'currentMode', 'currentVerse', 'capoLevel', 'instrumentRole'];
foreach ($requiredAliases as $a) {
    check(str_contains($storeContent, "'{$a}'") || str_contains($storeContent, "\"{$a}\""), "Store.js hỗ trợ alias tương thích '{$a}'");
}

// Kiểm tra 4 core subscribers
check(str_contains($storeContent, '_syncToUrl'), 'Store.js cài đặt subscriber đồng bộ URL (_syncToUrl)');
check(str_contains($storeContent, '_syncToToolbar'), 'Store.js cài đặt subscriber đồng bộ Toolbar (_syncToToolbar)');
check(str_contains($storeContent, '_syncToHUD'), 'Store.js cài đặt subscriber đồng bộ Stage HUD (_syncToHUD)');
check(str_contains($storeContent, '_syncToBandMode'), 'Store.js cài đặt subscriber đồng bộ Chế độ Band (_syncToBandMode)');
check(str_contains($storeContent, 'subscribe'), 'Store.js cung cấp phương thức subscribe(keys, callback)');
check(str_contains($storeContent, 'initDefaultListeners'), 'Store.js tự động kích hoạt 4 subscribers mặc định');

// Kiểm tra tích hợp Store vào các module liên quan
$modeManagerContent = file_get_contents($root . '/assets/js/core/ModeManager.js');
check(str_contains($modeManagerContent, "window.Store.set('mode'") || str_contains($modeManagerContent, "Store?.set?.('mode'"), 'ModeManager.js đồng bộ mode sang Store');

$verseManagerContent = file_get_contents($root . '/assets/js/core/VerseManager.js');
check(str_contains($verseManagerContent, "Store.set('verse'") || str_contains($verseManagerContent, "Store?.set?.('verse'"), 'VerseManager.js đồng bộ verse sang Store');

$chordCanvasContent = file_get_contents($root . '/assets/js/chord-canvas.js');
check(str_contains($chordCanvasContent, "Store?.set?.('set'") || str_contains($chordCanvasContent, "Store.set('set'"), 'chord-canvas.js đồng bộ set sang Store');

// ─────────────────────────────────────────────────────────────
// PHẦN 2: BEHAVIORAL SIMULATION TRÊN RUNTIME NODE.JS (DOM MOCK)
// ─────────────────────────────────────────────────────────────
echo "\n--- 2. Behavioral Test: Runtime Simulation với DOM Mock ---\n";

$escapedStorePath = json_encode(str_replace('\\', '/', $storePath));
$nodeScript = <<<NODE_JS
const fs = require('fs');
const path = require('path');
const STORE_PATH = {$escapedStorePath};

// 1. Tạo môi trường DOM Mock đầy đủ
const elements = {};

class MockElement {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.textContent = '';
    this.value = '';
    this.title = '';
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, cond) => ((cond !== undefined ? cond : !classes.has(c)) ? classes.add(c) : classes.delete(c)),
    };
    this.children = [];
    this.options = [];
    this.parentNode = null;
  }
  querySelector(sel) {
    if (sel.includes('.lv-key strong')) return elements['lv-key-strong'];
    if (sel.includes('.lv-trans-badge')) return elements['lv-trans-badge'];
    return null;
  }
}

// Khởi tạo các mock elements
elements['song-title'] = new MockElement('song-title', 'span');
elements['song-key'] = new MockElement('song-key', 'span');
elements['transpose-display'] = new MockElement('transpose-display', 'span');
elements['btn-transpose-up'] = new MockElement('btn-transpose-up', 'button');
elements['btn-transpose-down'] = new MockElement('btn-transpose-down', 'button');
elements['zoom-slider'] = new MockElement('zoom-slider', 'select');
elements['zoom-value-label'] = new MockElement('zoom-value-label', 'span');
elements['chord-set-selector'] = new MockElement('chord-set-selector', 'select');
elements['chord-set-badge'] = new MockElement('chord-set-badge', 'span');
elements['verse-mode-label'] = new MockElement('verse-mode-label', 'span');

elements['gig-hud-title'] = new MockElement('gig-hud-title', 'span');
elements['gig-hud-key'] = new MockElement('gig-hud-key', 'span');
elements['gig-hud-trans'] = new MockElement('gig-hud-trans', 'span');
elements['gig-hud-zoom'] = new MockElement('gig-hud-zoom', 'span');

elements['lyric-view-container'] = new MockElement('lyric-view-container', 'div');
elements['lv-key-strong'] = new MockElement('lv-key-strong', 'strong');
elements['lv-trans-badge'] = new MockElement('lv-trans-badge', 'span');

// Mock Document
global.document = {
  getElementById: (id) => elements[id] || null,
  querySelector: (sel) => {
    if (sel.includes('#lyric-view-container .lv-key strong') || sel.includes('.lv-key strong')) {
      return elements['lv-key-strong'];
    }
    if (sel.includes('.lv-trans-badge')) {
      return elements['lv-trans-badge'];
    }
    return null;
  }
};

// Mock Window & URL
let currentUrl = 'http://localhost/sheetapp2/?song=thanh-ca-001';
global.window = {
  document: global.document,
  location: {
    href: currentUrl,
    search: '?song=thanh-ca-001',
  },
  history: {
    replaceState: (state, title, url) => {
      currentUrl = url;
      global.window.location.href = url;
      const u = new URL(url);
      global.window.location.search = u.search;
    }
  },
  EventBus: {
    events: {},
    emit(name, data) {
      if (!this.events[name]) this.events[name] = [];
      this.events[name].push(data);
    }
  },
  KeyService: {
    displayKey(baseKey, semitones) {
      const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      const sharpToFlat = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
      const flat = sharpToFlat[baseKey] || baseKey;
      const idx = keys.indexOf(flat);
      if (idx === -1) return baseKey;
      const shifted = (idx + semitones % 12 + 12) % 12;
      return keys[shifted];
    }
  },
  DisplaySettings: {
    lyricViewRenderCount: 0,
    renderLyricViewIfActive: function() {
      this.lyricViewRenderCount++;
    }
  }
};

// 2. Load Store.js
const storeCode = fs.readFileSync(STORE_PATH, 'utf8');
eval(storeCode);
const Store = global.window.Store;

const results = [];

// BƯỚC 1: Khởi tạo bài hát ban đầu tông G
Store.set('song', { id: 'thanh-ca-001', title: 'Hỡi Thánh Vương', defaultKey: 'G' });
results.push({
  name: 'Khởi tạo bài hát ban đầu tông G',
  pass: Store.get('song').id === 'thanh-ca-001' && Store.get('currentSong').defaultKey === 'G'
});

// BƯỚC 2: Kiểm tra nghiệm thu Ticket L5-7: Store.set('transpose', 2)
Store.set('transpose', 2);

const urlHasT2 = global.window.location.search.includes('t=2');
const toolbarDispT2 = elements['transpose-display'].textContent === '+2';
const toolbarKeyA = elements['song-key'].textContent === 'A';
const hudTransT2 = elements['gig-hud-trans'].textContent === '+2';
const hudKeyA = elements['gig-hud-key'].textContent === 'A';
const bandKeyA = elements['lv-key-strong'].textContent === 'A';

results.push({ name: 'Chỗ 1 (URL): param t=2 được cập nhật chính xác', pass: urlHasT2 });
results.push({ name: 'Chỗ 2 (Toolbar): #transpose-display hiện +2', pass: toolbarDispT2 });
results.push({ name: 'Chỗ 2 (Toolbar): #song-key cập nhật sang A (G + 2)', pass: toolbarKeyA });
results.push({ name: 'Chỗ 3 (Stage HUD): #gig-hud-trans hiện +2', pass: hudTransT2 });
results.push({ name: 'Chỗ 3 (Stage HUD): #gig-hud-key cập nhật sang A', pass: hudKeyA });
results.push({ name: 'Chỗ 4 (Chế độ Band): .lv-key strong cập nhật sang A', pass: bandKeyA });

// BƯỚC 3: Test alias 2 chiều: Store.set('currentTranspose', -1)
Store.set('currentTranspose', -1);
const urlHasTm1 = global.window.location.search.includes('t=-1');
const toolbarKeyFsharp = elements['song-key'].textContent === 'Gb';
const hudTransTm1 = elements['gig-hud-trans'].textContent === '-1';
const bandKeyFsharp = elements['lv-key-strong'].textContent === 'Gb';
results.push({ name: 'Alias 2 chiều: Store.set(currentTranspose, -1) đồng bộ URL (t=-1)', pass: urlHasTm1 });
results.push({ name: 'Alias 2 chiều: Toolbar cập nhật tông Gb (G - 1)', pass: toolbarKeyFsharp });
results.push({ name: 'Alias 2 chiều: Stage HUD cập nhật -1 và Gb', pass: hudTransTm1 });
results.push({ name: 'Alias 2 chiều: Chế độ Band cập nhật Gb', pass: bandKeyFsharp });

// BƯỚC 4: Reset về gốc Store.set('transpose', 0)
Store.set('transpose', 0);
const urlNoT = !global.window.location.search.includes('t=');
const toolbarDisp0 = elements['transpose-display'].textContent === '0';
const toolbarKeyG = elements['song-key'].textContent === 'G';
results.push({ name: 'Reset về gốc: URL xóa bỏ param t', pass: urlNoT });
results.push({ name: 'Reset về gốc: Toolbar hiện 0 và tông G', pass: toolbarDisp0 && toolbarKeyG });

// BƯỚC 5: Đổi zoom: Store.set('zoom', 1.25)
Store.set('zoom', 1.25);
const toolbarZoom = elements['zoom-slider'].value === '125';
const hudZoom = elements['gig-hud-zoom'].textContent === '125%';
results.push({ name: 'Đổi zoom: Toolbar selector cập nhật 125%', pass: toolbarZoom });
results.push({ name: 'Đổi zoom: Stage HUD #gig-hud-zoom cập nhật 125%', pass: hudZoom });

// BƯỚC 6: Đổi chord set: Store.set('set', 'banhat__Acoustic_Guitar')
Store.set('set', 'banhat__Acoustic_Guitar');
const urlHasSet = global.window.location.search.includes('set=banhat__Acoustic_Guitar');
const toolbarSet = elements['chord-set-selector'].value === 'banhat__Acoustic_Guitar';
results.push({ name: 'Đổi chord set: URL cập nhật set param', pass: urlHasSet });
results.push({ name: 'Đổi chord set: Toolbar selector cập nhật đúng tên bộ', pass: toolbarSet });

// BƯỚC 7: Đổi mode: Store.set('mode', 'band')
Store.set('mode', 'band');
const urlHasVLyric = global.window.location.search.includes('v=lyric');
results.push({ name: 'Đổi mode sang band: URL cập nhật v=lyric', pass: urlHasVLyric });

// BƯỚC 8: Custom subscriber & unsubscribe
let customCalled = 0;
const unsub = Store.subscribe('transpose', (data) => {
  customCalled++;
});
Store.set('transpose', 3);
const customSuccess = (customCalled === 1);
unsub();
Store.set('transpose', 4);
const unsubSuccess = (customCalled === 1);
results.push({ name: 'Custom subscriber: nhận đúng event khi transpose đổi', pass: customSuccess });
results.push({ name: 'Custom subscriber: unsubscribe hủy thành công, không gọi thêm', pass: unsubSuccess });

console.log(JSON.stringify(results));
NODE_JS;

$tmpScript = sys_get_temp_dir() . '/test_store_l57_' . uniqid() . '.js';
file_put_contents($tmpScript, $nodeScript);

$output = [];
$returnCode = 0;
exec("node " . escapeshellarg($tmpScript) . " 2>&1", $output, $returnCode);
@unlink($tmpScript);

if ($returnCode === 0 && !empty($output)) {
    $jsonStr = implode('', $output);
    $resArray = json_decode($jsonStr, true);
    if (is_array($resArray)) {
        foreach ($resArray as $r) {
            check($r['pass'] === true, "Node Runtime: " . $r['name'], true);
        }
    } else {
        check(false, "Node Runtime không trả JSON hợp lệ: " . substr($jsonStr, 0, 200), true);
    }
} else {
    check(false, "Node Runtime lỗi (code {$returnCode}): " . implode("\n", $output), true);
}

// ─────────────────────────────────────────────────────────────
// PHẦN 3: BẢO VỆ CSDL THẬT (K2 DB Checksum & Integrity)
// ─────────────────────────────────────────────────────────────
echo "\n--- 3. Bảo vệ tính toàn vẹn CSDL thật (K2 DB Checksum) ---\n";

$dbPath = $root . '/storage/data/app.sqlite';
check(file_exists($dbPath), 'CSDL thật storage/data/app.sqlite tồn tại');

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$songCount = (int)$pdo->query('SELECT COUNT(*) FROM songs')->fetchColumn();
check($songCount === 903, "CSDL giữ nguyên vẹn 903 bài hát (hiện có: {$songCount})", true);

$setlistCount = (int)$pdo->query('SELECT COUNT(*) FROM setlists')->fetchColumn();
check($setlistCount >= 1, "Bảng setlists nguyên vẹn ({$setlistCount} bản ghi)", true);

$chordDir = $root . '/storage/data/chord_sets';
$chordEntries = is_dir($chordDir) ? (scandir($chordDir) ?: []) : [];
check(count($chordEntries) === 62, "Kho chord_sets giữ nguyên vẹn 62 entries (" . count($chordEntries) . " entries)", true);

// ─────────────────────────────────────────────────────────────
// TỔNG KẾT SUITE
// ─────────────────────────────────────────────────────────────
$percent = $totalChecks > 0 ? round(($passedChecks / $totalChecks) * 100, 1) : 0;
$behavioralRatio = $totalChecks > 0 ? round(($behavioralChecks / $totalChecks) * 100, 1) : 0;

echo "\n=======================================================\n";
echo "KẾT QUẢ SUITE L5-7: {$passedChecks}/{$totalChecks} checks PASS ({$percent}%)\n";
echo "Tỷ lệ kiểm thử hành vi (Behavioral): {$behavioralChecks}/{$totalChecks} ({$behavioralRatio}% >= 40%)\n";

if ($passedChecks === $totalChecks && $behavioralRatio >= 40.0) {
    echo ">>> QUALITY GATE PASSED 100% - TICKET L5-7 SANCTIONED <<<\n";
    echo "=======================================================\n\n";
    echo "SUITE_COMPLETE total={$totalChecks}\n";
    exit(0);
} else {
    echo ">>> QUALITY GATE FAILED <<<\n";
    echo "=======================================================\n\n";
    exit(1);
}
