<?php
/**
 * live-band/projector.php — SheetApp Clean Lyrics Projector
 * 
 * High-contrast, distraction-free stage lyrics projection for church screens,
 * projectors, and sanctuary LED walls.
 * Route: https://sheet.hyb.io.vn/live-band/projector.php?room=CODE
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$roomParam = isset($_GET['room']) ? htmlspecialchars(trim($_GET['room'])) : '';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Màn Hình Máy Chiếu Nhà Thờ — Live Band Studio</title>
  <meta name="theme-color" content="#000000">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #000000;
      color: #ffffff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-user-select: none;
    }

    /* Top Subtle Status Bar */
    .projector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 36px;
      font-size: 1.15rem;
      color: rgba(255, 255, 255, 0.45);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      transition: opacity 0.4s ease;
    }
    .projector-header.dimmed {
      opacity: 0.15;
    }
    .projector-title {
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: 0.5px;
      font-size: 1.35rem;
    }
    .projector-room-badge {
      background: rgba(255, 255, 255, 0.08);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.95rem;
      letter-spacing: 1px;
    }

    /* Main Lyrics Canvas */
    .projector-viewport {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 40px 60px;
      overflow-y: auto;
    }

    .projector-song-heading {
      font-size: 2.2rem;
      font-weight: 800;
      color: #f59e0b;
      margin-bottom: 36px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .projector-lyrics-box {
      max-width: 1200px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .projector-line {
      font-size: 3.4rem;
      font-weight: 700;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.65);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      padding: 10px 24px;
      border-radius: 12px;
    }

    .projector-line.active {
      color: #ffffff;
      font-weight: 900;
      background: rgba(245, 158, 11, 0.16);
      transform: scale(1.03);
      text-shadow: 0 0 35px rgba(245, 158, 11, 0.4);
    }

    /* Empty State */
    .projector-empty {
      color: rgba(255, 255, 255, 0.4);
      font-size: 2.2rem;
      line-height: 1.5;
    }
    .projector-empty-hint {
      font-size: 1.25rem;
      margin-top: 16px;
      color: rgba(255, 255, 255, 0.25);
    }

    /* Fullscreen Overlay Hint */
    .fullscreen-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.6);
      pointer-events: none;
      transition: opacity 0.5s ease;
    }
  </style>
</head>
<body>

  <header class="projector-header" id="projector-header">
    <div class="projector-title" id="projector-header-title">LIVE BAND STUDIO — MÁY CHIẾU THÁNH LỄ</div>
    <div class="projector-room-badge" id="projector-room-badge">PHÒNG: <?php echo $roomParam ?: 'CHƯA KẾT NỐI'; ?></div>
  </header>

  <main class="projector-viewport" id="projector-viewport">
    <div id="projector-content">
      <div class="projector-empty">
        <div>📡 Đang kết nối tới Ca Trưởng...</div>
        <div class="projector-empty-hint">Chạm hai lần (Double Click) để bật chế độ Toàn Màn Hình</div>
      </div>
    </div>
  </main>

  <div class="fullscreen-toast" id="fs-toast">💡 Bấm phím F11 hoặc chạm đúp để Bật/Tắt Toàn Màn Hình</div>

  <!-- Shared Transport Infrastructure -->
  <script src="/assets/js/core/ApiService.js"></script>
  <script src="/assets/js/performance/live-transport.js"></script>

  <script>
    (function() {
      'use strict';

      const urlParams = new URLSearchParams(window.location.search);
      const roomCode = (urlParams.get('room') || '<?php echo $roomParam; ?>').toUpperCase();
      let currentSongId = '';
      let lyricsLines = [];
      let activeLineIdx = 0;

      const transport = new PollingTransport(400);

      // Auto double-click fullscreen
      document.body.addEventListener('dblclick', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });

      // Hide toast after 5 seconds
      setTimeout(() => {
        const toast = document.getElementById('fs-toast');
        if (toast) toast.style.opacity = '0';
      }, 5000);

      // Auto dim header on inactivity
      let idleTimer = null;
      window.addEventListener('mousemove', () => {
        const header = document.getElementById('projector-header');
        if (header) header.classList.remove('dimmed');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (header) header.classList.add('dimmed');
        }, 4000);
      });

      if (!roomCode) {
        document.getElementById('projector-content').innerHTML = `
          <div class="projector-empty">
            <div>⚠️ Chưa có mã phòng Live Band!</div>
            <div class="projector-empty-hint">Vui lòng thêm ?room=MÃ_PHÒNG vào đường dẫn URL</div>
          </div>
        `;
        return;
      }

      // Connect
      transport.subscribe((msg) => {
        if (!msg) return;
        if (msg.type === 'state' && msg.state) {
          handleState(msg.state);
        }
      });

      transport.connect(roomCode, {
        clientId: 'projector-' + Math.random().toString(36).substring(2, 8),
        role: 'viewer'
      });

      async function handleState(state) {
        const songId = state.song?.songId || state.songId;
        const songTitle = state.song?.songTitle || songId || '';
        const measure = state.position?.measure || 1;

        if (songId && songId !== currentSongId) {
          currentSongId = songId;
          document.getElementById('projector-header-title').textContent = songTitle ? `BÀI: ${songTitle.toUpperCase()}` : 'LIVE BAND STUDIO';
          await loadAndRenderLyrics(songId, songTitle);
        }

        // Highlight based on measure progression
        highlightByMeasure(measure);
      }

      async function loadAndRenderLyrics(songId, songTitle) {
        const content = document.getElementById('projector-content');
        try {
          let path = `/storage/Thanh ca/${songId}.xml`;
          const res = await fetch(path);
          if (!res.ok) throw new Error('Cannot load XML');
          const xmlText = await res.text();

          const parser = new DOMParser();
          const doc = parser.parseFromString(xmlText, 'text/xml');
          const measures = doc.querySelectorAll('measure');

          lyricsLines = [];
          measures.forEach((m, mIdx) => {
            const words = Array.from(m.querySelectorAll('lyric text')).map(t => t.textContent.trim()).filter(Boolean);
            if (words.length > 0) {
              lyricsLines.push({
                measure: mIdx + 1,
                text: words.join(' ')
              });
            }
          });

          if (lyricsLines.length === 0) {
            content.innerHTML = `
              <div class="projector-song-heading">${songTitle}</div>
              <div class="projector-empty-hint">(Bản nhạc không chứa lời text)</div>
            `;
            return;
          }

          content.innerHTML = `
            <div class="projector-song-heading">${songTitle}</div>
            <div class="projector-lyrics-box" id="projector-lines-wrap">
              ${lyricsLines.map((l, idx) => `<div class="projector-line ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-measure="${l.measure}">${l.text}</div>`).join('')}
            </div>
          `;
        } catch (e) {
          content.innerHTML = `
            <div class="projector-song-heading">${songTitle}</div>
            <div class="projector-empty-hint">Đang phát sóng theo Ca Trưởng...</div>
          `;
        }
      }

      function highlightByMeasure(measure) {
        if (!lyricsLines || lyricsLines.length === 0) return;

        let bestIdx = 0;
        for (let i = 0; i < lyricsLines.length; i++) {
          if (measure >= lyricsLines[i].measure) {
            bestIdx = i;
          } else {
            break;
          }
        }

        if (bestIdx !== activeLineIdx) {
          activeLineIdx = bestIdx;
          const lines = document.querySelectorAll('.projector-line');
          lines.forEach((el, idx) => {
            el.classList.toggle('active', idx === activeLineIdx);
          });

          // Smooth scroll to active line
          const activeEl = document.querySelector('.projector-line.active');
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }

    })();
  </script>
</body>
</html>
