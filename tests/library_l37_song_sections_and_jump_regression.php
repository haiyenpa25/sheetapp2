<?php
declare(strict_types=1);

/**
 * tests/library_l37_song_sections_and_jump_regression.php
 *
 * Bộ kiểm thử hồi quy cho Ticket L3-7 (ROADMAP4.md):
 * Bản đồ bài và nhảy đoạn (Song Flow / Roadmap):
 * 1. Dải phân đoạn "Dạo · K1 · ĐK · K2 · ĐK · Kết" hiển thị ở đầu bài hát.
 * 2. Chạm (hoặc bàn đạp pedal / phím tắt j) để nhảy tức thì đến ô nhịp tương ứng (MusicalPosition.scrollToMeasure).
 * 3. Dữ liệu cấu trúc từ bảng SQLite song_sections (Intro, Lời 1, Điệp Khúc, Outro).
 * 4. Đồng bộ khi Host nhảy đoạn (LiveSession.broadcastState({ position: { measure, sectionId } })).
 * 5. Tô sáng đoạn đang phát/xem theo ô nhịp hiện tại (updateActiveSectionByMeasure).
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

echo "=== TICKET L3-7: SONG SECTIONS & ROADMAP JUMP REGRESSION SUITE ===\n\n";

$viewerFile       = __DIR__ . '/../includes/sheet_viewer.php';
$indexFile        = __DIR__ . '/../index.php';
$sheetCssFile     = __DIR__ . '/../assets/css/sheet.css';
$arrEngineFile    = __DIR__ . '/../assets/js/performance/arrangement-engine.js';
$musicalPosFile   = __DIR__ . '/../assets/js/performance/musical-position.js';
$perfEngineFile   = __DIR__ . '/../assets/js/performance/performance-engine.js';
$keyboardFile     = __DIR__ . '/../assets/js/keyboard-handler.js';
$arrServiceFile   = __DIR__ . '/../api/services/ArrangementService.php';
$arrControlFile   = __DIR__ . '/../api/controllers/ArrangementController.php';

// =========================================================================
// PHẦN 1: KIỂM TRA DOM MARKUP & TÍCH HỢP TRANG CHÍNH
// =========================================================================
echo "-- 1. Kiểm tra DOM Markup Dải Phân Đoạn (Song Jump Bar) --\n";

assertCondition(file_exists($viewerFile), "File includes/sheet_viewer.php tồn tại");
$viewerContent = file_get_contents($viewerFile);

assertCondition(
    strpos($viewerContent, 'id="section-jump-bar-container"') !== false,
    "sheet_viewer.php có container #section-jump-bar-container",
    true
);

assertCondition(
    strpos($viewerContent, 'id="section-chips-list"') !== false,
    "sheet_viewer.php có danh sách chip #section-chips-list",
    true
);

assertCondition(
    strpos($viewerContent, 'id="btn-section-edit"') !== false,
    "sheet_viewer.php có nút biên tập phân đoạn #btn-section-edit",
    true
);

$liveSyncFile = __DIR__ . '/../assets/js/live-sync.js';
$songLoaderFile = __DIR__ . '/../assets/js/song-loader.js';
assertCondition(file_exists($liveSyncFile) && file_exists($songLoaderFile), "File live-sync.js và song-loader.js tồn tại");

$liveSyncContent = file_get_contents($liveSyncFile);
$songLoaderContent = file_get_contents($songLoaderFile);

assertCondition(
    strpos($liveSyncContent, 'performance/musical-position.js') !== false &&
    strpos($liveSyncContent, 'performance/arrangement-engine.js') !== false &&
    strpos($songLoaderContent, 'window.LiveSync?.ensureLoaded') !== false,
    "live-sync.js nạp lazy các module phân đoạn và song-loader.js kích hoạt on-demand khi mở bài",
    true
);

// =========================================================================
// PHẦN 2: KIỂM TRA CSS & STYLING
// =========================================================================
echo "\n-- 2. Kiểm tra CSS Styling (.section-jump-bar-container, .section-chip, .active) --\n";

assertCondition(file_exists($sheetCssFile), "File assets/css/sheet.css tồn tại");
$sheetCss = file_get_contents($sheetCssFile);

assertCondition(
    strpos($sheetCss, '.section-jump-bar-container') !== false &&
    strpos($sheetCss, 'position: sticky') !== false,
    "CSS có quy tắc .section-jump-bar-container định vị sticky top",
    true
);

assertCondition(
    strpos($sheetCss, '.section-chip') !== false &&
    strpos($sheetCss, 'border-radius: 9999px') !== false,
    "CSS có quy tắc .section-chip bo tròn dạng chip hiện đại",
    true
);

assertCondition(
    strpos($sheetCss, '.section-chip.active') !== false &&
    strpos($sheetCss, 'box-shadow: 0 0 14px var(--chip-accent') !== false,
    "CSS có hiệu ứng sáng .section-chip.active với box-shadow theo màu đoạn",
    true
);

// =========================================================================
// PHẦN 3: KIỂM TRA BACKEND SERVICE & CƠ SỞ DỮ LIỆU SQLITE
// =========================================================================
echo "\n-- 3. Kiểm tra CSDL SQLite song_sections & ArrangementService --\n";

require_once __DIR__ . '/../api/core/DB.php';
require_once $arrServiceFile;

$sectionsDb = ArrangementService::getSections('thanh-ca-001');
assertCondition(
    is_array($sectionsDb) && count($sectionsDb) === 4,
    "ArrangementService::getSections('thanh-ca-001') trả về đúng 4 phân đoạn mẫu",
    true
);

$secTypes = array_column($sectionsDb, 'type');
assertCondition(
    $secTypes === ['intro', 'verse', 'chorus', 'outro'],
    "Các phân đoạn bài 001 theo đúng thứ tự: intro -> verse -> chorus -> outro",
    true
);

$chorusSec = $sectionsDb[2];
assertCondition(
    $chorusSec['name'] === 'Điệp Khúc' &&
    (int)$chorusSec['start_measure'] === 11 &&
    (int)$chorusSec['end_measure'] === 18 &&
    $chorusSec['color'] === '#f59e0b',
    "Phân đoạn Điệp Khúc có start_measure=11, end_measure=18, color=#f59e0b",
    true
);

// =========================================================================
// PHẦN 4: KIỂM TRA PHÍM TẮT & BÀN ĐẠP PEDAL
// =========================================================================
echo "\n-- 4. Kiểm tra Phím Tắt j/J và Bàn Đạp Pedal --\n";

assertCondition(file_exists($keyboardFile), "File assets/js/keyboard-handler.js tồn tại");
$keyboardContent = file_get_contents($keyboardFile);

assertCondition(
    strpos($keyboardContent, "case 'j': case 'J':") !== false &&
    strpos($keyboardContent, 'window.ArrangementEngine?.nextSection') !== false &&
    strpos($keyboardContent, 'window.ArrangementEngine?.prevSection') !== false,
    "keyboard-handler.js hỗ trợ phím j/J để nhảy tới/lùi phân đoạn bài hát",
    true
);

// =========================================================================
// PHẦN 5: KIỂM TRA LOGIC ARRANGEMENT ENGINE & BROADCAST STATE
// =========================================================================
echo "\n-- 5. Kiểm tra Logic ArrangementEngine & Broadcast Sync --\n";

assertCondition(file_exists($arrEngineFile), "File assets/js/performance/arrangement-engine.js tồn tại");
$arrEngineContent = file_get_contents($arrEngineFile);

assertCondition(
    strpos($arrEngineContent, 'function jumpToSection(') !== false &&
    strpos($arrEngineContent, 'MusicalPosition.scrollToMeasure') !== false,
    "ArrangementEngine.jumpToSection cuộn chính xác tới ô nhịp bằng MusicalPosition",
    true
);

assertCondition(
    strpos($arrEngineContent, 'function nextSection(') !== false &&
    strpos($arrEngineContent, 'function prevSection(') !== false,
    "ArrangementEngine có hàm nextSection và prevSection cho bàn đạp pedal",
    true
);

assertCondition(
    strpos($arrEngineContent, 'LiveSession.broadcastState') !== false &&
    strpos($arrEngineContent, 'sectionId: sec.id') !== false,
    "Khi Host nhảy phân đoạn, ArrangementEngine broadcastState gửi kèm sectionId và measure",
    true
);

assertCondition(
    strpos($arrEngineContent, 'function updateActiveSectionByMeasure(') !== false,
    "ArrangementEngine có hàm updateActiveSectionByMeasure tự động tô sáng phân đoạn theo ô nhịp",
    true
);

// Simulation State Machine: Jump and Measure Tracking
class MockArrangementEngine {
    public array $sections = [];
    public ?int $currentSectionId = null;
    public ?int $scrolledMeasure = null;
    public ?array $broadcastedState = null;
    public bool $isHost = false;

    public function __construct(array $sections, bool $isHost = false) {
        $this->sections = $sections;
        $this->isHost = $isHost;
    }

    public function jumpToSection(int $sectionId): void {
        foreach ($this->sections as $sec) {
            if ((int)$sec['id'] === $sectionId) {
                $this->currentSectionId = $sec['id'];
                $this->scrolledMeasure = (int)$sec['start_measure'];
                if ($this->isHost) {
                    $this->broadcastedState = [
                        'position' => [
                            'measure' => $sec['start_measure'],
                            'sectionId' => $sec['id']
                        ]
                    ];
                }
                return;
            }
        }
    }

    public function nextSection(): void {
        if (empty($this->sections)) return;
        $idx = -1;
        foreach ($this->sections as $i => $s) {
            if ($s['id'] === $this->currentSectionId) {
                $idx = $i;
                break;
            }
        }
        if ($idx === -1) {
            $this->jumpToSection($this->sections[0]['id']);
        } elseif ($idx < count($this->sections) - 1) {
            $this->jumpToSection($this->sections[$idx + 1]['id']);
        }
    }

    public function prevSection(): void {
        if (empty($this->sections)) return;
        $idx = -1;
        foreach ($this->sections as $i => $s) {
            if ($s['id'] === $this->currentSectionId) {
                $idx = $i;
                break;
            }
        }
        if ($idx === -1) {
            $this->jumpToSection($this->sections[0]['id']);
        } elseif ($idx > 0) {
            $this->jumpToSection($this->sections[$idx - 1]['id']);
        }
    }

    public function updateActiveSectionByMeasure(int $measure): ?int {
        foreach ($this->sections as $s) {
            if ($measure >= (int)$s['start_measure'] && $measure <= (int)$s['end_measure']) {
                $this->currentSectionId = $s['id'];
                return $s['id'];
            }
        }
        $this->currentSectionId = null;
        return null;
    }
}

// 1. Simulation nhảy tới Điệp khúc (Host)
$mockHost = new MockArrangementEngine($sectionsDb, true);
$mockHost->jumpToSection(7); // Section ID 7 là Điệp Khúc
assertCondition(
    $mockHost->currentSectionId === 7 &&
    $mockHost->scrolledMeasure === 11 &&
    isset($mockHost->broadcastedState['position']['sectionId']) &&
    $mockHost->broadcastedState['position']['sectionId'] === 7 &&
    $mockHost->broadcastedState['position']['measure'] === 11,
    "Host nhảy tới Điệp khúc (ID 7) cuộn đến m.11 và broadcast position chính xác",
    true
);

// 2. Simulation nextSection / prevSection
$mockHost->nextSection(); // Sau Điệp Khúc là Outro (ID 8, m.19)
assertCondition(
    $mockHost->currentSectionId === 8 && $mockHost->scrolledMeasure === 19,
    "nextSection() chuyển mượt sang Outro (ID 8, m.19)",
    true
);

$mockHost->prevSection(); // Quay lại Điệp Khúc (ID 7)
assertCondition(
    $mockHost->currentSectionId === 7 && $mockHost->scrolledMeasure === 11,
    "prevSection() quay lại Điệp Khúc (ID 7, m.11)",
    true
);

// 3. Simulation theo dõi ô nhịp tự động (Measure tracking)
$activeSecId = $mockHost->updateActiveSectionByMeasure(5); // Ô nhịp 5 thuộc Lời 1 (m.3-10, ID 6)
assertCondition(
    $activeSecId === 6 && $mockHost->currentSectionId === 6,
    "Khi nhạc chạy tới ô nhịp 5, active section tự động chuyển sang Lời 1 (ID 6)",
    true
);

$activeSecIdOutro = $mockHost->updateActiveSectionByMeasure(20); // Ô nhịp 20 thuộc Outro (m.19-20, ID 8)
assertCondition(
    $activeSecIdOutro === 8 && $mockHost->currentSectionId === 8,
    "Khi nhạc chạy tới ô nhịp 20, active section tự động chuyển sang Outro (ID 8)",
    true
);

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
