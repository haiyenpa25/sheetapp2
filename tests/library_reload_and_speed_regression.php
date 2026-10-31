<?php
declare(strict_types=1);
/**
 * Thư viện "hay bị lỗi tải lại, tải rất lâu" (2026-10-30):
 *  - SW mới không tự reload trang; cập nhật chỉ tải file đổi hash (không tải lại ~150 file).
 *  - Toast "Đã xảy ra lỗi · Tải lại" không hiện cho lỗi ngoài app (Zalo, mạng, huỷ request).
 *  - Watchdog không báo "chưa tải xong" khi trang còn đang tải trên mạng chậm.
 *  - Khách không gọi API chương trình (401 đỏ), Classic không hiện nút Quản lý cho khách.
 */
$root = dirname(__DIR__);
$failed = 0; $total = 0;
function check(string $label, bool $ok): void {
    global $failed, $total;
    $total++;
    echo ($ok ? '[PASS:B] ' : '[FAIL:B] ') . $label . "\n";
    if (!$ok) $failed++;
}
function read(string $path): string { global $root; return (string)file_get_contents("$root/$path"); }

$sw = read('sw.js');
check('sw.js có bảng hash từng file', (bool)preg_match('/const PRECACHE_FILE_HASH = \{"\/assets\/js\/[^"]+":"[a-f0-9]{8}"/', $sw));
check('sw.js dùng lại bản cache cũ khi hash không đổi', str_contains($sw, 'previous.headers?.get?.(SW_HASH_HEADER) === hash'));
check('sw.js chống cache theo hash từng file (CDN giữ được)', str_contains($sw, "'swv=' + (hash || SW_MANIFEST_HASH)"));
check('sw.js giữ ngân sách < 600 dòng', substr_count($sw, "\n") < 600);
exec('php ' . escapeshellarg("$root/tools/generate_sw_manifest.php") . ' --check 2>&1', $out, $code);
check('sw.js khớp manifest', $code === 0);

$swm = read('assets/js/core/ServiceWorkerManager.js');
check('ServiceWorkerManager không còn location.reload()', !str_contains($swm, 'location?.reload') && !str_contains($swm, 'location.reload'));

$node = <<<'JS'
const fs = require('fs'), vm = require('vm');
const root = process.argv[2];
const out = {};
function makeDoc() {
  const nodes = [];
  return { nodes, readyState: 'loading', body: { appendChild(n) { nodes.push(n); } }, documentElement: {},
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, set textContent(v) {} }),
    getElementById: id => nodes.find(n => n.id === id) || null, addEventListener() {} };
}
// ErrorReporter
{
  const doc = makeDoc();
  const win = { location: { href: 'https://sheet.hyb.io.vn/', origin: 'https://sheet.hyb.io.vn' }, ApiService: { reportError: () => Promise.resolve() } };
  const ctx = vm.createContext({ window: win, document: doc, URL, Date, console });
  vm.runInContext(fs.readFileSync(root + '/assets/js/core/ErrorReporter.js', 'utf8'), ctx);
  const toasts = () => doc.nodes.filter(n => n.id === 'error-reporter-toast').length;
  win.onerror("ReferenceError: Can't find variable: zaloJSV2", 'https://sheet.hyb.io.vn/?zarsrc=30', 1, 1, null);
  win.onerror('Script error.', '', 0, 0, null);
  win.onunhandledrejection({ reason: Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }) });
  win.onunhandledrejection({ reason: new TypeError('Failed to fetch') });
  out.noiseToasts = toasts();
  win.onerror('TypeError: x is undefined', 'https://sheet.hyb.io.vn/assets/js/library-ui.js?v=1', 10, 2, new TypeError('x'));
  out.appToasts = toasts();
}
// BootRunner watchdog
{
  const doc = makeDoc();
  const timers = [];
  const win = { __failedScripts: [] };
  const ctx = vm.createContext({ window: win, document: doc, Date, console, setTimeout: (fn, ms) => { timers.push(fn); return timers.length; }, clearTimeout() {} });
  vm.runInContext(fs.readFileSync(root + '/assets/js/core/BootRunner.js', 'utf8'), ctx);
  timers.shift()();                       // 8s: trang còn đang tải
  out.bannerWhileDownloading = !!doc.getElementById('boot-watchdog-banner');
  out.rearmed = timers.length === 1;
  doc.readyState = 'complete';
  timers.shift()();                       // đã tải xong mà app chưa sẵn sàng → báo
  out.bannerWhenStuck = !!doc.getElementById('boot-watchdog-banner');
}
console.log(JSON.stringify(out));
JS;
$tmp = tempnam(sys_get_temp_dir(), 'reload-test-') . '.cjs';
file_put_contents($tmp, $node);
$res = json_decode((string)shell_exec('node ' . escapeshellarg($tmp) . ' ' . escapeshellarg($root) . ' 2>&1'), true) ?: [];
@unlink($tmp);
check('ErrorReporter: lỗi Zalo / Script error / AbortError / mất mạng KHÔNG hiện toast Tải lại', ($res['noiseToasts'] ?? -1) === 0);
check('ErrorReporter: lỗi thật trong mã app vẫn hiện toast', ($res['appToasts'] ?? 0) === 1);
check('Watchdog: mạng chậm (trang còn đang tải) không báo lỗi, tự chờ thêm', ($res['bannerWhileDownloading'] ?? true) === false && ($res['rearmed'] ?? false) === true);
check('Watchdog: tải xong mà app không chạy thì vẫn báo', ($res['bannerWhenStuck'] ?? false) === true);

$lib = read('assets/js/library-ui.js');
check('Thư viện: khách không gọi API chương trình (hết 401 đỏ)', str_contains($lib, "if (!window.Auth?.isLoggedIn?.()) { sec.classList.add('hidden');"));
check('Thư viện: đăng nhập xong thì tải lại chương trình sắp tới', str_contains($lib, "'auth:changed', () => { _buildUpcomingSetlist(); }"));
check('Classic: nút Quản lý ẩn với khách', str_contains(read('old/assets/css/ui-scale.css'), 'body:not(.has-member-access) #btn-sidebar-manager'));
check('Thư viện điện thoại rộng gần hết màn hình (cả hai giao diện)', str_contains(read('assets/css/library-polish.css'), 'min(440px, calc(100vw - 44px))') && str_contains(read('old/assets/css/ui-scale.css'), 'min(440px, calc(100vw - 44px))'));
foreach (['includes/toolbar.php', 'includes/app_nav.php', 'old/includes/toolbar.php'] as $f) {
    check("$f: nút đổi giao diện kiểm hàm interfaceUrl trước khi gọi", str_contains(read($f), "typeof window.URLState?.interfaceUrl === 'function'"));
}

echo $failed ? "\n$failed FAILED\n" : "\nALL PASS\n";
if (!$failed) echo "SUITE_COMPLETE total={$total}\n";
exit($failed ? 1 : 0);
