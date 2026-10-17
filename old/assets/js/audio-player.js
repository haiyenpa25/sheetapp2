/**
 * audio-player.js — Hệ thống phát audio SATB 5 chế độ
 * Soprano (S) · Alto (A) · Tenor (T) · Bass (B) · Hòa âm (♪)
 *
 * ══════════════════════════════════════════════════════════════
 * FIX iOS/iPad KHÔNG CÓ TIẾNG:
 *
 * Có 2 lý do iOS block Web Audio:
 *
 * 1. AudioContext "suspended" — iOS yêu cầu resume() phải được gọi
 *    ĐỒNG BỘ (synchronous) bên trong user gesture handler.
 *    Nếu gọi sau "await" → iOS đã thu hồi quyền gesture → im lặng.
 *    Fix: tách hàm play button handler thành 2 phần:
 *      a) Phần SYNC: resume AudioContext + play silent buffer
 *      b) Phần ASYNC: loadScore + play
 *
 * 2. Silent Mode (nút phần cứng bên hông iPhone) — Web Audio bị
 *    mute hoàn toàn khi Silent Mode bật. Workaround: play 1 HTML5
 *    <audio> element đồng thời (HTML5 Audio không bị Silent Mode)
 *    để "kéo" audio route về speaker.
 *
 * NGUYÊN LÝ FILTER BÈ (Pitch-Rank):
 *   sorted ascending → [Bass, Tenor, Alto, Soprano]
 * ══════════════════════════════════════════════════════════════
 */

const SheetAudioPlayer = (() => {
  'use strict';

  /* ── State ── */
  let _player        = null;
  let _isPlaying     = false;
  let _osmd          = null;
  let _currentVoice  = 'satb';
  let _origSchedule  = null;
  let _volumeDb      = 18;      // +18 dB mặc định
  let _audioUnlocked = false;

  const TREBLE_THRESHOLD = 64;

  const VOICE_LABELS = {
    soprano : 'Soprano (Nữ Cao)',
    alto    : 'Alto (Nữ Trầm)',
    tenor   : 'Tenor (Nam Cao)',
    bass    : 'Bass (Nam Trầm)',
    satb    : 'Hòa âm 4 bè',
  };

  /* ══════════════════════════════════════════════════════════
   *  _syncUnlock  — GỌI ĐỒNG BỘ trong user gesture, trước mọi await
   *
   *  Đây là kỹ thuật quan trọng nhất để fix iOS:
   *  - ctx.resume() phải nằm TRƯỚC dòng "await" đầu tiên
   *  - Play 1 buffer im lặng để "mở khóa" AudioContext thực sự
   * ════════════════════════════════════════════════════════ */
  function _syncUnlock() {
    try {
      // Lấy AudioContext thô của Tone.js
      const ctx = window.Tone?.context?.rawContext
               || window.Tone?.context?._context
               || window.Tone?.context;

      if (!ctx) return;

      // ① Gọi resume() ĐỒNG BỘ (không await) — iOS bắt buộc phải làm vậy
      if (ctx.state !== 'running') {
        ctx.resume(); // fire and forget
      }

      // ② Play 1 sample im lặng — thực sự "kích hoạt" AudioContext trên iOS
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      src.stop(0.001);

      _audioUnlocked = true;
    } catch (e) {
      console.warn('[Audio] _syncUnlock error:', e);
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  _playSilentHtml5  — bypass iOS Silent Mode
   *
   *  Khi iPhone ở chế độ Im Lặng (hardware switch), Web Audio bị
   *  mute hoàn toàn. HTML5 Audio <audio> thì không bị ảnh hưởng.
   *  Bằng cách play một file audio HTML5 trước, audio route sẽ
   *  chuyển sang speaker, sau đó Web Audio cũng có tiếng theo.
   * ════════════════════════════════════════════════════════ */
  function _playSilentHtml5() {
    try {
      // Data URI: file WAV im lặng 0.1s (base64)
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const audio = new Audio(silentWav);
      audio.volume = 0.001; // gần như không nghe thấy
      audio.play().catch(() => {}); // ignore nếu bị block
    } catch (e) {}
  }

  /* ══════════════════════════════════════
   *  MIDI pitch helper
   * ══════════════════════════════════════ */
  function _getMidi(n) {
    return (typeof n.halfTone === 'number') ? n.halfTone
         : (typeof n.note    === 'number') ? n.note
         : 60;
  }

  /* ══════════════════════════════════════
   *  Pitch-Rank filter
   * ══════════════════════════════════════ */
  function _pickByVoice(notes, mode) {
    if (!notes || notes.length === 0) return [];
    const s = [...notes].sort((a, b) => _getMidi(a) - _getMidi(b));
    const n = s.length;

    if (n === 1) return s;

    if (n === 2) {
      const isTreble = _getMidi(s[1]) >= TREBLE_THRESHOLD;
      if (isTreble) {
        if (mode === 'soprano') return [s[1]];
        if (mode === 'alto')    return [s[0]];
        return [];
      } else {
        if (mode === 'tenor') return [s[1]];
        if (mode === 'bass')  return [s[0]];
        return [];
      }
    }

    switch (mode) {
      case 'bass':    return [s[0]];
      case 'tenor':   return [s[Math.min(1, n - 1)]];
      case 'alto':    return [s[Math.max(n - 2, 0)]];
      case 'soprano': return [s[n - 1]];
      default:        return notes;
    }
  }

  /* ══════════════════════════════════════
   *  applyPlaybackMode
   * ══════════════════════════════════════ */
  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const instrPlayer = _player.instrumentPlayer;
    if (!instrPlayer) return;
    _restoreSchedule(instrPlayer);
    const mode = _currentVoice;
    if (mode === 'satb') return;
    _origSchedule = instrPlayer.schedule.bind(instrPlayer);
    instrPlayer.schedule = function satbSchedule(midiId, time, notes) {
      const filtered = _pickByVoice(notes, mode);
      if (filtered.length > 0) _origSchedule(midiId, time, filtered);
    };
  }

  function _restoreSchedule(instrPlayer) {
    if (_origSchedule && instrPlayer) {
      instrPlayer.schedule = _origSchedule;
      _origSchedule = null;
    }
  }

  /* ══════════════════════════════════════
   *  Volume
   * ══════════════════════════════════════ */
  function setVolume(db) {
    _volumeDb = db;
    _applyVolume();
  }

  function _applyVolume() {
    if (!window.Tone?.Destination) return;
    Tone.Destination.volume.value = _volumeDb;
  }

  /* ══════════════════════════════════════
   *  Init
   * ══════════════════════════════════════ */
  function init() {
    /* ────────────────────────────────────────────────────────
     *  Nút PHÁT — tách làm 2 bước:
     *    1. _syncUnlock() + _playSilentHtml5() — ĐỒNG BỘ, trong gesture
     *    2. _playAsync() — bất đồng bộ sau đó
     * ────────────────────────────────────────────────────────
     *  LÝ DO: iOS Safari coi tất cả code sau "await" đầu tiên
     *  là NGOÀI user gesture → không cho resume AudioContext.
     *  Bằng cách gọi resume() TRƯỚC await, ta vẫn nằm trong gesture.
     * ──────────────────────────────────────────────────────── */
    document.getElementById('btn-play-audio')?.addEventListener('click', () => {
      // ① SYNC — phải là dòng code đầu tiên của handler, trước mọi await
      _syncUnlock();
      _playSilentHtml5();
      // ② ASYNC — sau khi context đã được unlock
      _playAsync();
    });

    document.getElementById('btn-stop-audio')?.addEventListener('click', stop);

    document.getElementById('audio-speed')?.addEventListener('change', e =>
      setSpeed(parseFloat(e.target.value))
    );

    document.getElementById('audio-volume')?.addEventListener('input', e => {
      setVolume(parseFloat(e.target.value));
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('.voice-btn');
      if (!btn || btn.disabled) return;
      const voice = btn.dataset.voice;
      if (voice && voice !== _currentVoice) {
        _setVoice(voice);
        if (_isPlaying) applyPlaybackMode();
      }
    });

    /* Pre-warm: unlock AudioContext ngay khi user chạm vào màn hình lần đầu */
    const _earlyUnlock = () => {
      if (_audioUnlocked) return;
      _syncUnlock();
      document.removeEventListener('touchstart', _earlyUnlock);
      document.removeEventListener('mousedown', _earlyUnlock);
    };
    document.addEventListener('touchstart', _earlyUnlock, { passive: true });
    document.addEventListener('mousedown',  _earlyUnlock, { passive: true });
  }

  function setup(osmd) {
    _osmd = osmd;
    if (_player && _isPlaying) stop();
    _player = null;
    if (typeof OsmdAudioPlayer === 'undefined') {
      console.warn('[Audio] OsmdAudioPlayer chưa load.');
    }
  }

  /* ══════════════════════════════════════
   *  _playAsync — phần bất đồng bộ của play()
   *  (đã tách ra khỏi click handler để iOS unlock hoạt động)
   * ══════════════════════════════════════ */
  async function _playAsync() {
    if (!_osmd) return;
    try {
      // Gọi Tone.start() — lúc này context đã được resume() ở trên rồi
      if (window.Tone) {
        await Tone.start();
        // Chờ context thực sự "running" (tối đa 2s)
        if (Tone.context?.state !== 'running') {
          await new Promise((resolve, reject) => {
            const deadline = Date.now() + 2000;
            const poll = () => {
              if (Tone.context?.state === 'running') return resolve();
              if (Date.now() > deadline) return reject(new Error('AudioContext không chuyển sang running'));
              setTimeout(poll, 50);
            };
            poll();
          });
        }
      }

      _applyVolume();

      if (!_player) {
        _player = new OsmdAudioPlayer();
      }

      window.App?.showToast?.('🎵 Đang nạp âm thanh…', 'info');
      await _player.loadScore(_osmd);
      applyPlaybackMode();

      // Tái áp dụng volume sau loadScore (iOS reset gain về 0)
      _applyVolume();

      _player.on('iteration', () => {
        const cursorEl = _osmd.cursor?.cursorElement;
        if (!cursorEl) return;
        const wrapper = document.querySelector('.sheet-viewer-wrapper');
        if (!wrapper) return;
        const cRect = cursorEl.getBoundingClientRect();
        const vRect = wrapper.getBoundingClientRect();
        if      (cRect.bottom > vRect.bottom - 50) wrapper.scrollBy({ top:  cRect.height * 2, behavior: 'smooth' });
        else if (cRect.top    < vRect.top)          wrapper.scrollBy({ top: -cRect.height * 2, behavior: 'smooth' });
      });

      _player.play();
      _isPlaying = true;

      document.getElementById('btn-play-audio')?.classList.add('hidden');
      document.getElementById('btn-stop-audio')?.classList.remove('hidden');
      window.App?.showToast?.(`▶ Đang phát — ${VOICE_LABELS[_currentVoice] ?? _currentVoice}`, 'success');

    } catch (err) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      let msg;
      if (isIOS) {
        msg = '⚠️ Không phát được — kiểm tra: (1) nút Im Lặng bên cạnh iPhone/iPad, (2) âm lượng phần cứng';
      } else {
        msg = 'Không thể phát audio (trình duyệt chặn hoặc file quá phức tạp)';
      }
      window.App?.showToast?.(msg, 'error');
      console.error('[Audio]', err);
      stop();
    }
  }

  /* ── play() public (chuyển sang _playAsync cho iOS) ── */
  function play() {
    _syncUnlock();
    _playSilentHtml5();
    return _playAsync();
  }

  function stop() {
    if (_player) {
      if (_player.instrumentPlayer) _restoreSchedule(_player.instrumentPlayer);
      if (_isPlaying) _player.stop();
    }
    _isPlaying = false;
    if (_osmd?.cursor) {
      _osmd.cursor.hide();
      _osmd.cursor.reset();
    }
    document.getElementById('btn-play-audio')?.classList.remove('hidden');
    document.getElementById('btn-stop-audio')?.classList.add('hidden');
  }

  function setSpeed(rate) {
    if (!_player) return;
    if (typeof _player.setPlaybackRate === 'function') _player.setPlaybackRate(rate);
    else if (_player.playbackRate !== undefined)        _player.playbackRate = rate;
  }

  function enableBtn(enabled) {
    const btn = document.getElementById('btn-play-audio');
    const spd = document.getElementById('audio-speed');
    const vol = document.getElementById('audio-volume');
    const set = document.getElementById('btn-audio-settings');
    if (btn) btn.disabled = !enabled;
    if (spd) spd.disabled = !enabled;
    if (vol) vol.disabled = !enabled;
    if (set) set.disabled = !enabled;
    document.querySelectorAll('.voice-btn').forEach(b => { b.disabled = !enabled; });
    if (!enabled) {
      stop();
      _setVoice('satb');
    }
  }

  function _setVoice(voice) {
    _currentVoice = voice;
    document.querySelectorAll('.voice-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.voice === voice);
    });
    const sel = document.getElementById('audio-playback-mode');
    if (sel) sel.value = voice;
  }

  return { init, setup, play, enableBtn, stop, setSpeed, setVolume, applyPlaybackMode };

})();

window.SheetAudioPlayer = SheetAudioPlayer;
