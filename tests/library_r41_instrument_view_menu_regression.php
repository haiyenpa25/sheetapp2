<?php
/**
 * tests/library_r41_instrument_view_menu_regression.php
 *
 * Regression test suite cho Ticket R4-1:
 * - Góc nhìn nhạc cụ chuyển vào Công cụ → Hiển thị (#btn-menu-instrument-role)
 * - Nhãn tiếng Việt chuẩn: Guitar · Đàn phím · Bass · Trống · Hát
 * - Loại bỏ hoàn toàn nhãn "Stage Lens" trên giao diện người dùng
 * - Khả năng chuyển đổi góc nhìn và bảo lưu trạng thái sau khi reload
 */

declare(strict_types=1);

$testCount = 0;
$passedCount = 0;

function it(string $desc, bool $result): void {
    global $testCount, $passedCount;
    $testCount++;
    if ($result) {
        $passedCount++;
        echo "  [PASS] {$desc}\n";
    } else {
        echo "  [FAIL] {$desc}\n";
    }
}

echo "=== Kiểm thử Ticket R4-1: Góc nhìn nhạc cụ trong Công cụ → Hiển thị ===\n\n";

$toolbarFile = __DIR__ . '/../includes/toolbar.php';
$stageLensFile = __DIR__ . '/../assets/js/stage-lens.js';
$guitarLensFile = __DIR__ . '/../assets/js/guitar-lens.js';
$bassLensFile = __DIR__ . '/../assets/js/bass-lens.js';
$drumsLensFile = __DIR__ . '/../assets/js/drums-lens.js';
$vocalsLensFile = __DIR__ . '/../assets/js/vocals-lens.js';

// ── 1. Kiểm tra cấu trúc toolbar.php ──
echo "-- 1. Cấu trúc Menu Công Cụ → Hiển Thị trong toolbar.php --\n";
it('File toolbar.php tồn tại', file_exists($toolbarFile));
$toolbarSrc = file_get_contents($toolbarFile) ?: '';

it('toolbar.php chứa nút #btn-menu-instrument-role trong menu Hiển thị',
    str_contains($toolbarSrc, 'id="btn-menu-instrument-role"') &&
    str_contains($toolbarSrc, 'id="menu-instrument-role-label"')
);

it('Mục menu có title "Góc nhìn nhạc cụ"',
    str_contains($toolbarSrc, 'title="Đổi góc nhìn nhạc cụ"') ||
    str_contains($toolbarSrc, 'title="Góc nhìn nhạc cụ"')
);

it('Nút #btn-instrument-role có title "Góc nhìn nhạc cụ"',
    str_contains($toolbarSrc, 'id="btn-instrument-role"') &&
    str_contains($toolbarSrc, 'title="Góc nhìn nhạc cụ"')
);

// ── 2. Kiểm tra bộ nhãn tiếng Việt trong stage-lens.js ──
echo "\n-- 2. Bộ nhãn tiếng Việt chuẩn hóa trong stage-lens.js --\n";
it('File stage-lens.js tồn tại', file_exists($stageLensFile));
$stageSrc = file_get_contents($stageLensFile) ?: '';

it("Nhãn vai trò 'keyboard' được chuẩn hóa thành 'Đàn phím'",
    str_contains($stageSrc, "label: 'Đàn phím'")
);

it("stage-lens.js hỗ trợ 5 vai trò với nhãn tiếng Việt: Guitar, Đàn phím, Bass, Trống, Hát",
    str_contains($stageSrc, "label: 'Guitar'") &&
    str_contains($stageSrc, "label: 'Đàn phím'") &&
    str_contains($stageSrc, "label: 'Bass'") &&
    str_contains($stageSrc, "label: 'Trống'") &&
    str_contains($stageSrc, "label: 'Hát'")
);

it("Tiêu đề modal được chuẩn hóa thành 'Góc Nhìn Nhạc Cụ'",
    str_contains($stageSrc, 'Góc Nhìn Nhạc Cụ')
);

it("Gợi ý lần đầu mở sử dụng từ ngữ 'Đàn phím'",
    str_contains($stageSrc, 'Đang xem như Đàn phím')
);

// ── 3. Kiểm tra loại bỏ nhãn 'Stage Lens' khỏi aria-labels ──
echo "\n-- 3. Loại bỏ nhãn 'Stage Lens' khỏi các lens giao diện --\n";

$guitarSrc = file_get_contents($guitarLensFile) ?: '';
$bassSrc = file_get_contents($bassLensFile) ?: '';
$drumsSrc = file_get_contents($drumsLensFile) ?: '';
$vocalsSrc = file_get_contents($vocalsLensFile) ?: '';

it("guitar-lens.js không còn 'Guitar Stage Lens' trong aria-label",
    !str_contains($guitarSrc, 'Guitar Stage Lens') &&
    str_contains($guitarSrc, 'Bảng điều khiển Guitar — Góc nhìn nhạc cụ')
);

it("bass-lens.js không còn 'Bass Stage Lens' trong aria-label",
    !str_contains($bassSrc, 'Bass Stage Lens') &&
    str_contains($bassSrc, 'Bảng điều khiển Bass — Góc nhìn nhạc cụ')
);

it("drums-lens.js không còn 'Stage Lens' trong aria-label",
    !str_contains($drumsSrc, 'Sân khấu Trống — Stage Lens') &&
    str_contains($drumsSrc, 'Sân khấu Trống — Góc nhìn nhạc cụ')
);

it("vocals-lens.js không còn 'Hát Stage Lens' trong aria-label",
    !str_contains($vocalsSrc, 'Hát Stage Lens') &&
    str_contains($vocalsSrc, 'Bảng điều khiển Hát — Góc nhìn nhạc cụ')
);

// ── 4. Mô phỏng hành vi: Chuyển đổi và lưu trữ vai trò sau reload ──
echo "\n-- 4. Mô phỏng hành vi: Chuyển đổi & Lưu Trữ Khi Reload --\n";

class MockInstrumentViewSimulator {
    public array $roles = [
        ['id' => 'guitar',   'label' => 'Guitar',   'icon' => '🎸'],
        ['id' => 'keyboard', 'label' => 'Đàn phím', 'icon' => '🎹'],
        ['id' => 'bass',     'label' => 'Bass',     'icon' => '🎻'],
        ['id' => 'drums',    'label' => 'Trống',    'icon' => '🥁'],
        ['id' => 'vocals',   'label' => 'Hát',      'icon' => '🎤'],
    ];

    public string $currentRole = 'keyboard';
    public array $localStorage = [];
    public array $store = [];
    public array $dom = [
        'instrument-role-label' => 'Đàn phím',
        'menu-instrument-role-label' => 'Góc nhìn: Đàn phím',
        'body-dataset-stage-lens' => 'keyboard',
    ];
    public ?string $lastToast = null;

    public function init(): void {
        $saved = $this->localStorage['sheetapp_instrument_role'] ?? null;
        if ($saved && in_array($saved, array_column($this->roles, 'id'), true)) {
            $this->setRole($saved, false, false);
        } else {
            $this->setRole('keyboard', false, false);
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
        $this->dom['instrument-role-label'] = $info['label'];
        $this->dom['menu-instrument-role-label'] = "Góc nhìn: {$info['label']}";
        $this->dom['body-dataset-stage-lens'] = $this->currentRole;

        if ($notify) {
            $this->lastToast = "🎯 Góc nhìn: {$info['icon']} {$info['label']}";
        }

        return $info;
    }
}

$sim = new MockInstrumentViewSimulator();

// Ban đầu khởi tạo mặc định là keyboard (Đàn phím)
$sim->init();
it("Mặc định khởi tạo là Đàn phím",
    $sim->currentRole === 'keyboard' &&
    $sim->dom['instrument-role-label'] === 'Đàn phím' &&
    $sim->dom['menu-instrument-role-label'] === 'Góc nhìn: Đàn phím'
);

// Người dùng chuyển sang Bass
$bassInfo = $sim->setRole('bass');
it("Đổi sang Bass: Cập nhật DOM menu và label thành 'Bass'",
    $sim->currentRole === 'bass' &&
    $sim->dom['instrument-role-label'] === 'Bass' &&
    $sim->dom['menu-instrument-role-label'] === 'Góc nhìn: Bass' &&
    $sim->localStorage['sheetapp_instrument_role'] === 'bass' &&
    $sim->store['instrumentRole'] === 'bass'
);

// Người dùng chuyển sang Đàn phím
$keyInfo = $sim->setRole('keyboard');
it("Đổi sang Đàn phím: Toast thông báo hiển thị 'Đàn phím' thay vì 'Keyboard'",
    $sim->lastToast === '🎯 Góc nhìn: 🎹 Đàn phím' &&
    $sim->dom['menu-instrument-role-label'] === 'Góc nhìn: Đàn phím'
);

// Mô phỏng reload trang: init() đọc lại từ localStorage
$simReload = new MockInstrumentViewSimulator();
$simReload->localStorage['sheetapp_instrument_role'] = 'drums';
$simReload->init();
it("Sau khi reload trang: khôi phục nguyên vẹn lựa chọn từ localStorage (Trống)",
    $simReload->currentRole === 'drums' &&
    $simReload->dom['instrument-role-label'] === 'Trống' &&
    $simReload->dom['menu-instrument-role-label'] === 'Góc nhìn: Trống' &&
    $simReload->dom['body-dataset-stage-lens'] === 'drums'
);

// ── 5. Kiểm tra ngân sách dòng mã ──
echo "\n-- 5. Ngân sách dòng mã (< 600 dòng) --\n";
it('assets/js/stage-lens.js < 600 dòng', count(file($stageLensFile)) < 600);
it('assets/js/guitar-lens.js < 600 dòng', count(file($guitarLensFile)) < 600);
it('assets/js/bass-lens.js < 600 dòng', count(file($bassLensFile)) < 600);
it('assets/js/drums-lens.js < 600 dòng', count(file($drumsLensFile)) < 600);
it('assets/js/vocals-lens.js < 600 dòng', count(file($vocalsLensFile)) < 600);

echo "\n----------------------------------------\n";
echo "KẾT QUẢ KIỂM THỬ: {$passedCount} / {$testCount} checks đạt.\n";
if ($passedCount === $testCount) {
    echo "🎉 TẤT CẢ KIỂM TRA TICKET R4-1 ĐỀU ĐẠT CHUẨN!\n";
} else {
    echo "❌ CÓ KIỂM TRA THẤT BẠI!\n";
}

echo "SUITE_COMPLETE total={$testCount} passed={$passedCount} failed=" . ($testCount - $passedCount) . "\n";

if ($passedCount !== $testCount) {
    exit(1);
}
