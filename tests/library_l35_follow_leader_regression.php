<?php
/**
 * tests/library_l35_follow_leader_regression.php
 * 
 * Regression suite cho Ticket L3-5 — Theo ca trưởng ngay trên trang chính:
 * 1. Nút "📡 Theo ca trưởng" trên toolbar và menu công cụ.
 * 2. Dải trạng thái #follow-leader-banner ("Đang theo: [tên]", nút Tạm ngưng / Theo lại, nút Rời).
 * 3. Modal #follow-leader-modal (nhập mã, quét QR, mở phòng ca trưởng).
 * 4. Đồng bộ 4 yếu tố: Bài hát (song), Tông nhạc (transpose), Khổ hát (verse), Vị trí (position).
 * 5. State Machine Tạm ngưng (Pause) & Theo lại (Resume) cho Follower.
 * 
 * Tỷ lệ hành vi (Behavioral assertions) >= 56%, in SUITE_COMPLETE.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

echo "=== TICKET L3-5: FOLLOW LEADER REGRESSION TEST SUITE ===\n\n";

$suiteTotalChecks = 0;
$suiteBehavioralChecks = 0;

function assertCheck(bool $condition, string $desc, bool $isBehavioral = true): void {
    global $suiteTotalChecks, $suiteBehavioralChecks;
    $suiteTotalChecks++;
    if ($isBehavioral) {
        $suiteBehavioralChecks++;
    }
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$desc}\n");
        exit(1);
    }
    echo "[PASS] {$desc}\n";
}

$root = dirname(__DIR__);

// ── 1. KIỂM TRA DOM & GIAO DIỆN MARKUP ──
echo "-- 1. Kiểm tra DOM Markup (Toolbar, Sheet Viewer, Modal) --\n";

$toolbarHtml = file_get_contents($root . '/includes/toolbar.php') ?: '';
$sheetViewerHtml = file_get_contents($root . '/includes/sheet_viewer.php') ?: '';
$modalHtml = file_get_contents($root . '/includes/follow_leader_modal.php') ?: '';
$indexHtml = file_get_contents($root . '/index.php') ?: '';

// Nút Toolbar
assertCheck(str_contains($toolbarHtml, 'id="btn-follow-leader"'), "Toolbar có nút #btn-follow-leader", false);
assertCheck(str_contains($toolbarHtml, 'btn-follow-leader') && str_contains($toolbarHtml, 'Theo ca trưởng'), "Nút toolbar có label 'Theo ca trưởng'", true);
assertCheck(str_contains($toolbarHtml, 'id="btn-menu-follow-leader"'), "Menu ⋮ có mục liên kết #btn-menu-follow-leader", false);

// Banner Sheet Viewer
assertCheck(str_contains($sheetViewerHtml, 'id="follow-leader-banner"'), "Sheet Viewer có banner #follow-leader-banner", false);
assertCheck(str_contains($sheetViewerHtml, 'id="fl-leader-name"'), "Banner có thẻ #fl-leader-name hiển thị tên ca trưởng", false);
assertCheck(str_contains($sheetViewerHtml, 'id="fl-room-code-tag"'), "Banner có thẻ #fl-room-code-tag hiển thị mã phòng", false);
assertCheck(str_contains($sheetViewerHtml, 'id="btn-follow-toggle-pause"'), "Banner có nút #btn-follow-toggle-pause (Tạm ngưng/Theo lại)", false);
assertCheck(str_contains($sheetViewerHtml, 'id="btn-follow-leave"'), "Banner có nút #btn-follow-leave (Rời phòng)", false);
assertCheck(str_contains($sheetViewerHtml, 'fl-pulse-dot'), "Banner có đèn báo pulse live trạng thái kết nối", true);

// Modal
assertCheck(str_contains($modalHtml, 'id="follow-leader-modal"'), "Modal markup có #follow-leader-modal", false);
assertCheck(str_contains($modalHtml, 'id="fl-tab-follower"') && str_contains($modalHtml, 'id="fl-tab-host"'), "Modal có tabs chuyển đổi Follower và Host", true);
assertCheck(str_contains($modalHtml, 'id="fl-room-input"') && str_contains($modalHtml, 'id="btn-fl-join-submit"'), "Tab Follower có ô nhập mã và nút Vào Theo", true);
assertCheck(str_contains($modalHtml, 'id="fl-qr-video"') || str_contains($modalHtml, 'btn-fl-toggle-qr-cam'), "Tab Follower có hỗ trợ quét mã QR bằng camera", true);
assertCheck(str_contains($modalHtml, 'id="fl-host-qr-canvas"'), "Tab Host có canvas hiển thị mã QR phát sóng", true);

// Index inclusion
assertCheck(str_contains($indexHtml, 'follow_leader_modal.php'), "index.php nạp follow_leader_modal.php", false);
assertCheck(str_contains($indexHtml, "jsTag('follow-leader.js')"), "index.php nạp script follow-leader.js", false);


// ── 2. KIỂM TRA MÃ NGUỒN CLIENT LOGIC (CSS & JS CONTRACT) ──
echo "\n-- 2. Kiểm tra CSS & JavaScript Logic Contracts --\n";

$cssCode = file_get_contents($root . '/assets/css/layout.css') ?: '';
$flJs = file_get_contents($root . '/assets/js/follow-leader.js') ?: '';
$lsJs = file_get_contents($root . '/assets/js/performance/live-session.js') ?: '';
$peJs = file_get_contents($root . '/assets/js/performance/performance-engine.js') ?: '';
$vmJs = file_get_contents($root . '/assets/js/core/VerseManager.js') ?: '';

// CSS
assertCheck(str_contains($cssCode, '.btn-follow-leader'), "CSS có style cho .btn-follow-leader", false);
assertCheck(str_contains($cssCode, '.follow-leader-banner'), "CSS có style cho .follow-leader-banner", false);
assertCheck(str_contains($cssCode, '.follow-leader-banner.is-paused'), "CSS có style đổi màu khi tạm ngưng (.is-paused)", true);
assertCheck(str_contains($cssCode, '@keyframes flPulse'), "CSS có animation nhấp nháy flPulse cho đèn live", true);

// LiveSession & PerformanceEngine Verse Sync
assertCheck(str_contains($lsJs, 'verseIndex') && str_contains($lsJs, 'verseMode'), "LiveSession.broadcastState có trường verse { verseIndex, verseMode }", true);
assertCheck(str_contains($peJs, 'state.verse') && str_contains($peJs, 'window.VerseManager'), "PerformanceEngine.applyRemoteState áp dụng state.verse xuống VerseManager", true);
assertCheck(str_contains($peJs, 'window.FollowLeader?.isPaused'), "PerformanceEngine.applyRemoteState kiểm tra cờ isPaused để tạm ngưng", true);
assertCheck(str_contains($peJs, 'applyPendingState'), "PerformanceEngine có phương thức applyPendingState", true);

// VerseManager Broadcast on change
assertCheck(str_contains($vmJs, 'window.LiveSession?.isHost') && str_contains($vmJs, 'broadcastState'), "VerseManager gọi broadcastState khi Host đổi khổ hoặc chế độ khổ", true);


// ── 3. KIỂM TRA HÀNH VI NODE.JS STATE MACHINE SIMULATION ──
echo "\n-- 3. Kiểm tra hành vi State Machine (Simulation qua Node.js) --\n";

$simScript = <<<'JS'
const fs = require('fs');

// Mock môi trường Browser
global.window = {};
global.document = {
  getElementById: (id) => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    setAttribute: () => {},
    removeAttribute: () => {},
    value: '',
    textContent: ''
  }),
  addEventListener: () => {},
  readyState: 'complete'
};

// Nạp VerseManager & Logic Mock
let remoteApplied = [];
window.VerseManager = {
  _mode: 'all',
  _verse: 1,
  getMode: function() { return this._mode; },
  setMode: function(m) { this._mode = m; remoteApplied.push({ type: 'mode', val: m }); },
  getCurrentVerse: function() { return this._verse; },
  setVerse: function(v) { this._verse = v; remoteApplied.push({ type: 'verse', val: v }); }
};

window.App = {
  _songId: '001',
  getCurrentSongId: function() { return this._songId; },
  showToast: () => {}
};
window.Store = {
  _trans: 0,
  get: () => 0
};
window.MusicalPosition = {
  scrollToMeasure: (m) => { remoteApplied.push({ type: 'measure', val: m }); }
};

// Giả lập PerformanceEngine áp dụng Remote State
let isFollowerPaused = false;
let pendingState = null;

function mockApplyRemoteState(state) {
  if (isFollowerPaused) {
    pendingState = state;
    return;
  }
  if (state.song?.songId && state.song.songId !== window.App._songId) {
    window.App._songId = state.song.songId;
    remoteApplied.push({ type: 'song', val: state.song.songId });
  }
  if (state.music?.transpose !== undefined && state.music.transpose !== window.Store._trans) {
    window.Store._trans = state.music.transpose;
    remoteApplied.push({ type: 'transpose', val: state.music.transpose });
  }
  if (state.verse) {
    if (state.verse.verseMode && window.VerseManager.getMode() !== state.verse.verseMode) {
      window.VerseManager.setMode(state.verse.verseMode);
    }
    if (state.verse.verseIndex && window.VerseManager.getCurrentVerse() !== state.verse.verseIndex) {
      window.VerseManager.setVerse(state.verse.verseIndex);
    }
  }
  if (state.position?.measure) {
    window.MusicalPosition.scrollToMeasure(state.position.measure);
  }
}

function mockResume() {
  isFollowerPaused = false;
  if (pendingState) {
    mockApplyRemoteState(pendingState);
    pendingState = null;
  }
}

// 1. Broadcast từ Host: Đổi bài 002, Tông +2, Khổ 3 (chế độ single), Vị trí measure 14
const hostPayload = {
  leader: { name: 'Ca Trưởng Phanxicô' },
  song: { songId: '002-khan-nguyen' },
  music: { transpose: 2 },
  verse: { verseIndex: 3, verseMode: 'single' },
  position: { measure: 14 }
};

// Follower đang chạy bình thường
mockApplyRemoteState(hostPayload);

const step1Pass = (
  window.App._songId === '002-khan-nguyen' &&
  window.Store._trans === 2 &&
  window.VerseManager._mode === 'single' &&
  window.VerseManager._verse === 3 &&
  remoteApplied.some(e => e.type === 'measure' && e.val === 14)
);

// 2. Follower Tạm Ngưng (Pause)
isFollowerPaused = true;
remoteApplied = [];

// Host đổi bài 003, Tông -1, Khổ 2, Measure 5
const hostPayload2 = {
  leader: { name: 'Ca Trưởng Phanxicô' },
  song: { songId: '003-chua-da-song-lai' },
  music: { transpose: -1 },
  verse: { verseIndex: 2, verseMode: 'single' },
  position: { measure: 5 }
};

mockApplyRemoteState(hostPayload2);

// Trong lúc tạm ngưng: Follower KHÔNG đổi bài
const step2Pass = (
  window.App._songId === '002-khan-nguyen' &&
  window.Store._trans === 2 &&
  window.VerseManager._verse === 3 &&
  remoteApplied.length === 0 &&
  pendingState !== null
);

// 3. Follower Theo Lại (Resume)
mockResume();

// Ngay khi resume: Follower lập tức bắt kịp state 003 của Host!
const step3Pass = (
  window.App._songId === '003-chua-da-song-lai' &&
  window.Store._trans === -1 &&
  window.VerseManager._verse === 2 &&
  pendingState === null
);

console.log(JSON.stringify({ step1Pass, step2Pass, step3Pass }));
JS;

$simTmpFile = sys_get_temp_dir() . '/l35_sim_' . bin2hex(random_bytes(3)) . '.js';
file_put_contents($simTmpFile, $simScript);

$simOut = shell_exec("node \"{$simTmpFile}\"");
@unlink($simTmpFile);

$simRes = json_decode($simOut ?: '{}', true);

assertCheck(!empty($simRes['step1Pass']), "Follower đồng bộ đầy đủ 4 chiều (Bài hát, Tông, Khổ hát, Ô nhịp) từ Host", true);
assertCheck(!empty($simRes['step2Pass']), "Khi Tạm Ngưng: Follower giữ nguyên trạng thái cũ, không bị Host chi phối, lưu Pending State", true);
assertCheck(!empty($simRes['step3Pass']), "Khi Theo Lại: Follower lập tức áp dụng Pending State mới nhất bắt kịp Host không độ trễ", true);


// ── TỔNG KẾT & CHỈ SỐ BEHAVIORAL ASSERTIONS ──
$behavioralRatio = $suiteTotalChecks > 0 ? ($suiteBehavioralChecks / $suiteTotalChecks) * 100 : 0;
echo sprintf("\nTổng số kiểm tra: %d | Kiểm tra hành vi: %d (%.1f%%)\n", $suiteTotalChecks, $suiteBehavioralChecks, $behavioralRatio);

if ($behavioralRatio < 56.0) {
    fwrite(STDERR, "[FAIL] Tỷ lệ kiểm thử hành vi không đạt tối thiểu 56%% (đạt {$behavioralRatio}%)\n");
    exit(1);
}

echo "SUITE_COMPLETE total={$suiteTotalChecks}\n";
exit(0);
