<?php
/**
 * print/chord-sheet.php
 *
 * Bản in "Lời + Hợp âm" chuyên dụng (Epic 4.3 - Quyết định D14):
 * - Hỗ trợ in qua window.print() (trình duyệt xuất PDF chuẩn A4).
 * - Render từ dữ liệu ChordPro qua ChordProService.
 * - Hỗ trợ dịch giọng (transpose), bộ hợp âm (HD/TLH), 1 cột / 2 cột.
 * - Core Rule 1: Ưu tiên bộ hợp âm HD mặc định.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/TransposeHelper.php';

$songId = trim($_GET['song'] ?? ($_GET['song_id'] ?? ($_GET['id'] ?? '')));
$chordSet = trim($_GET['set'] ?? ($_GET['chord_set'] ?? 'HD'));
if ($chordSet === '') $chordSet = 'HD';
$transpose = isset($_GET['t']) ? (int)$_GET['t'] : (isset($_GET['transpose']) ? (int)$_GET['transpose'] : 0);
$transpose = max(-12, min(12, $transpose));
$cols = isset($_GET['cols']) ? (int)$_GET['cols'] : 1;
if ($cols !== 2) $cols = 1;
$showChords = !isset($_GET['chords']) || $_GET['chords'] !== '0';

if ($songId === '') {
    echo '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Lỗi in ấn</title>';
    echo '<style>body{font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;}</style></head>';
    echo '<body><h2>Không tìm thấy bài hát cần in</h2><p>Vui lòng cung cấp tham số <code>song</code> trên thanh địa chỉ.</p></body></html>';
    exit;
}

try {
    $chordProContent = ChordProService::export($songId, $chordSet, $transpose);
} catch (Throwable $e) {
    echo '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Lỗi xuất bài hát</title>';
    echo '<style>body{font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;}</style></head>';
    echo '<body><h2>Lỗi nạp bài hát</h2><p>' . htmlspecialchars($e->getMessage()) . '</p></body></html>';
    exit;
}

// Bóc tách metadata từ ChordPro
$title = $songId;
$composer = '';
$origKey = '';
$practicedKey = '';
$tempo = '';
$timeSig = '';

if (preg_match('/\{title:\s*([^}]+)\}/iu', $chordProContent, $m)) $title = trim($m[1]);
if (preg_match('/\{composer:\s*([^}]+)\}/iu', $chordProContent, $m)) $composer = trim($m[1]);
if (preg_match('/\{key:\s*([^}]+)\}/iu', $chordProContent, $m)) $practicedKey = trim($m[1]);
if (preg_match('/\{tempo:\s*([^}]+)\}/iu', $chordProContent, $m)) $tempo = trim($m[1]);
if (preg_match('/\{time:\s*([^}]+)\}/iu', $chordProContent, $m)) $timeSig = trim($m[1]);

// Tính tông gốc nếu có transpose
if ($transpose !== 0 && $practicedKey !== '') {
    $origKey = TransposeHelper::transpose($practicedKey, -$transpose);
} else {
    $origKey = $practicedKey;
}

/**
 * Phân tích dòng văn bản ChordPro có dạng `[Chord]lyric` thành HTML
 */
function renderChordProLine(string $line, bool $showChords = true): string {
    $trimmed = trim($line);
    if ($trimmed === '') return '<div class="line empty-line">&nbsp;</div>';

    // Regex tìm các khối [Chord] và phần lyric sau nó
    // Mẫu: ([Chord])?([^\[]+)
    $pattern = '/(?:\[([^\]]+)\])?([^\[]+)/u';
    if (!preg_match_all($pattern, $line, $matches, PREG_SET_ORDER)) {
        return '<div class="line"><span class="lyric-only">' . htmlspecialchars($line) . '</span></div>';
    }

    $out = '<div class="line">';
    foreach ($matches as $match) {
        $chord = trim($match[1] ?? '');
        $lyric = $match[2] ?? '';

        if ($showChords) {
            $chordHtml = $chord !== '' ? '<span class="chord">' . htmlspecialchars($chord) . '</span>' : '<span class="chord chord-spacer">&nbsp;</span>';
            $lyricHtml = '<span class="lyric">' . htmlspecialchars($lyric) . '</span>';
            $out .= '<span class="chord-pair">' . $chordHtml . $lyricHtml . '</span>';
        } else {
            $out .= '<span class="lyric">' . htmlspecialchars($lyric) . '</span>';
        }
    }
    $out .= '</div>';
    return $out;
}

// Phân tách ChordPro theo từng section (verse, chorus, bridge)
$rawLines = explode("\n", $chordProContent);
$sections = [];
$currentSection = ['type' => 'intro', 'name' => '', 'lines' => []];

foreach ($rawLines as $l) {
    $trimmed = trim($l);
    if (str_starts_with($trimmed, '{start_of_verse') || str_starts_with($trimmed, '{sov')) {
        if (!empty($currentSection['lines'])) $sections[] = $currentSection;
        $label = 'Lời hát';
        if (preg_match('/\{start_of_verse:\s*([^}]+)\}/iu', $trimmed, $sm)) $label = trim($sm[1]);
        $currentSection = ['type' => 'verse', 'name' => $label, 'lines' => []];
        continue;
    }
    if (str_starts_with($trimmed, '{end_of_verse') || str_starts_with($trimmed, '{eov')) {
        $sections[] = $currentSection;
        $currentSection = ['type' => 'body', 'name' => '', 'lines' => []];
        continue;
    }
    if (str_starts_with($trimmed, '{start_of_chorus') || str_starts_with($trimmed, '{soc')) {
        if (!empty($currentSection['lines'])) $sections[] = $currentSection;
        $label = 'Điệp khúc';
        if (preg_match('/\{start_of_chorus:\s*([^}]+)\}/iu', $trimmed, $sm)) $label = trim($sm[1]);
        $currentSection = ['type' => 'chorus', 'name' => $label, 'lines' => []];
        continue;
    }
    if (str_starts_with($trimmed, '{end_of_chorus') || str_starts_with($trimmed, '{eoc')) {
        $sections[] = $currentSection;
        $currentSection = ['type' => 'body', 'name' => '', 'lines' => []];
        continue;
    }
    if (str_starts_with($trimmed, '{start_of_bridge') || str_starts_with($trimmed, '{sob')) {
        if (!empty($currentSection['lines'])) $sections[] = $currentSection;
        $label = 'Bridge';
        if (preg_match('/\{start_of_bridge:\s*([^}]+)\}/iu', $trimmed, $sm)) $label = trim($sm[1]);
        $currentSection = ['type' => 'bridge', 'name' => $label, 'lines' => []];
        continue;
    }
    if (str_starts_with($trimmed, '{end_of_bridge') || str_starts_with($trimmed, '{eob')) {
        $sections[] = $currentSection;
        $currentSection = ['type' => 'body', 'name' => '', 'lines' => []];
        continue;
    }
    // Bỏ qua các directives metadata
    if (preg_match('/^\{(?:title|composer|key|tempo|time|artist):/i', $trimmed)) {
        continue;
    }
    if (str_starts_with($trimmed, '{comment:') || str_starts_with($trimmed, '{c:')) {
        if (preg_match('/\{c(?:omment)?:\s*([^}]+)\}/i', $trimmed, $cm)) {
            $currentSection['lines'][] = ['is_comment' => true, 'text' => trim($cm[1])];
        }
        continue;
    }

    if ($trimmed !== '') {
        $currentSection['lines'][] = ['is_comment' => false, 'text' => $trimmed];
    }
}
if (!empty($currentSection['lines'])) {
    $sections[] = $currentSection;
}

$pageTitle = htmlspecialchars($title) . ' — Lời & Hợp âm';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $pageTitle ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="chord-sheet.css?v=2.2.0">
  <style>
    @media print {
      .control-bar, .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Thanh điều khiển hiển thị trên màn hình -->
  <div class="control-bar no-print">
    <div class="ctrl-group">
      <a href="javascript:window.close()" class="btn" title="Đóng trang in">✕ Đóng</a>
      <button onclick="window.print()" class="btn btn-primary" title="In ra máy in hoặc Lưu dưới dạng file PDF (Ctrl+P)">
        🖨️ In / Xuất PDF
      </button>
      <a href="../api/index.php?route=export&format=chordpro&song_id=<?= urlencode($songId) ?>&set=<?= urlencode($chordSet) ?>&transpose=<?= $transpose ?>&download=1" class="btn" title="Tải file định dạng .chordpro">
        ⬇ Tải .chordpro
      </a>
    </div>

    <div class="ctrl-group">
      <!-- Cỡ chữ -->
      <span style="font-size:12px;color:#64748b;">Cỡ chữ:</span>
      <button class="btn" onclick="changeFontSize(-1)" title="Thu nhỏ chữ">A-</button>
      <button class="btn" onclick="changeFontSize(1)" title="Phóng to chữ">A+</button>

      <!-- 1 cột / 2 cột -->
      <button class="btn" onclick="toggleColumns()" id="btn-toggle-cols" title="Chuyển đổi 1 cột hoặc 2 cột cho bài dài">
        <?= $cols === 2 ? '📄 1 Cột' : '📖 2 Cột' ?>
      </button>

      <!-- Bật / Tắt Hợp âm -->
      <button class="btn" onclick="toggleChords()" title="Bật hoặc ẩn dòng hợp âm (chỉ in lời)">
        <?= $showChords ? '🎸 Ẩn hợp âm' : '🎸 Hiện hợp âm' ?>
      </button>

      <!-- Dịch giọng tức thì -->
      <div style="display:flex;align-items:center;gap:4px;margin-left:8px;">
        <span style="font-size:12px;color:#64748b;">Tông:</span>
        <button class="btn" onclick="changeTranspose(-1)" title="Hạ 1 bán âm">-1</button>
        <span class="badge-info"><?= htmlspecialchars($practicedKey) ?> (<?= $transpose >= 0 ? "+{$transpose}" : $transpose ?>)</span>
        <button class="btn" onclick="changeTranspose(1)" title="Tăng 1 bán âm">+1</button>
      </div>

      <!-- Chọn bộ hợp âm HD / TLH -->
      <select onchange="changeProfile(this.value)" class="btn" style="padding:5px 8px;" title="Chọn bộ hợp âm ưu tiên">
        <option value="HD" <?= $chordSet === 'HD' ? 'selected' : '' ?>>⭐ Bộ HD</option>
        <option value="default" <?= $chordSet === 'default' ? 'selected' : '' ?>>Bộ TLH (Gốc)</option>
      </select>
    </div>
  </div>

  <!-- Nội dung trang in -->
  <main class="sheet-wrapper" id="sheet-content">
    <header class="song-header">
      <h1 class="song-title"><?= htmlspecialchars($title) ?></h1>
      <div class="song-meta-strip">
        <div class="meta-pills">
          <span class="meta-pill">Tông hát: <strong><?= htmlspecialchars($practicedKey) ?></strong></span>
          <?php if ($origKey !== $practicedKey): ?>
            <span class="meta-pill">Tông gốc: <strong><?= htmlspecialchars($origKey) ?></strong> (<?= $transpose >= 0 ? "+{$transpose}" : $transpose ?>)</span>
          <?php endif; ?>
          <?php if ($tempo !== ''): ?>
            <span class="meta-pill">Tốc độ: <strong>♩ = <?= htmlspecialchars($tempo) ?> BPM</strong></span>
          <?php endif; ?>
          <?php if ($timeSig !== ''): ?>
            <span class="meta-pill">Nhịp: <strong><?= htmlspecialchars($timeSig) ?></strong></span>
          <?php endif; ?>
          <span class="meta-pill">Bộ hợp âm: <strong><?= ($chordSet === 'default' || $chordSet === 'TLH') ? 'TLH' : htmlspecialchars($chordSet) ?></strong></span>
        </div>
        <?php if ($composer !== ''): ?>
          <div class="composer" style="font-style:italic;">Tác giả: <?= htmlspecialchars($composer) ?></div>
        <?php endif; ?>
      </div>
    </header>

    <div class="sections-container <?= $cols === 2 ? 'two-columns' : '' ?>" id="sections-container">
      <?php foreach ($sections as $sec): ?>
        <?php
          $secClass = 'section-block';
          if ($sec['type'] === 'chorus') $secClass .= ' section-chorus';
          if ($sec['type'] === 'bridge') $secClass .= ' section-bridge';
        ?>
        <div class="<?= $secClass ?>">
          <?php if (!empty($sec['name'])): ?>
            <div class="section-heading"><?= htmlspecialchars($sec['name']) ?></div>
          <?php endif; ?>

          <?php foreach ($sec['lines'] as $lineItem): ?>
            <?php if (!empty($lineItem['is_comment'])): ?>
              <div class="comment-line"><span class="comment-bullet">●</span> <?= htmlspecialchars($lineItem['text'] ?? '') ?></div>
            <?php else: ?>
              <?= renderChordProLine($lineItem['text'], $showChords) ?>
            <?php endif; ?>
          <?php endforeach; ?>
        </div>
      <?php endforeach; ?>
    </div>

    <footer class="sheet-footer">
      <span>Thánh Ca Hội Thánh — SheetApp Thờ Phượng</span>
      <span>In ngày: <?= date('d/m/Y H:i') ?></span>
    </footer>
  </main>

  <script>
    let currentFontSize = 15;

    function changeFontSize(delta) {
      currentFontSize = Math.max(11, Math.min(22, currentFontSize + delta));
      document.documentElement.style.setProperty('--font-size', currentFontSize + 'px');
      try { localStorage.setItem('sheetapp_print_fontsize', currentFontSize); } catch(e){}
    }

    function toggleColumns() {
      const url = new URL(window.location.href);
      const cur = url.searchParams.get('cols') === '2' ? '1' : '2';
      url.searchParams.set('cols', cur);
      window.location.href = url.toString();
    }

    function toggleChords() {
      const url = new URL(window.location.href);
      const cur = url.searchParams.get('chords') === '0' ? '1' : '0';
      url.searchParams.set('chords', cur);
      window.location.href = url.toString();
    }

    function changeTranspose(delta) {
      const url = new URL(window.location.href);
      const cur = parseInt(url.searchParams.get('t') || url.searchParams.get('transpose') || '0', 10);
      url.searchParams.set('t', cur + delta);
      window.location.href = url.toString();
    }

    function changeProfile(val) {
      const url = new URL(window.location.href);
      url.searchParams.set('set', val);
      window.location.href = url.toString();
    }

    // Tự động nạp cỡ chữ đã lưu trước đó nếu có
    try {
      const savedFs = parseInt(localStorage.getItem('sheetapp_print_fontsize') || '', 10);
      if (savedFs && savedFs >= 11 && savedFs <= 22) {
        currentFontSize = savedFs;
        document.documentElement.style.setProperty('--font-size', currentFontSize + 'px');
      }
    } catch(e){}
  </script>
</body>
</html>
