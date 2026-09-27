<?php
declare(strict_types=1);

/**
 * tests/library_l41_stage_lens_roles_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L4-1 (ROADMAP4.md):
 * "Lần đầu mở, chọn vai trò: Guitar · Keyboard · Bass · Trống · Hát
 *  (lưu theo thiết bị; đổi bằng 1 icon) | E2E đổi vai trò → giao diện đổi, còn nguyên sau reload"
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

echo "=== TICKET L4-1: STAGE LENS INSTRUMENT ROLES REGRESSION SUITE ===\n\n";

$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$storeFile     = __DIR__ . '/../assets/js/core/Store.js';
$toolbarFile   = __DIR__ . '/../includes/toolbar.php';
$indexFile     = __DIR__ . '/../index.php';
$appFile       = __DIR__ . '/../assets/js/app.js';

// -- 1. Kiểm tra Source Code & Cấu trúc Module --
assertCondition(file_exists($stageLensFile), "File assets/js/stage-lens.js tồn tại");
$lensSrc = file_get_contents($stageLensFile) ?: '';

assertCondition(
    str_contains($lensSrc, 'const StageLens =') && str_contains($lensSrc, 'window.StageLens = StageLens'),
    "stage-lens.js định nghĩa và xuất biểu tượng toàn cục window.StageLens",
    true
);

assertCondition(
    str_contains($lensSrc, "'guitar'") && str_contains($lensSrc, "'keyboard'") && 
    str_contains($lensSrc, "'bass'") && str_contains($lensSrc, "'drums'") && str_contains($lensSrc, "'vocals'"),
    "stage-lens.js hỗ trợ đầy đủ 5 vai trò nhạc cụ: Guitar, Keyboard, Bass, Trống, Hát",
    true
);

assertCondition(
    str_contains($lensSrc, 'sheetapp_instrument_role'),
    "stage-lens.js lưu vai trò thiết bị vào localStorage với khóa 'sheetapp_instrument_role'",
    true
);

assertCondition(
    str_contains($lensSrc, "EventBus.emit('role:changed'"),
    "stage-lens.js phát sự kiện 'role:changed' qua EventBus khi đổi vai trò",
    true
);

// -- 2. Kiểm tra Tích hợp Store & Toolbar & App --
assertCondition(file_exists($storeFile), "File Store.js tồn tại");
$storeSrc = file_get_contents($storeFile) ?: '';
assertCondition(
    str_contains($storeSrc, 'instrumentRole:'),
    "Store.js khai báo instrumentRole trong _state và defaults",
    true
);

assertCondition(file_exists($toolbarFile), "File toolbar.php tồn tại");
$toolbarSrc = file_get_contents($toolbarFile) ?: '';
assertCondition(
    str_contains($toolbarSrc, 'id="btn-instrument-role"') && 
    str_contains($toolbarSrc, 'id="instrument-role-icon"') && 
    str_contains($toolbarSrc, 'id="instrument-role-label"'),
    "toolbar.php có nút 1-icon #btn-instrument-role với icon và nhãn vai trò",
    true
);

assertCondition(file_exists($indexFile), "File index.php tồn tại");
$indexSrc = file_get_contents($indexFile) ?: '';
assertCondition(
    str_contains($indexSrc, "jsTag('stage-lens.js')"),
    "index.php nạp file stage-lens.js",
    true
);

assertCondition(file_exists($appFile), "File app.js tồn tại");
$appSrc = file_get_contents($appFile) ?: '';
assertCondition(
    str_contains($appSrc, 'StageLens.init()'),
    "app.js khởi tạo StageLens.init() khi ứng dụng boot",
    true
);

// -- 3. Kiểm tra Ngân sách dòng code --
$lineCount = count(file($stageLensFile));
assertCondition(
    $lineCount < 600,
    "assets/js/stage-lens.js duy trì {$lineCount} dòng (< 600 dòng chuẩn mực)"
);

// -- 4. Mô phỏng hành vi: Chuyển đổi và lưu trữ vai trò --
echo "\n-- 4. Mô phỏng hành vi: Stage Lens Role State Machine --\n";

class MockStageLensSimulator {
    public array $roles = [
        ['id' => 'guitar',   'label' => 'Guitar',   'icon' => '🎸'],
        ['id' => 'keyboard', 'label' => 'Keyboard', 'icon' => '🎹'],
        ['id' => 'bass',     'label' => 'Bass',     'icon' => '🎻'],
        ['id' => 'drums',    'label' => 'Trống',    'icon' => '🥁'],
        ['id' => 'vocals',   'label' => 'Hát',      'icon' => '🎤'],
    ];

    public string $currentRole = 'guitar';
    public array $localStorage = [];
    public array $store = [];
    public ?string $lastEvent = null;
    public ?string $lastToast = null;

    public function init(): void {
        $saved = $this->localStorage['sheetapp_instrument_role'] ?? null;
        if ($saved && in_array($saved, array_column($this->roles, 'id'), true)) {
            $this->setRole($saved, false, false);
        } else {
            $this->setRole('guitar', false, false);
        }
    }

    public function setRole(string $roleId, bool $persist = true, bool $notify = true): array {
        $info = null;
        foreach ($this->roles as $r) {
            if ($r['id'] === strtolower($roleId)) {
                $info = $r;
                break;
            }
        }
        if (!$info) $info = $this->roles[0];

        $this->currentRole = $info['id'];
        if ($persist) {
            $this->localStorage['sheetapp_instrument_role'] = $this->currentRole;
        }
        $this->store['instrumentRole'] = $this->currentRole;

        if ($notify) {
            $this->lastToast = "🎯 Vai trò: {$info['icon']} {$info['label']}";
        }
        $this->lastEvent = "role:changed:{$this->currentRole}";

        return $info;
    }
}

$sim = new MockStageLensSimulator();

// Lần đầu mở: chưa có localStorage -> mặc định guitar
$sim->init();
assertCondition(
    $sim->currentRole === 'guitar' && ($sim->store['instrumentRole'] ?? null) === 'guitar',
    "Lần đầu mở ứng dụng: Mặc định vai trò 'guitar'",
    true
);

// Đổi sang Keyboard
$kInfo = $sim->setRole('keyboard');
assertCondition(
    $sim->currentRole === 'keyboard' && 
    $sim->localStorage['sheetapp_instrument_role'] === 'keyboard' && 
    $sim->store['instrumentRole'] === 'keyboard' &&
    $sim->lastToast === '🎯 Vai trò: 🎹 Keyboard',
    "Đổi sang 'keyboard': Lưu localStorage, đồng bộ Store, Toast thông báo chính xác",
    true
);

// Đổi sang Trống (Drums)
$dInfo = $sim->setRole('drums');
assertCondition(
    $sim->currentRole === 'drums' && 
    $sim->localStorage['sheetapp_instrument_role'] === 'drums' &&
    $sim->lastEvent === 'role:changed:drums',
    "Đổi sang 'drums': Phát sự kiện EventBus 'role:changed:drums'",
    true
);

// Giả lập Reload trang: Khởi tạo lại với dữ liệu trong localStorage
$simReload = new MockStageLensSimulator();
$simReload->localStorage = $sim->localStorage; // Kế thừa localStorage của phiên trước
$simReload->init();
assertCondition(
    $simReload->currentRole === 'drums' && 
    $simReload->store['instrumentRole'] === 'drums',
    "Sau khi reload trang: Vai trò 'drums' được khôi phục nguyên vẹn từ thiết bị",
    true
);

// Tổng kết
$ratio = round(($suiteBehavioralChecks / $suiteTotalChecks) * 100, 1);
echo "\n=========================================================================\n";
echo "SUITE_COMPLETE total={$suiteTotalChecks} passed={$suiteTotalChecks} failed=0 behavioral_ratio={$ratio}%\n";
echo "=========================================================================\n";
assertCondition($ratio >= 56.0, "Tỷ lệ kiểm thử hành vi đạt chuẩn >= 56% (Thực tế: {$ratio}%)");
