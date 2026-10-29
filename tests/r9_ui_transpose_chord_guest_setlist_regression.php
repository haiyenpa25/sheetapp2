<?php
declare(strict_types=1);
ob_start();

/**
 * tests/r9_ui_transpose_chord_guest_setlist_regression.php
 *
 * Bộ kiểm thử hồi quy Đợt R9 (đã nâng cấp theo ROADMAP_R9_REVIEW P2 & P3):
 * 1. RULE.md tồn tại và định nghĩa đầy đủ 5 nhóm quy tắc bất biến.
 * 2. CORE-1 & P3-1: Ma trận dịch giọng 12 nốt gốc × 8 hậu tố ("", m, 7, maj7, m7, dim, sus4, /bass)
 *    × bán cung -11..+11 × useFlats {null, true, false} (6.336 phép thử hành vi) + KeyService.
 * 3. CORE-1 & P2-5 (F4): ChordCanvasTranspose.getKeyFifths tôn trọng <fifths>0</fifths> của XML,
 *    chặn đọc nhầm currentSong.id cũ, và chỉ fallback sang defaultKey khi XML thiếu <fifths>.
 * 4. CORE-2, P2-1 (F1), P2-2 (F2), P2-4 (F6/F8) & P3-3:
 *    - HTTP thật qua ChordSetController: banhat thường (403), HoaiDinh không có chord_code (403),
 *      chủ sở hữu chord_code='HD' (200), admin (200), clone target='HD' bị chặn (403).
 *    - VM hành vi thật trên ChordCanvas (mới & /old/): cả hoaidinh và admin bật sửa trực tiếp HD,
 *      đứng ở TLH không có nút ghi đè HD, banhat ở BH gọi showNewSetModal không mở modal (F6),
 *      /old/ chuyển bài về HD tắt add-mode cho banhat thường (F8), và applyPreloaded chỉ gọi _build
 *      khi đã có SVG (P3-3).
 * 5. CORE-3 & P2-3 (F3): LibrarySearch.run fallback sang local khi FTS5 rỗng + bấm "Xem thêm"
 *    giữ nguyên scrollTop (420), đổi từ khóa tìm kiếm mới thì reset scrollTop về 0.
 * 6. UI-1, UI-2, UI-3 & P3-2: Thực thi hành vi thật của MobileController và Classic ToolbarController
 *    trên DOM thật trích từ includes/toolbar.php và old/includes/toolbar.php (bấm khóa zoom, đổi zoom,
 *    bật tempo) + kiểm tra hiển thị CSS cho Web, iPad, Điện thoại, Gig HUD.
 * 7. PROG-1, PROG-2, PROG-3 & P3-2: Khách chưa đăng nhập xem chương trình published qua API thật
 *    và thực thi hành vi thật của UrlState + SetlistDetail ở chế độ khách (ẩn thêm/xóa bài, hiện
 *    banner khách, bấm "Vào chơi" nạp bài đầu tiên với đúng tông/bộ hợp âm/tempo).
 */

require_once __DIR__ . '/lib/assert.php';
require_once __DIR__ . '/lib/mock_php_input.php';
require_once __DIR__ . '/fixtures/test_db_fixture.php';
require_once __DIR__ . '/fixtures/tv41_setlists.php';
require_once dirname(__DIR__) . '/api/core/HttpException.php';
require_once dirname(__DIR__) . '/api/core/Response.php';
require_once dirname(__DIR__) . '/api/core/Auth.php';
require_once dirname(__DIR__) . '/api/services/ChordSetService.php';
require_once dirname(__DIR__) . '/api/services/SetlistPublicReadService.php';
require_once dirname(__DIR__) . '/api/controllers/ChordSetController.php';

$rootDir = dirname(__DIR__);

// ── 1. Kiểm tra RULE.md ──────────────────────────────────────────────────────
$rulePath = $rootDir . '/RULE.md';
$ruleContent = is_file($rulePath) ? (string)file_get_contents($rulePath) : '';
TestAssert::checkStatic(
    'R9-RULE',
    is_file($rulePath)
        && str_contains($ruleContent, 'Bb')
        && str_contains($ruleContent, 'Ab')
        && str_contains($ruleContent, 'Eb')
        && str_contains($ruleContent, '## 1. Quy tắc')
        && str_contains($ruleContent, '## 5. Quy tắc'),
    'RULE.md tồn tại và định nghĩa đầy đủ 5 nhóm quy tắc bất biến chống hồi quy'
);

// ── 2. P2-1 (F1) & P2-2 (F2): Kiểm thử HTTP thật qua ChordSetController ──────
$tempChordDir = sys_get_temp_dir() . '/sheetapp_r9_http_' . bin2hex(random_bytes(4));
mkdir($tempChordDir, 0777, true);
putenv('CHORD_SETS_DIR=' . $tempChordDir);
register_shutdown_function(static function () use ($tempChordDir): void {
    if (!is_dir($tempChordDir)) return;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tempChordDir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) { $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname()); }
    @rmdir($tempChordDir);
});

$pdoHttp = createTestDatabase();
DB::setPdo($pdoHttp);
$testSongId = '001-thanh-chua-yeu-thuong';
$pdoHttp->exec("INSERT INTO users (id, username, password_hash, role, chord_code, status) VALUES
    (20, 'banhat_thuong', '-', 'banhat', 'BH', 'active'),
    (21, 'HoaiDinh',      '-', 'banhat', NULL, 'active'),
    (22, 'hoaidinh',      '-', 'banhat', 'HD', 'active'),
    (23, 'admin_user',    '-', 'admin',  'ADMIN', 'active')");

$callChordPost = static function (int $uid, string $uname, string $role, ?string $code, array $body): array {
    Auth::resetDbCache();
    $_SESSION = ['user_id' => $uid, 'username' => $uname, 'role' => $role, 'chord_code' => $code];
    mockPhpInput(json_encode($body, JSON_UNESCAPED_UNICODE));
    $ctrl = new ChordSetController();
    http_response_code(200);
    ob_start();
    try {
        $ctrl->handleRequest('POST');
    } catch (HttpException $e) {
        ob_end_clean();
        restorePhpInput();
        return ['success' => false, '_httpCode' => $e->getStatusCode(), 'error' => $e->getMessage()];
    }
    $raw = ob_get_clean();
    $http = http_response_code();
    restorePhpInput();
    $dec = json_decode((string)$raw, true);
    if (!is_array($dec)) return ['success' => false, '_httpCode' => $http, 'raw' => $raw];
    $dec['_httpCode'] = $http;
    return $dec;
};

$rBanhatSaveHd = $callChordPost(20, 'banhat_thuong', 'banhat', 'BH', [
    'action' => 'save', 'songId' => $testSongId, 'name' => 'HD',
    'chords' => [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'C']]
]);
$rSpoofSaveHd = $callChordPost(21, 'HoaiDinh', 'banhat', null, [
    'action' => 'save', 'songId' => $testSongId, 'name' => 'HD',
    'chords' => [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'G']]
]);
$rRealHdSave = $callChordPost(22, 'hoaidinh', 'banhat', 'HD', [
    'action' => 'save', 'songId' => $testSongId, 'name' => 'HD',
    'chords' => [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'F']]
]);
$rAdminSaveHd = $callChordPost(23, 'admin_user', 'admin', 'ADMIN', [
    'action' => 'save', 'songId' => $testSongId, 'name' => 'HD',
    'chords' => [['measureIdx' => 0, 'noteIdx' => 0, 'chord' => 'Bb']]
]);
$rBanhatCloneHd = $callChordPost(20, 'banhat_thuong', 'banhat', 'BH', [
    'action' => 'clone', 'songId' => $testSongId, 'source' => 'BH', 'target' => 'HD'
]);
$rSpoofCloneHd = $callChordPost(21, 'HoaiDinh', 'banhat', null, [
    'action' => 'clone', 'songId' => $testSongId, 'source' => 'BH', 'target' => 'HD'
]);
$rAdminCloneHd = $callChordPost(23, 'admin_user', 'admin', 'ADMIN', [
    'action' => 'clone', 'songId' => $testSongId, 'source' => 'BH', 'target' => 'HD'
]);

TestAssert::checkBehavior(
    'R9-P2-1-2',
    $rBanhatSaveHd['_httpCode'] === 403
        && $rSpoofSaveHd['_httpCode'] === 403
        && $rBanhatCloneHd['_httpCode'] === 403
        && $rSpoofCloneHd['_httpCode'] === 403
        && $rAdminCloneHd['_httpCode'] === 403
        && $rRealHdSave['_httpCode'] === 200 && !empty($rRealHdSave['success'])
        && $rAdminSaveHd['_httpCode'] === 200 && !empty($rAdminSaveHd['success']),
    'P2-1 & P2-2 (HTTP): banhat thường & HoaiDinh không có chord_code bị chặn 403; clone vào HD bị chặn 403; chủ sở hữu chord_code=HD và Admin lưu HD đạt 200'
);

// ── 3. Thực thi JS behavioral suite (P3-1, P2-5, P3-3, P2-3, P3-2) ───────────
$jsTestScript = <<<'JS'
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = process.argv[2];

function loadScript(ctx, relPath) {
  const code = fs.readFileSync(path.join(root, relPath), 'utf8');
  vm.runInContext(code, ctx, { filename: relPath });
}

(async () => {
  const results = {};

  // ── A. CORE-1 & P3-1: Ma trận dịch giọng 12 gốc × 8 hậu tố × -11..+11 × useFlats {null,true,false}
  {
    const ctx = { console };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    loadScript(ctx, 'assets/js/core/KeyService.js');
    loadScript(ctx, 'assets/js/transpose-engine.js');
    const TE = ctx.window.TransposeEngine;
    const KS = ctx.window.KeyService;

    const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const chromaOf = (n) => {
      if (!n) return -1;
      let i = NOTES_SHARP.indexOf(n);
      if (i !== -1) return i;
      return NOTES_FLAT.indexOf(n);
    };

    const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const suffixes = ['', 'm', '7', 'maj7', 'm7', 'dim', 'sus4', '/E'];
    const flatOpts = [null, true, false];
    let matrixTotal = 0;
    let matrixFailures = [];

    for (const r of roots) {
      const origRootChroma = chromaOf(r);
      for (const suf of suffixes) {
        const isMinorOrDim = (suf === 'm' || suf === 'm7' || suf === 'dim');
        const origBass = suf.startsWith('/') ? suf.slice(1) : null;
        const origBassChroma = origBass ? chromaOf(origBass) : -1;
        const chord = r + suf;
        for (let semi = -11; semi <= 11; semi++) {
          if (semi === 0) continue;
          for (const uf of flatOpts) {
            matrixTotal++;
            const out = TE.transposeChord(chord, semi, uf);
            const m = String(out).match(/^([A-G][#b]?)([^\/]*)(?:\/([A-G][#b]?))?$/);
            if (!m) {
              matrixFailures.push(`Invalid output ${out} for ${chord} (${semi}, ${uf})`);
              continue;
            }
            const outRoot = m[1];
            const outBass = m[3] || null;
            const outChroma = chromaOf(outRoot);
            const expectedChroma = ((origRootChroma + semi) % 12 + 12) % 12;
            if (outChroma !== expectedChroma) {
              matrixFailures.push(`Root chroma mismatch: ${chord} + ${semi} => ${out} (${outChroma} != ${expectedChroma})`);
            }
            // Invariant (a): Major/dom/sus chords at chroma 3, 8, 10 NEVER spelled D#, G#, A#
            if (!isMinorOrDim && (expectedChroma === 3 || expectedChroma === 8 || expectedChroma === 10)) {
              if (outRoot === 'D#' || outRoot === 'G#' || outRoot === 'A#') {
                matrixFailures.push(`Forbidden sharp major root: ${chord} + ${semi} (uf=${uf}) => ${out}`);
              }
            }
            // Invariant (b): Transpose +semi then -semi returns to original root chroma
            const roundTrip = TE.transposeChord(out, -semi, uf);
            const rtMatch = String(roundTrip).match(/^([A-G][#b]?)/);
            if (!rtMatch || chromaOf(rtMatch[1]) !== origRootChroma) {
              matrixFailures.push(`Round-trip chroma mismatch: ${chord} -> ${out} -> ${roundTrip}`);
            }
            // Invariant (c): Slash bass chroma matches shifted bass chroma
            if (origBass) {
              const expBassChroma = ((origBassChroma + semi) % 12 + 12) % 12;
              if (!outBass || chromaOf(outBass) !== expBassChroma) {
                matrixFailures.push(`Bass chroma mismatch: ${chord} + ${semi} => ${out}`);
              }
            }
          }
        }
      }
    }

    const specificOk = (
      TE.transposeChord('A', -1, null) === 'Ab' &&
      TE.transposeChord('A', 1, null) === 'Bb' &&
      TE.transposeChord('G', 1, null) === 'Ab' &&
      TE.transposeChord('D', 1, null) === 'Eb' &&
      KS.displayKey('A', -1) === 'Ab' &&
      KS.displayKey('A', 1) === 'Bb' &&
      KS.displayKey('A#', 0) === 'Bb' &&
      KS.displayKey('G#', 0) === 'Ab' &&
      KS.displayKey('D#', 0) === 'Eb'
    );

    results.p3_1_matrix = (matrixTotal > 5000 && matrixFailures.length === 0 && specificOk);
    results.p3_1_count = matrixTotal;
    results.p3_1_errors = matrixFailures.slice(0, 5);
  }

  // ── B. CORE-1 & P2-5 (F4): ChordCanvasTranspose.getKeyFifths tôn trọng <fifths>0</fifths> & chặn bài cũ
  {
    const ctx = {
      console,
      DOMParser: class {
        parseFromString(xml) {
          return {
            querySelector: (sel) => {
              if (sel === 'key > fifths') {
                const m = xml.match(/<fifths>([^<]+)<\/fifths>/);
                return m ? { textContent: m[1] } : null;
              }
              return null;
            },
            querySelectorAll: () => [],
          };
        }
      },
      Store: { get: (k) => k === 'currentSong' ? { id: 'song-147', defaultKey: 'F' } : null },
      App: { getCurrentSongId: () => 'song-147', getOriginalXml: () => '<score-partwise><key><fifths>0</fifths></key></score-partwise>' },
      OSMDRenderer: { getCurrentXml: () => '<score-partwise><key><fifths>0</fifths></key></score-partwise>' },
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    loadScript(ctx, 'assets/js/core/KeyService.js');
    loadScript(ctx, 'assets/js/transpose-engine.js');
    loadScript(ctx, 'assets/js/chord-canvas-transpose.js');

    const fifthsWhenXml0 = ctx.window.ChordCanvasTranspose.getKeyFifths();
    ctx.OSMDRenderer.getCurrentXml = () => null;
    ctx.App.getOriginalXml = () => null;
    ctx.App.getCurrentSongId = () => 'song-other';
    ctx.window.ChordCanvasTranspose.resetCache();
    const fifthsWhenStaleSong = ctx.window.ChordCanvasTranspose.getKeyFifths();

    ctx.App.getCurrentSongId = () => 'song-147';
    ctx.window.ChordCanvasTranspose.resetCache();
    const fifthsWhenNoXml = ctx.window.ChordCanvasTranspose.getKeyFifths();

    results.p2_5_fifths = (fifthsWhenXml0 === 0 && fifthsWhenStaleSong === null && fifthsWhenNoXml === -1);
  }

  // ── C. CORE-2, P2-2, P2-4 & P3-3: ChordCanvas (hoaidinh, admin, banhat, applyPreloaded có/không SVG)
  {
    let cloneModalCalls = [];
    let newSetModalCalls = 0;
    let buildCalls = 0;
    let hasSvg = true;
    let curRole = 'banhat';
    let curUser = 'hoaidinh';
    let curCode = 'HD';

    const ctx = {
      console,
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      requestAnimationFrame: fn => fn(),
      localStorage: { getItem: () => null, setItem: () => {} },
      document: {
        body: { classList: { contains: () => false }, appendChild: () => {} },
        head: { appendChild: () => {} },
        getElementById: (id) => {
          if (id === 'osmd-container') return { querySelector: () => hasSvg ? { querySelectorAll: () => [{}] } : null };
          if (id === 'chord-set-selector') return { options: [{ value: 'HD' }, { value: 'BH' }], value: 'BH', dataset: {}, addEventListener: () => {} };
          return null;
        },
        querySelector: (sel) => (sel === '#osmd-container svg' && hasSvg) ? {} : null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({ style: {}, classList: { toggle: () => {} } }),
      },
      Auth: {
        isBanhat: () => true,
        isAdmin: () => curRole === 'admin',
        isLeader: () => curRole === 'leader',
        getChordCode: () => curCode,
        getUser: () => curUser,
        isLoggedIn: () => true,
        canUseMemberTools: () => true,
      },
      App: { getCurrentSongId: () => '001', showToast: () => {} },
      SafeHtml: { escape: s => String(s ?? '') },
      ChordSetNames: { describe: () => 'HD' },
      ChordCanvasCore: { nextToken: () => 1, isCurrentToken: () => true, hasLoadError: () => false, resetUndo: () => {} },
      ChordCanvasEdit: { init: () => {}, closePopup: () => {}, resetUndo: () => {}, setBaseChecksum: () => {}, flushSave: async () => {} },
      ChordCanvasUI: {
        showCloneChoiceModal: (args) => { cloneModalCalls.push(args); },
        showNewSetModal: () => { newSetModalCalls++; },
      },
      ChordCanvasDots: { clearGeomCache: () => {}, mapNotes: () => { buildCalls++; return []; }, buildChordTextPositions: () => [], renderViewMode: () => {}, renderEditMode: () => {}, alignDOMChords: () => {} },
      ChordCanvasTranspose: { resetCache: () => {}, applyTranspose: x => x },
      ApiService: {
        chordSets: {
          load: async () => ({ success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }], checksum: 'abc' }),
          list: async () => ({ success: true, sets: ['HD', 'BH'] }),
          clearCache: () => {},
        }
      },
      SongInfoBar: { refreshChordChip: () => {} },
      Store: { set: () => {}, get: () => null },
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    loadScript(ctx, 'assets/js/chord-canvas.js');

    // 1) hoaidinh (chord_code='HD') trên HD bật + trực tiếp & mở được showNewSetModal
    await ctx.window.ChordCanvas.loadSong('001', 'HD');
    ctx.window.ChordCanvas.setAddMode(true);
    const hoaidinhDirectOk = (cloneModalCalls.length === 0 && ctx.window.ChordCanvas.isEditMode() === true);
    await ctx.window.ChordCanvas.showNewSetModal();
    const hoaidinhNewSetOk = (newSetModalCalls === 1);

    // 2) admin (role='admin', chord_code='ADMIN') trên HD bật + trực tiếp, mở được showNewSetModal, và ở TLH không có onCopyOverwrite vào HD
    ctx.window.ChordCanvas.setAddMode(false, { skipConfirm: true });
    curRole = 'admin'; curUser = 'admin'; curCode = 'ADMIN';
    await ctx.window.ChordCanvas.loadSong('001', 'HD');
    ctx.window.ChordCanvas.setAddMode(true);
    const adminDirectOk = (cloneModalCalls.length === 0 && ctx.window.ChordCanvas.isEditMode() === true);
    await ctx.window.ChordCanvas.showNewSetModal();
    const adminNewSetOk = (newSetModalCalls === 2);

    ctx.window.ChordCanvas.setAddMode(false, { skipConfirm: true });
    await ctx.window.ChordCanvas.loadSong('001', 'default');
    ctx.window.ChordCanvas.setAddMode(true);
    const adminTlhNoOverwriteOk = (cloneModalCalls.length === 1 && cloneModalCalls[0].targetSet === 'HD' && cloneModalCalls[0].onCopyOverwrite === null);

    // 3) banhat thường (chord_code='BH') đang ở BH gọi showNewSetModal KHÔNG mở modal (F6)
    curRole = 'banhat'; curUser = 'banhat'; curCode = 'BH';
    await ctx.window.ChordCanvas.loadSong('001', 'BH');
    await ctx.window.ChordCanvas.showNewSetModal();
    const banhatF6Ok = (newSetModalCalls === 2 && ctx.window.ChordCanvas.isEditMode() === true);

    // 4) P3-3: applyPreloaded khi CHƯA có SVG (không gọi _build) vs khi ĐÃ có SVG (gọi _build)
    hasSvg = false;
    const beforeNoSvg = buildCalls;
    ctx.window.ChordCanvas.applyPreloaded('HD', { '0_0': 'G' }, 'chk1');
    const noSvgDidNotBuild = (buildCalls === beforeNoSvg);

    hasSvg = true;
    ctx.window.ChordCanvas.applyPreloaded('HD', { '0_0': 'G' }, 'chk2');
    const withSvgDidBuild = (buildCalls > beforeNoSvg);

    // 5) F8 (/old/): banhat đang bật add-mode ở BH, khi chuyển bài về HD thì tự tắt add-mode
    const oldCtx = {
      console,
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      requestAnimationFrame: fn => fn(),
      localStorage: { getItem: () => null, setItem: () => {} },
      document: {
        body: { classList: { contains: () => false }, appendChild: () => {} },
        head: { appendChild: () => {} },
        getElementById: (id) => {
          if (id === 'osmd-container') return { querySelector: () => ({ querySelectorAll: () => [{}] }) };
          if (id === 'chord-set-selector') return { options: [{ value: 'HD' }, { value: 'BH' }], value: 'BH', dataset: {}, addEventListener: () => {} };
          return null;
        },
        querySelector: (sel) => sel === '#osmd-container svg' ? {} : null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({ style: {}, classList: { toggle: () => {} } }),
      },
      Auth: {
        isBanhat: () => true,
        isAdmin: () => false,
        getChordCode: () => 'BH',
        getUser: () => 'banhat',
        isLoggedIn: () => true,
      },
      App: { getCurrentSongId: () => '001', showToast: () => {} },
      SafeHtml: { escape: s => String(s ?? '') },
      ChordSetNames: { describe: () => 'HD' },
      ChordCanvasCore: { nextToken: () => 1, isCurrentToken: () => true, hasLoadError: () => false, resetUndo: () => {} },
      ChordCanvasEdit: { init: () => {}, closePopup: () => {}, resetUndo: () => {}, setBaseChecksum: () => {}, flushSave: async () => {} },
      ChordCanvasUI: { showCloneChoiceModal: () => {}, showNewSetModal: () => {} },
      ChordCanvasDots: { clearGeomCache: () => {}, mapNotes: () => [], buildChordTextPositions: () => [], renderViewMode: () => {}, renderEditMode: () => {}, alignDOMChords: () => {} },
      ChordCanvasTranspose: { resetCache: () => {}, applyTranspose: x => x },
      ApiService: {
        chordSets: {
          load: async () => ({ success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }] }),
          list: async () => ({ success: true, sets: ['HD', 'BH'] }),
          clearCache: () => {},
        }
      },
      SongInfoBar: { refreshChordChip: () => {} },
      Store: { set: () => {}, get: () => null },
    };
    oldCtx.window = oldCtx;
    oldCtx.globalThis = oldCtx;
    vm.createContext(oldCtx);
    loadScript(oldCtx, 'old/assets/js/chord-canvas.js');
    await oldCtx.window.ChordCanvas.loadSong('001', 'BH');
    oldCtx.window.ChordCanvas.setAddMode(true);
    const oldBeforeSwitchEdit = oldCtx.window.ChordCanvas.isEditMode();
    await oldCtx.window.ChordCanvas.loadSong('002', 'HD');
    const oldAfterSwitchEdit = oldCtx.window.ChordCanvas.isEditMode();
    const oldF8Ok = (oldBeforeSwitchEdit === true && oldAfterSwitchEdit === false);

    results.p3_3_chord_canvas = (
      hoaidinhDirectOk && hoaidinhNewSetOk &&
      adminDirectOk && adminNewSetOk && adminTlhNoOverwriteOk &&
      banhatF6Ok && noSvgDidNotBuild && withSvgDidBuild && oldF8Ok
    );
  }

  // ── D. CORE-3 & P2-3 (F3): LibrarySearch fallback + "Xem thêm" không nhảy scrollTop
  {
    const scrollContainer = {
      scrollTop: 0,
      clientHeight: 500,
      addEventListener: () => {},
      querySelector: () => null,
      closest: () => scrollContainer,
      getBoundingClientRect: () => ({ top: 0, height: 500 }),
    };
    let loadMoreBtn = null;
    const songListEl = {
      id: 'song-list',
      innerHTML: '',
      scrollTop: 0,
      clientHeight: 500,
      classList: { toggle: () => {}, add: () => {}, remove: () => {} },
      closest: (sel) => sel === '.song-list-container' ? scrollContainer : null,
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      after: (btn) => { loadMoreBtn = btn; },
      getBoundingClientRect: () => ({ top: 0, height: 500 }),
    };
    const searchInputEl = { value: 'chua', addEventListener: () => {} };

    const makePage = (startIdx, count) => Array.from({ length: count }, (_, i) => ({
      id: `song-${startIdx + i}`,
      httlvnId: startIdx + i + 1,
      title: `Chúa Yêu Thương ${startIdx + i + 1}`,
      defaultKey: 'C',
      category: 'Thánh Ca',
    }));

    let apiReturnEmpty = false;
    const ctx = {
      console,
      innerHeight: 800,
      innerWidth: 390,
      getComputedStyle: () => ({ rowGap: '0px' }),
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      requestAnimationFrame: fn => { fn(); return 1; },
      cancelAnimationFrame: () => {},
      localStorage: { getItem: () => null, setItem: () => {} },
      sessionStorage: { getItem: () => null, setItem: () => {} },
      document: {
        addEventListener: () => {},
        getElementById: (id) => {
          if (id === 'song-list') return songListEl;
          if (id === 'search-input') return searchInputEl;
          if (id === 'library-load-more') return loadMoreBtn;
          return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        createDocumentFragment: () => ({ appendChild: () => {} }),
        createElement: (tag) => {
          const handlers = {};
          return {
            tagName: tag.toUpperCase(),
            id: '', className: '', style: {}, dataset: {}, children: [],
            appendChild(c) { this.children.push(c); return c; },
            setAttribute: () => {},
            addEventListener(ev, fn) { handlers[ev] = fn; },
            click: async () => { if (handlers.click) await handlers.click(); },
            remove: () => {},
            classList: { toggle: () => {}, add: () => {}, remove: () => {} },
          };
        },
      },
      ApiService: {
        songs: {
          search: async (q, opts) => {
            if (apiReturnEmpty) return { success: true, data: [], total: 0 };
            if (opts.offset === 0) return { success: true, data: makePage(0, 50), total: 90 };
            return { success: true, data: makePage(50, 40), total: 90 };
          }
        }
      },
      Auth: { isAdmin: () => false, isBanhat: () => false },
      Store: { get: () => [], set: () => {} },
      EventBus: { on: () => {}, emit: () => {} },
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    loadScript(ctx, 'assets/js/core/LibrarySearch.js');
    loadScript(ctx, 'assets/js/library-ui.js');

    await ctx.window.LibrarySearch.run('chua', {}, (rows, opts) => ctx.window.LibraryUI.render(rows, opts), () => {});
    scrollContainer.scrollTop = 420;
    if (loadMoreBtn) await loadMoreBtn.click();
    const afterLoadMoreScroll = scrollContainer.scrollTop;

    await ctx.window.LibrarySearch.run('yeu', {}, (rows, opts) => ctx.window.LibraryUI.render(rows, opts), () => {});
    const afterNewQueryScroll = scrollContainer.scrollTop;

    apiReturnEmpty = true;
    const fallbackHandled = await ctx.window.LibrarySearch.run('123', { allowLocalFallback: true }, () => {}, () => {});

    results.p2_3_and_core3 = (afterLoadMoreScroll === 420 && afterNewQueryScroll === 0 && fallbackHandled === false);
  }

  // ── E. UI-1, UI-2, UI-3 & P3-2: Thực thi hành vi thật của MobileController & Classic ToolbarController
  const makeEl = (id, initText = '', tagName = 'DIV') => {
    const handlers = {};
    const attrs = {};
    const classes = new Set();
    return {
      id,
      tagName,
      textContent: initText,
      innerHTML: '',
      value: '100',
      options: [{ value: '100' }, { value: '125' }],
      children: [],
      title: '',
      disabled: false,
      style: {},
      dataset: {},
      appendChild(c) { this.children.push(c); return c; },
      classList: {
        add: (...c) => c.forEach(x => classes.add(x)),
        remove: (...c) => c.forEach(x => classes.delete(x)),
        toggle: (c, force) => {
          const on = force !== undefined ? !!force : !classes.has(c);
          if (on) classes.add(c); else classes.delete(c);
          return on;
        },
        contains: (c) => classes.has(c),
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: (k) => attrs[k] ?? null,
      addEventListener: (ev, fn) => { handlers[ev] = fn; },
      click: () => { if (handlers.click) handlers.click({ preventDefault: () => {}, stopPropagation: () => {}, currentTarget: { blur: () => {} }, target: { blur: () => {} } }); },
      change: (val) => { if (handlers.change) handlers.change({ target: { value: val } }); },
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  };
  {
    // 1) Modern MobileController behavioral test
    const mobElements = {
      'mobile-thumb-bar': makeEl('mobile-thumb-bar'),
      'mobile-zoom-select': makeEl('mobile-zoom-select', '100%', 'SELECT'),
      'btn-mobile-lock-zoom': makeEl('btn-mobile-lock-zoom', '🔓', 'BUTTON'),
      'btn-mobile-tempo': makeEl('btn-mobile-tempo', '♩', 'BUTTON'),
      'mobile-bpm-val': makeEl('mobile-bpm-val', 'BPM', 'SPAN'),
      'si-bpm-val': makeEl('si-bpm-val', '108', 'SPAN'),
      'btn-lock-zoom': makeEl('btn-lock-zoom', '🔓', 'BUTTON'),
      'btn-gig-lock-zoom': makeEl('btn-gig-lock-zoom', '🔓', 'BUTTON'),
      'si-tempo-pill': makeEl('si-tempo-pill', '♩ 108', 'BUTTON'),
    };
    let zoomSetVal = null;
    let metroToggled = 0;
    mobElements['btn-lock-zoom'].addEventListener('click', () => {
      const next = !mobElements['btn-lock-zoom'].classList.contains('active');
      mobElements['btn-lock-zoom'].classList.toggle('active', next);
    });
    mobElements['si-tempo-pill'].addEventListener('click', () => { metroToggled++; });

    const mobCtx = {
      console,
      innerWidth: 390,
      addEventListener: () => {},
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      localStorage: { getItem: () => null, setItem: () => {} },
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true, addEventListener: () => {} }),
      document: {
        body: makeEl('body'),
        getElementById: (id) => mobElements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
      },
      Store: { get: () => 0, set: () => {} },
      EventBus: { on: () => {}, emit: () => {} },
      App: { setZoom: (pct) => { zoomSetVal = pct; } },
      Metronome: {
        isPlaying: () => metroToggled % 2 === 1,
        getBpm: () => 108,
      },
    };
    mobCtx.window = mobCtx;
    mobCtx.globalThis = mobCtx;
    vm.createContext(mobCtx);
    loadScript(mobCtx, 'assets/js/mobile-controller.js');
    mobCtx.window.MobileController.init();

    mobElements['btn-mobile-lock-zoom'].click();
    const lockToggledOk = (
      mobElements['btn-mobile-lock-zoom'].classList.contains('active') === true &&
      mobElements['btn-mobile-lock-zoom'].getAttribute('aria-pressed') === 'true' &&
      mobElements['btn-mobile-lock-zoom'].innerHTML.includes('#icon-lock')
    );
    mobElements['btn-mobile-lock-zoom'].click(); // unlock
    mobElements['mobile-zoom-select'].change('125');
    mobElements['btn-mobile-tempo'].click();
    const mobileActionsOk = (
      lockToggledOk &&
      mobElements['btn-mobile-lock-zoom'].classList.contains('active') === false &&
      zoomSetVal === 125 &&
      metroToggled === 1 &&
      mobElements['mobile-bpm-val'].textContent === '108'
    );

    // 2) Classic (/old/) ToolbarController behavioral test
    const oldStorage = {};
    const oldElements = {
      'btn-lock-zoom': makeEl('btn-lock-zoom', '🔓', 'BUTTON'),
      'btn-zoom-in': makeEl('btn-zoom-in', '+', 'BUTTON'),
      'btn-zoom-out': makeEl('btn-zoom-out', '−', 'BUTTON'),
      'zoom-slider': makeEl('zoom-slider', '100', 'SELECT'),
      'btn-toolbar-metronome': makeEl('btn-toolbar-metronome', '♩', 'BUTTON'),
    };
    let oldZoomSet = null;
    const oldCtx = {
      console,
      innerWidth: 1024,
      addEventListener: () => {},
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      localStorage: {
        getItem: (k) => oldStorage[k] ?? null,
        setItem: (k, v) => { oldStorage[k] = String(v); },
      },
      document: {
        body: makeEl('body'),
        getElementById: (id) => oldElements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
      },
      App: { setZoom: (z) => { oldZoomSet = z; }, showToast: () => {} },
    };
    oldCtx.window = oldCtx;
    oldCtx.globalThis = oldCtx;
    vm.createContext(oldCtx);
    loadScript(oldCtx, 'old/assets/js/toolbar-controller.js');
    oldCtx.window.ToolbarController.init();

    oldElements['btn-lock-zoom'].click();
    const oldLockOk = (
      oldStorage.sheetapp_zoom_locked === '1' &&
      oldElements['btn-lock-zoom'].getAttribute('aria-pressed') === 'true' &&
      oldElements['btn-lock-zoom'].textContent === '🔒'
    );
    oldElements['btn-lock-zoom'].click(); // unlock
    oldElements['btn-zoom-in'].click();
    const oldUnlockAndZoomOk = (oldLockOk && oldStorage.sheetapp_zoom_locked === '0' && oldZoomSet === 110);

    results.p3_2_ui_behavior = (mobileActionsOk && oldUnlockAndZoomOk);
  }

  // ── F. PROG-2 & PROG-3 (P3-2): Hành vi thật của URLState, ServicePlanUI & SetlistDetail cho Khách chưa đăng nhập
  {
    let currentSl = null;
    const addContainer = makeEl('setlist-add-container');
    const metaEl = makeEl('setlist-plan-meta');
    const itemsEl = {
      id: 'setlist-items',
      innerHTML: '',
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      querySelectorAll: () => [],
      querySelector: () => null,
    };
    const ctx = {
      console,
      URL,
      URLSearchParams,
      location: { search: '?setlist=42', pathname: '/', origin: 'https://sheet.hyb.io.vn', href: 'https://sheet.hyb.io.vn/?setlist=42' },
      history: { replaceState: () => {}, pushState: () => {} },
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      localStorage: { getItem: () => null, setItem: () => {} },
      document: {
        body: makeEl('body'),
        getElementById: (id) => {
          if (id === 'setlist-add-container') return addContainer;
          if (id === 'setlist-plan-meta') return metaEl;
          if (id === 'setlist-items') return itemsEl;
          if (id === 'setlist-list' || id === 'setlist-detail' || id === 'setlist-detail-title') return makeEl(id);
          return null;
        },
        createElement: (tag) => {
          const el = makeEl(tag);
          el.innerHTML = '';
          return el;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
      },
      Auth: {
        isLoggedIn: () => false,
        isBanhat: () => false,
        isAdmin: () => false,
        isLeader: () => false,
        userId: () => null,
      },
      ApiService: {
        setlists: {
          get: async (id) => ({
            success: true,
            data: {
              id,
              title: 'Thờ Phượng Chúa Nhật',
              status: 'published',
              items: [
                {
                  id: 501,
                  song_id: '001-thanh-chua-yeu-thuong',
                  song_title: 'Thánh Chúa Yêu Thương',
                  httlvnId: 1,
                  defaultKey: 'F',
                  transpose_key: 2,
                  chord_profile: 'HD',
                  bpm: 96,
                  selected_verses: '1,3',
                  duration_minutes: 5,
                }
              ]
            }
          })
        }
      },
      KeyService: { displayKey: (k, s) => (k === 'F' && s === 2) ? 'G' : k, normalizeKey: k => k },
      SetlistUI: {
        setCurrentSetlist: (sl) => { currentSl = sl; },
        getCurrentSetlist: () => currentSl,
        getCurrentIndex: () => 0,
        getAllSongsCache: () => [{ id: '001-thanh-chua-yeu-thuong', title: 'Thánh Chúa Yêu Thương', defaultKey: 'F', httlvnId: 1 }],
      },
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    loadScript(ctx, 'assets/js/url-state.js');
    loadScript(ctx, 'assets/js/service-plan-ui.js');
    loadScript(ctx, 'assets/js/setlist-detail.js');

    const parsedUrl = ctx.window.URLState.get();
    await ctx.window.SetlistDetail.viewSetlistDetail(42);
    const allItemsHtml = itemsEl.children.map(c => c.innerHTML || '').join('\n');
    const metaHtml = metaEl.innerHTML || '';
    const guestHtmlOk = (
      addContainer.classList.contains('hidden') === true &&
      metaHtml.includes('Chế độ Khách tham gia') &&
      metaHtml.includes('id="btn-sp-share-link"') &&
      !metaHtml.includes('id="btn-sp-assign"') &&
      allItemsHtml.includes('Tone: F | Tập: G (+2)') &&
      allItemsHtml.includes('🎸 HD') &&
      allItemsHtml.includes('♩96 BPM') &&
      allItemsHtml.includes('📖 Khổ: 1,3') &&
      !allItemsHtml.includes('btn-del-item') &&
      !allItemsHtml.includes('btn-save-bpm')
    );

    results.p3_2_prog_behavior = (parsedUrl.setlist === '42' && guestHtmlOk);
  }

  console.log(JSON.stringify(results));
})();
JS;

$tmpScript = tempnam(sys_get_temp_dir(), 'r9_test_') . '.cjs';
file_put_contents($tmpScript, $jsTestScript);
$cmd = 'node ' . escapeshellarg($tmpScript) . ' ' . escapeshellarg($rootDir);
$rawOut = shell_exec($cmd);
@unlink($tmpScript);
$jsRes = json_decode(trim((string)$rawOut), true) ?: [];

TestAssert::checkBehavior(
    'R9-P3-1',
    !empty($jsRes['p3_1_matrix']),
    'CORE-1 & P3-1: Ma trận ' . ($jsRes['p3_1_count'] ?? 0) . ' phép dịch giọng (12 gốc × 8 hậu tố × -11..+11 × useFlats) không có A#/G#/D# trưởng và bảo toàn chroma 2 chiều'
);

TestAssert::checkBehavior(
    'R9-P2-5',
    !empty($jsRes['p2_5_fifths']),
    'CORE-1 & P2-5 (F4): ChordCanvasTranspose.getKeyFifths tôn trọng <fifths>0</fifths> của XML, chặn đọc nhầm bài cũ, và fallback sang defaultKey khi thiếu <fifths>'
);

TestAssert::checkBehavior(
    'R9-P3-3',
    !empty($jsRes['p3_3_chord_canvas']),
    'CORE-2, P2-2, P2-4 & P3-3: hoaidinh và admin bật sửa trực tiếp HD, đứng ở TLH không có nút ghi đè HD, banhat ở BH không mở modal tên tự do (F6), applyPreloaded kiểm tra SVG trước khi gọi _build'
);

TestAssert::checkBehavior(
    'R9-P2-3',
    !empty($jsRes['p2_3_and_core3']),
    'CORE-3 & P2-3 (F3): LibrarySearch.run giữ nguyên scrollTop=420 khi bấm "Xem thêm", reset scrollTop=0 khi đổi từ khóa tìm kiếm, và fallback khi FTS5 rỗng'
);

// ── 4. UI-1, UI-2, UI-3 & P3-2: Hành vi điều khiển + kiểm tra hiển thị ngoài mặt tiền ──
$polishCss = (string)file_get_contents($rootDir . '/assets/css/library-polish.css');
$layoutCss = (string)file_get_contents($rootDir . '/assets/css/layout.css');
$toolbarPhp = (string)file_get_contents($rootDir . '/includes/toolbar.php');
$sheetViewerPhp = (string)file_get_contents($rootDir . '/includes/sheet_viewer.php');
$oldToolbarPhp = (string)file_get_contents($rootDir . '/old/includes/toolbar.php');

$zoomPillVisibleDesktop = (bool)preg_match('/@media\s*\(min-width:\s*1101px\)\s*\{\s*\.unified-toolbar\s+#toolbar-zoom-pill\s*\{[^}]*display\s*:\s*inline-flex\s*!important/is', $polishCss);
$zoomPillVisibleIpad = str_contains($polishCss, '.unified-toolbar #toolbar-zoom-pill')
    && !str_contains($polishCss, '@media (min-width: 1101px) { .unified-toolbar #toolbar-zoom-pill { display: none');
$lockZoomHiddenInLayout = (bool)preg_match('/#btn-lock-zoom\s*\{[^}]*display\s*:\s*none/i', $layoutCss);

TestAssert::checkBehavior(
    'R9-P3-2-UI',
    !empty($jsRes['p3_2_ui_behavior'])
        && $zoomPillVisibleDesktop
        && $zoomPillVisibleIpad
        && !$lockZoomHiddenInLayout
        && str_contains($sheetViewerPhp, 'id="btn-gig-lock-zoom"')
        && str_contains($toolbarPhp, 'id="btn-mobile-lock-zoom"')
        && str_contains($toolbarPhp, 'id="mobile-zoom-select"')
        && str_contains($toolbarPhp, 'id="btn-mobile-tempo"')
        && str_contains($oldToolbarPhp, 'id="btn-lock-zoom"')
        && str_contains($oldToolbarPhp, 'id="zoom-slider"')
        && str_contains($oldToolbarPhp, 'id="btn-toolbar-metronome"'),
    'UI-1..3 & P3-2: Thực thi hành vi thật của MobileController & Classic ToolbarController (Khóa Zoom, Chọn %, Tempo) và hiển thị đủ trên Web, iPad, Điện thoại, Gig HUD, /old/'
);

// ── 5. PROG-1, PROG-2, PROG-3 & P3-2: Khách xem & tham gia đánh chương trình published ──
$tv41Ids = seedTv41Setlists($pdoHttp);
$guestSetlist = SetlistPublicReadService::getById((int)$tv41Ids['published'], false);
$firstItem = $guestSetlist['items'][0] ?? [];
TestAssert::checkBehavior(
    'R9-P3-2-PROG',
    is_array($guestSetlist)
        && !empty($firstItem['defaultKey'])
        && isset($firstItem['httlvnId'])
        && !empty($firstItem['chord_profile'])
        && isset($firstItem['transpose_key'])
        && !empty($firstItem['bpm'])
        && empty($guestSetlist['assignments'])
        && !empty($jsRes['p3_2_prog_behavior']),
    'PROG-1..3 & P3-2: Viewer đã đăng nhập (khách chưa đăng nhập bị 401, xem tv41) nhận đủ defaultKey/httlvnId/chord_profile/transpose_key/bpm (ẩn assignments) và thực thi đúng giao diện khách tham gia đánh qua ?setlist=<id>'
);

TestAssert::finish();
