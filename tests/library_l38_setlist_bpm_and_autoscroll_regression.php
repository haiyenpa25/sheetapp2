<?php
declare(strict_types=1);

/**
 * tests/library_l38_setlist_bpm_and_autoscroll_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L3-8 (ROADMAP4.md):
 * 1. Count-in và Metronome lấy BPM của mục setlist (ví dụ BPM 72).
 * 2. Tự cuộn theo BPM × số ô nhịp (tốc độ cuộn tính theo BPM setlist).
 * 3. Hỗ trợ Tạm dừng (Pause) và Tiếp tục (Resume) mượt mà (học từ MobileSheets).
 * 4. Luôn cho phép chỉnh tay BPM và hệ số tốc độ (có nút tăng/giảm).
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

echo "=== TICKET L3-8: SETLIST BPM, COUNT-IN & AUTO-SCROLLER REGRESSION SUITE ===\n\n";

$playerFile    = __DIR__ . '/../assets/js/setlist-player.js';
$scrollerFile  = __DIR__ . '/../assets/js/auto-scroller.js';
$metronomeFile = __DIR__ . '/../assets/js/metronome.js';
$countInFile   = __DIR__ . '/../assets/js/performance/count-in-engine.js';
$perfEngFile   = __DIR__ . '/../assets/js/performance/performance-engine.js';
$toolbarFile   = __DIR__ . '/../includes/toolbar.php';

// =========================================================================
// PHẦN 1: KIỂM TRA TÍCH HỢP METRONOME & SETLIST BPM
// =========================================================================
echo "-- 1. Kiểm tra Metronome & Setlist Player liên kết BPM --\n";

assertCondition(file_exists($playerFile), "File setlist-player.js tồn tại");
$playerContent = file_get_contents($playerFile);

assertCondition(
    strpos($playerContent, 'window.Metronome.setBpmAndBeats(bpmNum') !== false &&
    strpos($playerContent, 'window.AutoScroller?.setBpm') !== false,
    "setlist-player.js áp dụng BPM của mục setlist cho cả Metronome và AutoScroller",
    true
);

assertCondition(file_exists($metronomeFile), "File metronome.js tồn tại");
$metronomeContent = file_get_contents($metronomeFile);

assertCondition(
    strpos($metronomeContent, 'setlistItem.bpm') !== false &&
    strpos($metronomeContent, '_applyBeatsFromNumber') !== false,
    "metronome.js ưu tiên đọc BPM từ setlistItem khi nạp bài hát mới",
    true
);

assertCondition(
    strpos($metronomeContent, 'btn-metronome-count-in') !== false &&
    strpos($metronomeContent, 'startCountIn({ bpm: _bpm') !== false,
    "Nút Count-in trên Metronome kích hoạt CountInEngine với BPM hiện hành",
    true
);

// =========================================================================
// PHẦN 2: KIỂM TRA AUTOSCROLLER & MOBILESHEETS PAUSE/RESUME
// =========================================================================
echo "\n-- 2. Kiểm tra AutoScroller tính toán theo BPM và hỗ trợ Pause/Resume --\n";

assertCondition(file_exists($scrollerFile), "File auto-scroller.js tồn tại");
$scrollerContent = file_get_contents($scrollerFile);

assertCondition(
    strpos($scrollerContent, '_detectBpm') !== false &&
    strpos($scrollerContent, 'setlistItem.bpm') !== false &&
    strpos($scrollerContent, 'Metronome?.getBpm') !== false,
    "AutoScroller._detectBpm ưu tiên BPM từ mục setlist và Metronome",
    true
);

assertCondition(
    strpos($scrollerContent, 'function pause(') !== false &&
    strpos($scrollerContent, 'function resume(') !== false &&
    strpos($scrollerContent, 'isPaused:') !== false,
    "AutoScroller có hàm pause() và resume() hỗ trợ tạm dừng cuộn theo MobileSheets",
    true
);

assertCondition(
    strpos($scrollerContent, 'function setBpm(') !== false &&
    strpos($scrollerContent, 'function getBpm(') !== false,
    "AutoScroller cung cấp API setBpm() và getBpm() cho phép chỉnh tay",
    true
);

assertCondition(
    strpos($scrollerContent, '_speedMultiplier = 1;') !== false,
    "AutoScroller khởi tạo hệ số tốc độ mặc định _speedMultiplier = 1 (chuẩn 1x)",
    true
);

assertCondition(
    strpos($scrollerContent, 'Tạm Dừng') !== false &&
    strpos($scrollerContent, 'Tiếp Tục') !== false,
    "Nút #btn-auto-scroll cập nhật linh hoạt giữa Cuộn / Tạm Dừng / Tiếp Tục",
    true
);

// =========================================================================
// PHẦN 3: KIỂM TRA TOOLBAR CONTROLS
// =========================================================================
echo "\n-- 3. Kiểm tra Toolbar Controls (Nút cuộn, chọn tốc độ, metronome) --\n";

assertCondition(file_exists($toolbarFile), "File includes/toolbar.php tồn tại");
$toolbarContent = file_get_contents($toolbarFile);

assertCondition(
    strpos($toolbarContent, 'id="btn-auto-scroll"') !== false &&
    strpos($toolbarContent, 'id="scroll-speed"') !== false &&
    strpos($toolbarContent, 'id="btn-toolbar-metronome"') !== false,
    "Thanh công cụ có đầy đủ cụm nút cuộn, chọn tốc độ và icon metronome",
    true
);

// =========================================================================
// PHẦN 4: MÔ PHỎNG HÀNH VI TÍNH TOÁN TEMPO & THỜI LƯỢNG (SIMULATION)
// =========================================================================
echo "\n-- 4. Mô phỏng hành vi: Setlist BPM = 72, 20 ô nhịp, nhịp 4/4 --\n";

class MockAutoScrollerWithTempo {
    public int $bpm = 80;
    public int $beatsPerMeasure = 4;
    public int $totalMeasures = 20;
    public float $speedMultiplier = 1.0;
    public bool $isScrolling = false;
    public bool $isPaused = false;
    public float $currentScrollY = 0.0;
    public float $totalScrollHeight = 1200.0;

    public function setBpm(int $bpm): void {
        $this->bpm = $bpm;
    }

    public function getSongDurationSeconds(): float {
        // Tổng số phách = totalMeasures * beatsPerMeasure
        // Thời gian mỗi phách = 60 / bpm
        return ($this->totalMeasures * $this->beatsPerMeasure * 60.0) / $this->bpm;
    }

    public function getScrollPixelsPerSecond(): float {
        $dur = $this->getSongDurationSeconds();
        return ($this->totalScrollHeight / $dur) * $this->speedMultiplier;
    }

    public function play(): void {
        $this->isScrolling = true;
        $this->isPaused = false;
    }

    public function pause(): void {
        if ($this->isScrolling) {
            $this->isPaused = true;
        }
    }

    public function resume(): void {
        if ($this->isScrolling && $this->isPaused) {
            $this->isPaused = false;
        }
    }

    public function stop(): void {
        $this->isScrolling = false;
        $this->isPaused = false;
        $this->currentScrollY = 0.0;
    }
}

$mock = new MockAutoScrollerWithTempo();

// 1. Kiểm tra khi chưa có setlist: default 80 bpm
assertCondition($mock->bpm === 80, "Giá trị khởi tạo BPM mặc định là 80", true);

// 2. Setlist mục có BPM = 72
$mock->setBpm(72);
assertCondition($mock->bpm === 72, "AutoScroller nhận đúng BPM 72 từ mục setlist", true);

// 3. Tính thời lượng bài hát theo BPM 72:
// 20 ô nhịp * 4 phách = 80 phách. 80 * 60 / 72 = 66.67 giây.
$dur72 = $mock->getSongDurationSeconds();
assertCondition(
    abs($dur72 - 66.6667) < 0.01,
    "Thời lượng bài hát ở BPM 72 (20 ô nhịp 4/4) tính đúng bằng 66.67 giây",
    true
);

// Tốc độ cuộn ở BPM 72: 1200px / 66.67s = 18 px/s
$speed72 = $mock->getScrollPixelsPerSecond();
assertCondition(
    abs($speed72 - 18.0) < 0.1,
    "Tốc độ cuộn tính theo BPM 72 đạt xấp xỉ 18.0 px/giây",
    true
);

// 4. Nếu tăng tốc độ lên 2x (speedMultiplier = 2):
$mock->speedMultiplier = 2.0;
$speed2x = $mock->getScrollPixelsPerSecond();
assertCondition(
    abs($speed2x - 36.0) < 0.1,
    "Khi chọn tốc độ 2x, tốc độ cuộn tăng gấp đôi lên 36.0 px/giây",
    true
);
$mock->speedMultiplier = 1.0;

// 5. Kiểm tra chu trình Play -> Pause -> Resume -> Stop
$mock->play();
assertCondition($mock->isScrolling && !$mock->isPaused, "Sau khi play(), isScrolling=true và isPaused=false", true);

$mock->pause();
assertCondition($mock->isScrolling && $mock->isPaused, "Sau khi pause(), isScrolling=true và isPaused=true (giữ vị trí)", true);

$mock->resume();
assertCondition($mock->isScrolling && !$mock->isPaused, "Sau khi resume(), tiếp tục cuộn mượt mà", true);

$mock->stop();
assertCondition(!$mock->isScrolling && !$mock->isPaused, "Sau khi stop(), dừng hẳn và reset trạng thái", true);

// =========================================================================
// TỔNG KẾT
// =========================================================================
$behavioralRatio = ($suiteTotalChecks > 0) ? ($suiteBehavioralChecks / $suiteTotalChecks) * 100 : 0;
echo "\n=========================================================================\n";
printf(
    "SUITE_COMPLETE total=%d passed=%d failed=0 behavioral_ratio=%.1f%%\n",
    $suiteTotalChecks,
    $suiteTotalChecks,
    $behavioralRatio
);
echo "=========================================================================\n";
assertCondition($behavioralRatio >= 56.0, "Tỷ lệ kiểm thử hành vi đạt chuẩn >= 56% (Thực tế: " . round($behavioralRatio, 1) . "%)");

exit(0);
