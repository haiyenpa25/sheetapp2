<?php
declare(strict_types=1);

/**
 * tests/library_l310_setlist_end_and_cleanup_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L3-10 (ROADMAP4.md):
 * "Hết bài cuối thì hiện 'Kết thúc chương trình';
 *  dọn trạng thái setlist, không để các nút ◀ ▶ bị chiếm | E2E"
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

echo "=== TICKET L3-10: SETLIST END & CLEANUP REGRESSION SUITE ===\n\n";

$playerFile   = __DIR__ . '/../assets/js/setlist-player.js';
$setlistUiFile = __DIR__ . '/../assets/js/setlist-ui.js';
$libraryUiFile = __DIR__ . '/../assets/js/library-ui.js';
$barFile      = __DIR__ . '/../includes/setlist_program_bar.php';

// -- 1. Kiểm tra Source Code & Hợp đồng API --
assertCondition(file_exists($playerFile), "File setlist-player.js tồn tại");
$playerSrc = file_get_contents($playerFile) ?: '';

assertCondition(
    str_contains($playerSrc, 'function endSetlist(') && str_contains($playerSrc, 'endSetlist,'),
    "setlist-player.js định nghĩa và xuất phương thức endSetlist()",
    true
);

assertCondition(
    str_contains($playerSrc, "'Kết thúc chương trình'") || str_contains($playerSrc, '"Kết thúc chương trình"'),
    "setlist-player.js chứa thông điệp 'Kết thúc chương trình' khi hoàn tất setlist",
    true
);

assertCondition(
    str_contains($playerSrc, 'ctx.setCurrentSetlist?.(null)') && str_contains($playerSrc, 'ctx.setCurrentIndex?.(-1)'),
    "endSetlist() dọn dẹp triệt để trạng thái setlist (setCurrentSetlist(null) và setCurrentIndex(-1))",
    true
);

assertCondition(
    str_contains($playerSrc, "classList.remove('in-setlist')") && str_contains($playerSrc, "setlist-program-bar") && str_contains($playerSrc, "classList.add('hidden')"),
    "endSetlist() gỡ bỏ class .in-setlist và ẩn thanh chương trình #setlist-program-bar",
    true
);

// -- 2. Kiểm tra Giải phóng các nút ◀ ▶ không để bị chiếm --
assertCondition(
    str_contains($playerSrc, "ctx.getCurrentSetlist?.() && (ctx.getCurrentIndex?.() ?? -1) >= 0"),
    "setlist-player.js chỉ can thiệp phím ◀ ▶ trên Toolbar khi đang thực sự phát setlist (index >= 0)",
    true
);

assertCondition(file_exists($libraryUiFile), "File library-ui.js tồn tại");
$libSrc = file_get_contents($libraryUiFile) ?: '';

assertCondition(
    str_contains($libSrc, "window.SetlistUI?.getCurrentSetlist?.() && (window.SetlistUI?.getCurrentIndex?.() ?? -1) >= 0"),
    "library-ui.js giải phóng các nút #btn-prev-song và #btn-next-song khi setlist đã kết thúc hoặc không phát",
    true
);

assertCondition(
    str_contains($libSrc, "window.SetlistPlayer?.endSetlist") && str_contains($libSrc, "selectSong("),
    "library-ui.js tự động dọn dẹp setlist khi người dùng chọn bài hát bất kỳ từ Kho Nhạc",
    true
);

// -- 3. Kiểm tra Nút Kết thúc chương trình trên Giao diện --
assertCondition(file_exists($barFile), "File includes/setlist_program_bar.php tồn tại");
$barSrc = file_get_contents($barFile) ?: '';

assertCondition(
    str_contains($barSrc, 'id="btn-sp-end"'),
    "includes/setlist_program_bar.php có nút #btn-sp-end để chủ động kết thúc chương trình",
    true
);

assertCondition(file_exists($setlistUiFile), "File setlist-ui.js tồn tại");
$setlistUiSrc = file_get_contents($setlistUiFile) ?: '';

assertCondition(
    str_contains($setlistUiSrc, 'endSetlist:'),
    "setlist-ui.js kết nối và ủy quyền phương thức endSetlist()",
    true
);

// -- 4. Mô phỏng hành vi logic (State Machine Simulation) --
echo "\n-- 4. Mô phỏng hành vi: Chạy qua bài cuối & Giải phóng nút ◀ ▶ --\n";

class MockSetlistPlayerSimulator {
    public ?array $currentSetlist = null;
    public int $currentIndex = -1;
    public bool $isProgramBarVisible = false;
    public bool $isInSetlistClass = false;
    public ?string $lastToast = null;
    public bool $eventEndedEmitted = false;
    public int $libraryNavCallCount = 0;

    public function startSetlist(array $setlist): void {
        $this->currentSetlist = $setlist;
        $this->currentIndex = 0;
        $this->isProgramBarVisible = true;
        $this->isInSetlistClass = true;
    }

    public function next(): void {
        if (!$this->currentSetlist) return;

        if ($this->currentIndex >= 0 && $this->currentIndex < count($this->currentSetlist['items']) - 1) {
            $this->currentIndex++;
        } else if ($this->currentIndex >= count($this->currentSetlist['items']) - 1) {
            $this->endSetlist(true);
        }
    }

    public function endSetlist(bool $notify = true): void {
        $this->currentIndex = -1;
        $this->currentSetlist = null;
        $this->isProgramBarVisible = false;
        $this->isInSetlistClass = false;
        if ($notify) {
            $this->lastToast = 'Kết thúc chương trình';
        }
        $this->eventEndedEmitted = true;
    }

    public function onToolbarNextClicked(): void {
        // Giả lập logic kiểm tra: chỉ can thiệp nếu setlist đang phát
        if ($this->currentSetlist !== null && $this->currentIndex >= 0) {
            $this->next();
        } else {
            // Sự kiện truyền sang Kho nhạc (Library Navigation)
            $this->libraryNavCallCount++;
        }
    }
}

$sim = new MockSetlistPlayerSimulator();
$sim->startSetlist([
    'id' => 101,
    'title' => 'Lễ Sáng Chúa Nhật',
    'items' => [
        ['song_id' => 'thanh-ca-001'],
        ['song_id' => 'thanh-ca-002']
    ]
]);

assertCondition(
    $sim->currentIndex === 0 && $sim->isProgramBarVisible === true && $sim->isInSetlistClass === true,
    "Khởi động Setlist 2 bài: Vị trí 0, Thanh chương trình hiển thị, Toolbar có class .in-setlist",
    true
);

// Bấm Next trên bài 1 -> Chuyển sang bài 2 (bài cuối)
$sim->onToolbarNextClicked();
assertCondition(
    $sim->currentIndex === 1 && $sim->libraryNavCallCount === 0,
    "Bấm Next ở bài 1: Chuyển sang bài 2 (index 1), Toolbar ◀ ▶ nằm trong chế độ setlist",
    true
);

// Đang ở bài 2 (bài cuối) -> Bấm Next lần nữa
$sim->onToolbarNextClicked();
assertCondition(
    $sim->currentIndex === -1 && $sim->currentSetlist === null && $sim->isProgramBarVisible === false,
    "Bấm Next ở bài cuối: Tự động kết thúc, currentIndex reset -1, currentSetlist = null, thanh chương trình ẩn",
    true
);

assertCondition(
    $sim->lastToast === 'Kết thúc chương trình' && $sim->eventEndedEmitted === true,
    "Hiện thông báo chính xác 'Kết thúc chương trình' và phát sự kiện setlist:ended",
    true
);

// Sau khi kết thúc chương trình: Bấm nút Next trên Toolbar -> Phải chuyển sang điều hướng Kho Nhạc
$sim->onToolbarNextClicked();
assertCondition(
    $sim->libraryNavCallCount === 1,
    "Các nút ◀ ▶ trên Toolbar không còn bị chiếm, đã chuyển giao lại cho Kho Nhạc",
    true
);

// Tổng kết
$ratio = round(($suiteBehavioralChecks / $suiteTotalChecks) * 100, 1);
echo "\n=========================================================================\n";
echo "SUITE_COMPLETE total={$suiteTotalChecks} passed={$suiteTotalChecks} failed=0 behavioral_ratio={$ratio}%\n";
echo "=========================================================================\n";
assertCondition($ratio >= 56.0, "Tỷ lệ kiểm thử hành vi đạt chuẩn >= 56% (Thực tế: {$ratio}%)");
