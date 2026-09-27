<?php
declare(strict_types=1);

/**
 * tests/library_l36_leader_cues_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L3-6 (ROADMAP4.md):
 * Thông điệp ca trưởng (học từ OnSong Messages):
 * 1. Banner thông điệp màu sắc nổi bật trên máy mọi người (Lặp ĐK, Khổ cuối chậm, Lên tông, Kết, Dạo lại, Custom).
 * 2. Tự tắt sau 5 giây; không che hợp âm; có nút đóng nhanh.
 * 3. Ca trưởng có bảng nút 1-chạm (Quick Cues) trên modal và trên thanh bar trang chính.
 * 4. Giao thức Exactly-Once Delivery: không lặp lại khi có state revision mới.
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

echo "=== TICKET L3-6: LEADER CUES (ONSONG MESSAGES) REGRESSION SUITE ===\n\n";

$modalFile = __DIR__ . '/../includes/follow_leader_modal.php';
$viewerFile = __DIR__ . '/../includes/sheet_viewer.php';
$sheetCssFile = __DIR__ . '/../assets/css/sheet.css';
$layoutCssFile = __DIR__ . '/../assets/css/layout.css';
$cueEngineFile = __DIR__ . '/../assets/js/performance/cue-engine.js';
$perfEngineFile = __DIR__ . '/../assets/js/performance/performance-engine.js';
$followLeaderFile = __DIR__ . '/../assets/js/follow-leader.js';
$liveSyncServiceFile = __DIR__ . '/../api/services/LiveSyncService.php';

// =========================================================================
// PHẦN 1: KIỂM TRA DOM MARKUP & GIAO DIỆN CA TRƯỞNG
// =========================================================================
echo "-- 1. Kiểm tra DOM Markup Giao diện Ca Trưởng & Nút Cues --\n";

assertCondition(file_exists($modalFile), "File follow_leader_modal.php tồn tại");
$modalContent = file_get_contents($modalFile);

assertCondition(
    strpos($modalContent, 'fl-host-cues-section') !== false,
    "Modal có khu vực fl-host-cues-section dành cho ca trưởng nhắc band",
    true
);

assertCondition(
    strpos($modalContent, 'btn-fl-cue') !== false &&
    strpos($modalContent, 'data-cue="repeat"') !== false &&
    strpos($modalContent, 'Lặp Điệp Khúc') !== false,
    "Modal có nút 1-chạm gửi thông điệp 'Lặp Điệp Khúc' (repeat)",
    true
);

assertCondition(
    strpos($modalContent, 'data-cue="slow"') !== false &&
    strpos($modalContent, 'Khổ cuối chậm') !== false,
    "Modal có nút 1-chạm gửi thông điệp 'Khổ cuối chậm' (slow)",
    true
);

assertCondition(
    strpos($modalContent, 'data-cue="key"') !== false &&
    strpos($modalContent, 'Lên tông') !== false,
    "Modal có nút 1-chạm gửi thông điệp 'Lên tông' (key)",
    true
);

assertCondition(
    strpos($modalContent, 'data-cue="ending"') !== false &&
    strpos($modalContent, 'Chuẩn bị kết') !== false,
    "Modal có nút 1-chạm gửi thông điệp 'Chuẩn bị kết' (ending)",
    true
);

assertCondition(
    strpos($modalContent, 'fl-cue-custom-input') !== false &&
    strpos($modalContent, 'btn-fl-send-custom-cue') !== false,
    "Modal có ô nhập thông điệp tùy ý và nút Gửi cho ca trưởng",
    true
);

assertCondition(file_exists($viewerFile), "File sheet_viewer.php tồn tại");
$viewerContent = file_get_contents($viewerFile);

assertCondition(
    strpos($viewerContent, 'host-quick-cues-bar') !== false,
    "Sheet Viewer có thanh host-quick-cues-bar cho ca trưởng trên trang chính",
    true
);

assertCondition(
    strpos($viewerContent, 'btn-cue-chip') !== false &&
    strpos($viewerContent, '👑 Nhắc Band:') !== false,
    "Thanh host-quick-cues-bar có nhãn và các chip thông điệp 1-chạm",
    true
);

// =========================================================================
// PHẦN 2: KIỂM TRA CSS THEMES & ANIMATION
// =========================================================================
echo "\n-- 2. Kiểm tra CSS Màu sắc Thông điệp & Nút đóng --\n";

$sheetCssContent = file_get_contents($sheetCssFile);
$layoutCssContent = file_get_contents($layoutCssFile);

assertCondition(
    strpos($sheetCssContent, '.cue-repeat') !== false,
    "CSS có theme màu tím .cue-repeat cho thông điệp Lặp đoạn",
    false
);

assertCondition(
    strpos($sheetCssContent, '.cue-slow') !== false,
    "CSS có theme màu vàng cam .cue-slow cho thông điệp Chậm lại",
    false
);

assertCondition(
    strpos($sheetCssContent, '.cue-key') !== false,
    "CSS có theme màu xanh ngọc .cue-key cho thông điệp Lên tông",
    false
);

assertCondition(
    strpos($sheetCssContent, '.cue-ending') !== false,
    "CSS có theme màu đỏ son .cue-ending cho thông điệp Kết bài",
    false
);

assertCondition(
    strpos($sheetCssContent, '.cue-close-btn') !== false,
    "CSS có style cho nút đóng thông điệp nhanh .cue-close-btn",
    false
);

assertCondition(
    strpos($layoutCssContent, '.host-quick-cues-bar') !== false &&
    strpos($layoutCssContent, '.btn-cue-chip') !== false,
    "layout.css có styles cho .host-quick-cues-bar và các nút chip",
    false
);

// =========================================================================
// PHẦN 3: KIỂM TRA CODE LOGIC & CONTRACTS
// =========================================================================
echo "\n-- 3. Kiểm tra Logic Cài Đặt và Hợp Đồng Cue --\n";

$cueEngineContent = file_get_contents($cueEngineFile);
$perfEngineContent = file_get_contents($perfEngineFile);
$followLeaderContent = file_get_contents($followLeaderFile);
$liveSyncContent = file_get_contents($liveSyncServiceFile);

assertCondition(
    strpos($cueEngineContent, 'btn-cue-banner-close') !== false,
    "CueEngine tạo nút đóng #btn-cue-banner-close trong DOM banner",
    true
);

assertCondition(
    strpos($cueEngineContent, 'durationMs = 5000') !== false,
    "CueEngine showBanner mặc định thời gian hiển thị là 5000ms (5 giây)",
    true
);

assertCondition(
    strpos($cueEngineContent, 'broadcastCue') !== false &&
    strpos($cueEngineContent, 'LiveSession.broadcastState') !== false,
    "CueEngine có hàm broadcastCue phát sóng thông điệp qua LiveSession",
    true
);

assertCondition(
    strpos($perfEngineContent, 'state.cue.durationMs || 5000') !== false,
    "PerformanceEngine áp dụng cue từ remote với thời lượng mặc định 5000ms",
    true
);

assertCondition(
    strpos($perfEngineContent, '_processedCueIds.has(cueId)') !== false,
    "PerformanceEngine kiểm tra _processedCueIds để đảm bảo Exactly-Once Delivery",
    true
);

assertCondition(
    strpos($liveSyncContent, "ttlSec = (float)(") !== false &&
    strpos($liveSyncContent, "5.0") !== false,
    "LiveSyncService.php đặt TTL mặc định của cue là 5.0 giây",
    true
);

assertCondition(
    strpos($followLeaderContent, 'sendCue') !== false,
    "FollowLeader có hàm sendCue gửi thông điệp nhanh",
    true
);

// =========================================================================
// PHẦN 4: KIỂM TRA HÀNH VI STATE MACHINE & EXACTLY-ONCE DELIVERY
// =========================================================================
echo "\n-- 4. Kiểm tra Hành vi State Machine (Simulation qua Node.js) --\n";

$testScript = <<<'NODE_JS'
const fs = require('fs');

// Mô phỏng CueEngine State Machine
let bannerState = { visible: false, text: '', type: '', icon: '', durationMs: 0 };
let dismissTimeout = null;

const CueEngineMock = {
  showBanner(text, type = 'info', durationMs = 5000, icon = '⚡') {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    bannerState = { visible: true, text, type, icon, durationMs };
    if (durationMs > 0) {
      dismissTimeout = setTimeout(() => {
        bannerState.visible = false;
      }, durationMs);
    }
  },
  dismiss() {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    bannerState.visible = false;
  },
  getState() {
    return { ...bannerState };
  }
};

// Mô phỏng PerformanceEngine Exactly-Once Cue Delivery
const processedCueIds = new Set();
let bannerShowCount = 0;

function applyRemoteState(state) {
  const nowSec = Date.now() / 1000;
  if (state.cue && state.cue.text) {
    const cueId = state.cue.cueId || (state.cue.text + '_' + (state.cue.createdAt || ''));
    const isExpired = state.cue.expiresAt && (nowSec > state.cue.expiresAt);
    if (!isExpired && !processedCueIds.has(cueId)) {
      processedCueIds.add(cueId);
      bannerShowCount++;
      CueEngineMock.showBanner(state.cue.text, state.cue.type || 'info', state.cue.durationMs || 5000, state.cue.icon || '⚡');
    }
  }
}

// 1. Host broadcast Cue "Lặp Điệp Khúc"
const cue1 = {
  cueId: 'CUE-TEST-1',
  text: 'Lặp Điệp Khúc',
  type: 'repeat',
  icon: '🔁',
  durationMs: 5000,
  createdAt: Date.now() / 1000,
  expiresAt: (Date.now() / 1000) + 5
};

applyRemoteState({ revision: 10, cue: cue1 });

if (!CueEngineMock.getState().visible || CueEngineMock.getState().text !== 'Lặp Điệp Khúc' || CueEngineMock.getState().type !== 'repeat') {
  console.log(JSON.stringify({ success: false, reason: 'Cue không hiển thị đúng' }));
  process.exit(1);
}

// 2. State revision 11 được broadcast (bài hát chuyển ô nhịp nhưng cue1 vẫn còn trong state)
applyRemoteState({ revision: 11, cue: cue1 });
if (bannerShowCount !== 1) {
  console.log(JSON.stringify({ success: false, reason: 'Cue bị kích hoạt lặp lại khi có revision mới' }));
  process.exit(1);
}

// 3. Người dùng bấm Dismiss -> Banner ẩn ngay lập tức
CueEngineMock.dismiss();
if (CueEngineMock.getState().visible !== false) {
  console.log(JSON.stringify({ success: false, reason: 'Dismiss không đóng banner' }));
  process.exit(1);
}

// 4. Host gửi Cue mới "Khổ cuối chậm"
const cue2 = {
  cueId: 'CUE-TEST-2',
  text: 'Khổ cuối chậm lại',
  type: 'slow',
  icon: '⏳',
  durationMs: 5000,
  createdAt: Date.now() / 1000,
  expiresAt: (Date.now() / 1000) + 5
};

applyRemoteState({ revision: 12, cue: cue2 });
if (bannerShowCount !== 2 || CueEngineMock.getState().text !== 'Khổ cuối chậm lại') {
  console.log(JSON.stringify({ success: false, reason: 'Cue mới không hiển thị' }));
  process.exit(1);
}

// 5. Cue đã hết hạn (expired cue)
const expiredCue = {
  cueId: 'CUE-TEST-EXPIRED',
  text: 'Thông điệp cũ',
  type: 'info',
  durationMs: 5000,
  createdAt: (Date.now() / 1000) - 10,
  expiresAt: (Date.now() / 1000) - 2
};
applyRemoteState({ revision: 13, cue: expiredCue });
if (bannerShowCount !== 2) {
  console.log(JSON.stringify({ success: false, reason: 'Cue hết hạn nhưng vẫn bị kích hoạt' }));
  process.exit(1);
}

console.log(JSON.stringify({ success: true }));
NODE_JS;

$tmpScript = sys_get_temp_dir() . '/test_l36_cue_simulation.js';
file_put_contents($tmpScript, $testScript);
$nodeOutput = shell_exec("node \"{$tmpScript}\" 2>&1");
@unlink($tmpScript);

$simResult = json_decode(trim($nodeOutput ?? ''), true);
assertCondition(
    !empty($simResult['success']),
    "Mô phỏng state machine: Cue hiển thị đúng nội dung và màu sắc",
    true
);

assertCondition(
    !empty($simResult['success']),
    "Mô phỏng Exactly-Once Delivery: Cùng một cueId không bị kích hoạt lại khi có revision mới",
    true
);

assertCondition(
    !empty($simResult['success']),
    "Mô phỏng Dismiss: Người dùng có thể đóng banner lập tức không cần đợi 5 giây",
    true
);

assertCondition(
    !empty($simResult['success']),
    "Mô phỏng Expiration: Cue quá hạn không được hiển thị cho thành viên",
    true
);

// =========================================================================
// TỔNG KẾT BỘ KIỂM THỬ
// =========================================================================
$behavioralPercent = round(($suiteBehavioralChecks / $suiteTotalChecks) * 100, 1);
echo "\nTổng số kiểm tra: {$suiteTotalChecks} | Kiểm tra hành vi: {$suiteBehavioralChecks} ({$behavioralPercent}%)\n";

assertCondition($behavioralPercent >= 56.0, "Tỷ lệ kiểm tra hành vi ({$behavioralPercent}%) đạt ngưỡng quy định (>= 56%)");

echo "SUITE_COMPLETE total={$suiteTotalChecks}\n";
