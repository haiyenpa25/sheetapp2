<?php
/**
 * print/service-booklet.php
 *
 * Booklet Chương Trình Thờ Phượng / Tập Bài Hát Buổi Nhóm A4 (Epic 4.3 - Quyết định D14):
 * - Trang 1: Bìa & Thứ tự chương trình thờ phượng (Order of Service).
 * - Trang 2+: Từng bài hát kèm Lời & Hợp âm chuẩn theo tông, BPM, profile của Setlist (Core Rule 4).
 * - Xuất bản chuẩn A4 qua window.print(), hỗ trợ 1 cột / 2 cột, ngắt trang thông minh.
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/services/SetlistService.php';
require_once __DIR__ . '/../api/services/ChordProService.php';
require_once __DIR__ . '/../api/services/SongService.php';
require_once __DIR__ . '/../api/services/TransposeHelper.php';

$setlistId = isset($_GET['setlist_id']) ? (int)$_GET['setlist_id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);
$cols = isset($_GET['cols']) ? (int)$_GET['cols'] : 1;
if ($cols !== 2) $cols = 1;
$includeCover = !isset($_GET['cover']) || $_GET['cover'] !== '0';
$showChords = !isset($_GET['chords']) || $_GET['chords'] !== '0';

if ($setlistId <= 0) {
    echo '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Lỗi in ấn</title>';
    echo '<style>body{font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;}</style></head>';
    echo '<body><h2>Không tìm thấy chương trình thờ phượng</h2><p>Vui lòng cung cấp tham số <code>setlist_id</code>.</p></body></html>';
    exit;
}

$setlist = SetlistService::getById($setlistId);
if (!$setlist) {
    echo '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Không tìm thấy</title>';
    echo '<style>body{font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;}</style></head>';
    echo '<body><h2>Chương trình không tồn tại hoặc đã bị xóa</h2></body></html>';
    exit;
}

$items = $setlist['items'] ?? [];
$assignments = $setlist['assignments'] ?? [];

/**
 * Render dòng ChordPro sang HTML
 */
function renderBookletChordLine(string $line, bool $showChords = true): string {
    $trimmed = trim($line);
    if ($trimmed === '') return '<div class="line empty-line">&nbsp;</div>';

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

/**
 * Phân tích bài hát thành cấu trúc sections
 */
function parseBookletSections(string $chordPro): array {
    $rawLines = explode("\n", $chordPro);
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
    return $sections;
}

$pageTitle = 'Tập chương trình thờ phượng — ' . htmlspecialchars($setlist['title']);
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
  <link rel="stylesheet" href="booklet.css?v=2.2.0">
  <style>@media print { .booklet-page { page-break-after: always; break-after: page; } }</style>
</head>
<body>

  <!-- Thanh công cụ màn hình -->
  <div class="control-bar no-print">
    <div class="ctrl-group">
      <a href="javascript:window.close()" class="btn">✕ Đóng</a>
      <button onclick="window.print()" class="btn btn-primary" title="In tập chương trình hoặc Lưu file PDF đầy đủ (Ctrl+P)">
        🖨️ In tập chương trình / Lưu PDF
      </button>
    </div>

    <div class="ctrl-group">
      <!-- Cỡ chữ -->
      <span style="font-size:12px;color:#64748b;">Cỡ chữ:</span>
      <button class="btn" onclick="changeFontSize(-1)">A-</button>
      <button class="btn" onclick="changeFontSize(1)">A+</button>

      <!-- 1 cột / 2 cột -->
      <button class="btn" onclick="toggleColumns()">
        <?= $cols === 2 ? '📄 1 Cột' : '📖 2 Cột' ?>
      </button>

      <!-- Bật / Tắt Bìa -->
      <button class="btn" onclick="toggleCover()">
        <?= $includeCover ? '📑 Bỏ trang bìa' : '📑 In kèm trang bìa' ?>
      </button>

      <!-- Bật / Tắt Hợp âm -->
      <button class="btn" onclick="toggleChords()">
        <?= $showChords ? '🎸 Ẩn hợp âm' : '🎸 Hiện hợp âm' ?>
      </button>
    </div>
  </div>

  <div class="booklet-container">

    <!-- TRANG 1: BÌA & CHƯƠNG TRÌNH THỜ PHƯỢNG (ORDER OF SERVICE) -->
    <?php if ($includeCover): ?>
      <section class="booklet-page" id="page-cover">
        <div>
          <header class="cover-header">
            <div class="cover-sub">Chương Trình Thờ Phượng</div>
            <h1 class="cover-title"><?= htmlspecialchars((string)($setlist['title'] ?? 'Chương trình')) ?></h1>
            <?php if (!empty($setlist['theme'])): ?>
              <div class="cover-theme">🏷 Chủ đề: <?= htmlspecialchars((string)$setlist['theme']) ?></div>
            <?php endif; ?>
            <div class="cover-meta">
              <span>📅 Ngày: <strong><?= htmlspecialchars((string)($setlist['scheduled_date'] ?: date('d/m/Y'))) ?></strong></span>
              <?php if (!empty($setlist['service_time'])): ?>
                <span>⏰ Giờ: <strong><?= htmlspecialchars((string)$setlist['service_time']) ?></strong></span>
              <?php endif; ?>
              <?php if (!empty($setlist['leader_name'])): ?>
                <span>👤 Trưởng ban / Hướng dẫn: <strong><?= htmlspecialchars((string)$setlist['leader_name']) ?></strong></span>
              <?php endif; ?>
            </div>
          </header>

          <!-- Phân công nhân sự -->
          <?php if (!empty($assignments)): ?>
            <div class="cover-section-title">Nhân Sự Phục Vụ Buổi Nhóm</div>
            <div class="assignments-grid">
              <?php 
              $roleLabels = [
                'pastor'           => 'Mục sư / Truyền đạo',
                'worship_leader'   => 'Hướng dẫn chương trình',
                'scripture_reader' => 'Đọc Kinh Thánh',
                'leader'           => 'Người hướng dẫn / Hát chính',
                'vocal'            => 'Hát dẫn',
                'piano'            => 'Piano / Đệm chính',
                'organ'            => 'Organ',
                'guitar'           => 'Guitar Acoustic / Solo',
                'bass'             => 'Guitar Bass',
                'drums'            => 'Trống / Bộ gõ',
                'vocal_soprano'    => 'Nữ cao (Soprano)',
                'vocal_alto'       => 'Nữ trầm (Alto)',
                'vocal_tenor'      => 'Nam cao (Tenor)',
                'vocal_bass'       => 'Nam trầm (Bass)',
                'sound'            => 'Kỹ thuật âm thanh',
                'slides'           => 'Trình chiếu / Máy chiếu',
              ];
              foreach ($assignments as $a): 
                $rLabel = $roleLabels[$a['role']] ?? $a['role'];
              ?>
                <div class="assign-card">
                  <div class="assign-role"><?= htmlspecialchars($rLabel) ?></div>
                  <div class="assign-name"><?= htmlspecialchars($a['display_name'] ?: $a['username']) ?></div>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <!-- Thứ tự chương trình -->
          <div class="cover-section-title">Thứ Tự Chi Tiết Chương Trình</div>
          <table class="program-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">STT</th>
                <th>Tiết mục / Bài hát</th>
                <th style="width: 130px; text-align: center;">Tông hát</th>
                <th style="width: 90px; text-align: center;">Tốc độ</th>
                <th style="width: 90px; text-align: center;">Bộ hợp âm</th>
                <th>Người phụ trách / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <?php $stt = 1; ?>
              <?php foreach ($items as $item): ?>
                <?php
                  $isSong = ($item['item_type'] ?? 'song') === 'song';
                  $title = $item['song_title'] ?? ($item['title'] ?? $item['song_id'] ?? 'Tiết mục');
                  $semitones = (int)($item['transpose_key'] ?? 0);
                  $semiStr = $semitones !== 0 ? ($semitones > 0 ? "+{$semitones}" : "{$semitones}") : 'Gốc';
                  $bpmStr = !empty($item['bpm']) ? "♩ = {$item['bpm']}" : '';
                  $profileStr = !empty($item['chord_profile']) ? $item['chord_profile'] : 'HD';
                  $notes = trim((string)($item['notes'] ?? ($item['leader_notes'] ?? '')));
                  $singer = trim((string)($item['lead_singer'] ?? ''));
                  $metaNote = trim($singer . ($singer && $notes ? ' — ' : '') . $notes);
                ?>
                <tr>
                  <td style="text-align: center; font-weight: 700;"><?= sprintf('%02d', $stt++) ?></td>
                  <td style="font-weight: <?= $isSong ? '600' : '400' ?>;">
                    <?= $isSong ? '🎵 ' : '📖 ' ?> <?= htmlspecialchars($title) ?>
                  </td>
                  <td style="text-align: center;"><?= $isSong ? htmlspecialchars($semiStr) : '—' ?></td>
                  <td style="text-align: center;"><?= $isSong && $bpmStr ? htmlspecialchars($bpmStr) : '—' ?></td>
                  <td style="text-align: center;"><?= $isSong ? htmlspecialchars($profileStr) : '—' ?></td>
                  <td style="color: #475569; font-size: 12px;"><?= htmlspecialchars($metaNote ?: '—') ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <footer class="page-footer">
          <span>Tập chương trình thờ phượng — SheetApp</span>
          <span>Trang 1</span>
        </footer>
      </section>
    <?php endif; ?>

    <!-- TRANG 2+: CÁC BÀI HÁT KÈM LỜI & HỢP ÂM -->
    <?php
      $songPageNum = $includeCover ? 2 : 1;
      $songIdx = 1;
      foreach ($items as $item):
        if (($item['item_type'] ?? 'song') !== 'song' || empty($item['song_id'])) continue;

        $songId = $item['song_id'];
        $chordSet = !empty($item['chord_profile']) ? $item['chord_profile'] : 'HD';
        $transpose = (int)($item['transpose_key'] ?? 0);
        $bpm = $item['bpm'] ?? null;
        $notes = trim((string)($item['notes'] ?? ($item['leader_notes'] ?? '')));

        try {
            $chordPro = ChordProService::export($songId, $chordSet, $transpose);
        } catch (Throwable $e) {
            $chordPro = null;
        }

        // Bóc tách metadata
        $title = $item['song_title'] ?? ($item['custom_title'] ?? $songId);
        $composer = '';
        $practicedKey = '';
        $sections = [];

        if ($chordPro !== null) {
            if (preg_match('/\{title:\s*([^}]+)\}/iu', $chordPro, $m)) $title = trim($m[1]);
            if (preg_match('/\{composer:\s*([^}]+)\}/iu', $chordPro, $m)) $composer = trim($m[1]);
            if (preg_match('/\{key:\s*([^}]+)\}/iu', $chordPro, $m)) $practicedKey = trim($m[1]);
            $sections = parseBookletSections($chordPro);
        }

    ?>
      <section class="booklet-page">
        <div>
          <header class="song-booklet-header">
            <div class="song-number-tag">Bài <?= sprintf('%02d', $songIdx++) ?> / Trong Buổi Nhóm</div>
            <h2 class="song-booklet-title"><?= htmlspecialchars($title) ?></h2>
            <div class="song-booklet-meta">
              <span>Tông hát: <strong><?= htmlspecialchars($practicedKey) ?></strong> (<?= $transpose >= 0 ? "+{$transpose}" : $transpose ?>)</span>
              <?php if (!empty($bpm)): ?>
                <span>Tốc độ: <strong>♩ = <?= htmlspecialchars((string)$bpm) ?> BPM</strong></span>
              <?php endif; ?>
              <span>Bộ hợp âm: <strong><?= htmlspecialchars($chordSet) ?></strong></span>
              <?php if (!empty($item['lead_singer'])): ?>
                <span>Người hát chính: <strong><?= htmlspecialchars($item['lead_singer']) ?></strong></span>
              <?php endif; ?>
              <?php if (!empty($composer)): ?>
                <span style="font-style:italic;margin-left:auto;">Tác giả: <?= htmlspecialchars($composer) ?></span>
              <?php endif; ?>
            </div>
          </header>

          <div class="sections-container <?= $cols === 2 ? 'two-columns' : '' ?>">
            <?php if (empty($sections)): ?>
              <div style="padding: 40px 20px; text-align: center; color: #64748b; font-style: italic; border: 1px dashed #cbd5e1; border-radius: 6px;">
                📖 (Tiết mục / Bài hát chưa có dữ liệu hợp âm số MusicXML)
              </div>
            <?php else: ?>
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
                      <div class="comment-line">💡 <?= htmlspecialchars($lineItem['text']) ?></div>
                    <?php else: ?>
                      <?= renderBookletChordLine($lineItem['text'], $showChords) ?>
                    <?php endif; ?>
                  <?php endforeach; ?>
                </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>

          <?php if (!empty($notes)): ?>
            <div class="song-notes-box">
              <strong>📝 Ghi chú cho ban nhạc:</strong> <?= htmlspecialchars($notes) ?>
            </div>
          <?php endif; ?>
        </div>

        <footer class="page-footer">
          <span><?= htmlspecialchars($setlist['title']) ?> — <?= htmlspecialchars($setlist['scheduled_date']) ?></span>
          <span>Trang <?= $songPageNum++ ?></span>
        </footer>
      </section>
    <?php endforeach; ?>

  </div>

  <script>
    let currentFontSize = 14;

    function changeFontSize(delta) {
      currentFontSize = Math.max(11, Math.min(20, currentFontSize + delta));
      document.documentElement.style.setProperty('--font-size', currentFontSize + 'px');
      try { localStorage.setItem('sheetapp_booklet_fontsize', currentFontSize); } catch(e){}
    }

    function toggleColumns() {
      const url = new URL(window.location.href);
      const cur = url.searchParams.get('cols') === '2' ? '1' : '2';
      url.searchParams.set('cols', cur);
      window.location.href = url.toString();
    }

    function toggleCover() {
      const url = new URL(window.location.href);
      const cur = url.searchParams.get('cover') === '0' ? '1' : '0';
      url.searchParams.set('cover', cur);
      window.location.href = url.toString();
    }

    function toggleChords() {
      const url = new URL(window.location.href);
      const cur = url.searchParams.get('chords') === '0' ? '1' : '0';
      url.searchParams.set('chords', cur);
      window.location.href = url.toString();
    }

    try {
      const savedFs = parseInt(localStorage.getItem('sheetapp_booklet_fontsize') || '', 10);
      if (savedFs && savedFs >= 11 && savedFs <= 20) {
        currentFontSize = savedFs;
        document.documentElement.style.setProperty('--font-size', currentFontSize + 'px');
      }
    } catch(e){}
  </script>
</body>
</html>
