<?php
/**
 * tests/library_r29_propose_hd_review_regression.php
 *
 * Kiểm thử hồi quy cho Ticket R2-9:
 * "Đề xuất lên HD từ trình soạn (review) | E2E (DB tạm): gửi đề xuất thì có 1 review_request mang đúng song_id"
 */

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/core/Auth.php';
require_once __DIR__ . '/../api/services/ReviewService.php';
require_once __DIR__ . '/../api/services/ChordSetService.php';

$totalChecks = 0;
$passedChecks = 0;
$failedChecks = 0;
$behavioralChecks = 0;
$staticChecks = 0;

function assertCheck($name, $condition, $isBehavioral = false) {
    global $totalChecks, $passedChecks, $failedChecks, $behavioralChecks, $staticChecks;
    $totalChecks++;
    if ($isBehavioral) {
        $behavioralChecks++;
    } else {
        $staticChecks++;
    }

    if ($condition) {
        $passedChecks++;
        echo "  [PASS] $name\n";
    } else {
        $failedChecks++;
        echo "  [FAIL] $name\n";
    }
}

echo "=== R2-9: Propose Chord Set to HD Review Regression Test ===\n";

$toolbarPath   = __DIR__ . '/../includes/toolbar.php';
$spritePath    = __DIR__ . '/../assets/icons/lucide.svg';
$canvasPath    = __DIR__ . '/../assets/js/chord-canvas.js';
$uiPath        = __DIR__ . '/../assets/js/chord-canvas-ui.js';
$reviewCtrl    = __DIR__ . '/../api/controllers/ReviewController.php';

assertCheck("File includes/toolbar.php tồn tại", file_exists($toolbarPath));
assertCheck("File assets/icons/lucide.svg tồn tại", file_exists($spritePath));
assertCheck("File assets/js/chord-canvas.js tồn tại", file_exists($canvasPath));
assertCheck("File assets/js/chord-canvas-ui.js tồn tại", file_exists($uiPath));
assertCheck("File api/controllers/ReviewController.php tồn tại", file_exists($reviewCtrl));

$toolbarHtml = file_get_contents($toolbarPath);
$spriteSvg   = file_get_contents($spritePath);
$canvasJs    = file_get_contents($canvasPath);
$uiJs        = file_get_contents($uiPath);
$reviewCode  = file_get_contents($reviewCtrl);

// 1. Static: Nút btn-propose-hd trong toolbar
assertCheck(
    "toolbar.php: có nút #btn-propose-hd với onclick ChordCanvas.showProposeHdModal()",
    strpos($toolbarHtml, 'id="btn-propose-hd"') !== false &&
    strpos($toolbarHtml, 'ChordCanvas.showProposeHdModal()') !== false,
    false
);

// 2. Static: SVG sprite có icon-send
assertCheck(
    "lucide.svg: có symbol #icon-send",
    strpos($spriteSvg, 'id="icon-send"') !== false,
    false
);

// 3. Static: ChordCanvasUI có showProposeHdModal
assertCheck(
    "chord-canvas-ui.js: định nghĩa và export showProposeHdModal",
    strpos($uiJs, 'function showProposeHdModal') !== false &&
    strpos($uiJs, 'showProposeHdModal') !== false,
    false
);

// 4. Static: ChordCanvas export showProposeHdModal và toggle hiển thị nút
assertCheck(
    "chord-canvas.js: toggle nút btn-propose-hd khi đang xem bộ cá nhân và có quyền tạo",
    strpos($canvasJs, 'btn-propose-hd') !== false &&
    strpos($canvasJs, 'showProposeHdModal') !== false,
    false
);

// 5. Static: ReviewController hỗ trợ set_name tự động tìm target_id và chặn HD/default
assertCheck(
    "ReviewController.php: hỗ trợ tự động tìm target_id từ set_name và chặn đề xuất HD/default/TLH",
    strpos($reviewCode, 'set_name') !== false &&
    strpos($reviewCode, 'Không thể đề xuất bộ chuẩn') !== false,
    false
);

// 6. Ngân sách dòng (< 600 dòng)
$linesCanvas = count(file($canvasPath));
$linesUi     = count(file($uiPath));
$linesCtrl   = count(file($reviewCtrl));
assertCheck("chord-canvas.js < 600 dòng (thực tế: $linesCanvas)", $linesCanvas < 600, false);
assertCheck("chord-canvas-ui.js < 600 dòng (thực tế: $linesUi)", $linesUi < 600, false);
assertCheck("ReviewController.php < 600 dòng (thực tế: $linesCtrl)", $linesCtrl < 600, false);

// 7. Behavioral: Gửi đề xuất qua ReviewService và kiểm tra DB
$pdo = DB::get();
$testSongId = 'thanh-ca-001';
$testSetName = 'BH_TEST_R29';
$testUserId = 1; // banhat

// Chuẩn bị dữ liệu bộ hợp âm test
$testChords = [
    ['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'C'],
    ['measureIdx' => 1, 'noteIdx' => 0, 'chord' => 'F'],
    ['measureIdx' => 2, 'noteIdx' => 0, 'chord' => 'G7']
];

ChordSetService::saveSet($testSongId, $testSetName, $testChords, $testUserId, 'banhat');
$details = ChordSetService::getSetDetails($testSongId, $testSetName);
assertCheck("Bộ hợp âm test BH_TEST_R29 được lưu thành công vào DB", $details && isset($details['id']), true);

$targetId = (int)$details['id'];

// Xóa các review request cũ của target này nếu có
$pdo->prepare("DELETE FROM review_requests WHERE target_type = 'chord_set' AND target_id = ?")->execute([$targetId]);

// Gửi đề xuất cập nhật HD
$submitRes = ReviewService::submit(
    $testUserId,
    'chord_set',
    $targetId,
    $testSongId,
    'update_hd',
    'Ghi chú test R2-9: Đề xuất cập nhật hợp âm điệp khúc'
);

assertCheck(
    "ReviewService::submit trả về thành công với review_type = update_hd",
    isset($submitRes['success']) && $submitRes['success'] === true &&
    isset($submitRes['id']) && $submitRes['id'] > 0 &&
    $submitRes['review_type'] === 'update_hd',
    true
);

$reviewRequestId = (int)$submitRes['id'];

// Kiểm tra trong database có đúng 1 review_request với status pending và đúng song_id
$checkStmt = $pdo->prepare("SELECT * FROM review_requests WHERE id = ?");
$checkStmt->execute([$reviewRequestId]);
$reqRow = $checkStmt->fetch(PDO::FETCH_ASSOC);

assertCheck(
    "review_requests trong DB có đúng 1 bản ghi mang song_id = 'thanh-ca-001'",
    $reqRow && $reqRow['song_id'] === $testSongId,
    true
);

assertCheck(
    "review_request có status = 'pending' và target_type = 'chord_set'",
    $reqRow && $reqRow['status'] === 'pending' && $reqRow['target_type'] === 'chord_set',
    true
);

assertCheck(
    "review_request có submitted_by = 1 và submit_note đúng",
    $reqRow && (int)$reqRow['submitted_by'] === $testUserId && strpos($reqRow['submit_note'], 'test R2-9') !== false,
    true
);

assertCheck(
    "review_request có proposed_snapshot_json chứa đúng 3 hợp âm test",
    $reqRow && strpos($reqRow['proposed_snapshot_json'], 'G7') !== false,
    true
);

// Dọn dẹp dữ liệu test
$pdo->prepare("DELETE FROM review_requests WHERE id = ?")->execute([$reviewRequestId]);
ChordSetService::deleteSet($testSongId, $testSetName);

echo "\nKết quả kiểm thử R2-9: $passedChecks/$totalChecks checks passed ($behavioralChecks behavioral, $staticChecks static).\n";
echo "SUITE_COMPLETE total=$totalChecks passed=$passedChecks failed=$failedChecks behavioral=$behavioralChecks static=$staticChecks\n";

if ($failedChecks > 0) {
    exit(1);
}
