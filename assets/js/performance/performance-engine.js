/**
 * assets/js/performance/performance-engine.js — Central Performance Engine Coordinator
 * 
 * Orchestrates:
 * 1. Musical Position tracking & local rendering
 * 2. Live Session master-follower synchronization
 * 3. Role-based view adjustments (Guitar, Piano, Vocal)
 * 4. Setlist preloading for instant song transitions
 */
const PerformanceEngine = (() => {
  'use strict';

  let _lastSentMeasure = 1;
  let _lastSentTime    = 0;
  let _lastAppliedState = null;
  let _preloadedSongs = new Map();

  function init() {
    MusicalPosition.computeMeasurePositions();
    _bindHostListeners();
    _bindGlobalEvents();
    console.log('[PerformanceEngine] Protocol V2 Engine initialized');
  }

  function _bindHostListeners() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return;

    // Throttled scroll listener for Host: extracts visible measure (max 4 times/sec)
    let _scrollTicking = false;
    wrapper.addEventListener('scroll', () => {
      if (!LiveSession.isHost()) return;
      if (!_scrollTicking) {
        window.requestAnimationFrame(() => {
          const now = Date.now();
          if (now - _lastSentTime > 280) {
            const currentMeasure = MusicalPosition.getVisibleMeasure();
            if (currentMeasure !== _lastSentMeasure) {
              _lastSentMeasure = currentMeasure;
              _lastSentTime = now;
              LiveSession.broadcastState({
                position: { measure: currentMeasure }
              });
            }
          }
          _scrollTicking = false;
        });
        _scrollTicking = true;
      }
    }, { passive: true });
  }

  function _bindGlobalEvents() {
    if (typeof EventBus === 'undefined') return;

    // Khi Host đổi bài
    EventBus.on('song:loaded', ({ song }) => {
      if (LiveSession.isHost()) {
        setTimeout(() => {
          LiveSession.broadcastState({
            song: {
              songId: song?.id || '',
              songTitle: song?.title || ''
            },
            music: {
              transpose: window.Store?.get?.('currentTranspose') ?? 0,
              chordProfile: window.ChordCanvas?.getCurrentSet?.() || 'HD',
              bpm: window.Metronome?.getBpm?.() ?? 80
            },
            position: { measure: 1 }
          });
        }, 150);
      }
    });

    // Khi Host dịch giọng
    EventBus.on('transpose:changed', ({ value }) => {
      if (LiveSession.isHost()) {
        LiveSession.broadcastState({
          music: { transpose: value }
        });
      }
    });
  }

  /**
   * Áp dụng trạng thái nhận được từ Host xuống thiết bị Follower
   */
  async function applyRemoteState(state) {
    if (!state || LiveSession.isHost()) return;

    const currentSongId = window.App?.getCurrentSongId?.();
    const targetSongId  = state.song?.songId || state.songId;

    // 1. Đồng bộ Bài Hát
    if (targetSongId && targetSongId !== currentSongId) {
      const songTitle = state.song?.songTitle || state.songTitle || targetSongId;
      window.App?.showToast?.(`📡 Ca trưởng chuyển bài: ${songTitle}`, 'info');

      // Tải bài mới (ưu tiên cache preload)
      const cachedXml = _preloadedSongs.get(targetSongId);
      if (cachedXml && window.App?.loadSongXmlDirect) {
        await window.App.loadSongXmlDirect(targetSongId, cachedXml, state.music?.transpose ?? 0);
      } else {
        await window.SongLoader?.load?.({ id: targetSongId, xmlPath: `storage/Thanh ca/${targetSongId}.xml` });
      }
    }

    // 2. Đồng bộ Dịch Giọng (Transpose)
    if (state.music && state.music.transpose !== undefined) {
      const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      if (currentTranspose !== state.music.transpose) {
        if (window.App?.setTransposeDirect) {
          window.App.setTransposeDirect(state.music.transpose);
        } else if (window.App?.setTranspose) {
          window.App.setTranspose(state.music.transpose);
        }
      }
    }

    // 3. Đồng bộ Vị trí Ô Nhịp (Musical Position)
    const targetMeasure = state.position?.measure || state.measure;
    if (targetMeasure && targetMeasure > 0) {
      MusicalPosition.scrollToMeasure(targetMeasure, true);
    }

    // 4. Đồng bộ Metronome BPM nếu có
    if (state.music && state.music.bpm && window.Metronome) {
      const curBpm = window.Metronome.getBpm?.();
      if (curBpm !== state.music.bpm) {
        window.Metronome.setBpm(state.music.bpm);
      }
    }

    // 5. Đồng bộ Bộ Đếm Nhịp Chuẩn Bị (Synchronized Count-in)
    if (state.transport && state.transport.state === 'count_in') {
      const startAt = state.transport.startAt || 0;
      if (startAt && (!_lastAppliedState || _lastAppliedState.transport?.startAt !== startAt)) {
        window.CountInEngine?.startCountIn({
          bpm: state.music?.bpm || 80,
          beats: state.music?.meter?.beats || 4,
          countInBars: state.transport.countInBars || 1,
          startAtServer: startAt,
          onComplete: () => {
            console.log('[PerformanceEngine] Follower count-in completed -> Entering playback');
          }
        });
      }
    } else if (state.transport && state.transport.state === 'stopped') {
      window.CountInEngine?.cancel();
    }

    _lastAppliedState = state;
  }

  /**
   * Kích hoạt đếm nhịp chuẩn bị đồng bộ cho cả ban nhạc (Dành cho Host / Trưởng ban)
   */
  function triggerHostCountIn(countInBars = 1) {
    const bpm   = window.Metronome?.getBpm?.() || 80;
    const beats = 4;
    const serverStartAt = (window.TransportClock?.nowServerSeconds?.() || (Date.now() / 1000.0)) + 0.45;

    // Phát sóng trạng thái count_in cho tất cả follower
    if (LiveSession.isHost()) {
      LiveSession.broadcastState({
        transport: {
          state: 'count_in',
          countInBars: countInBars,
          startAt: serverStartAt
        }
      });
    }

    // Chạy count-in trên máy Host
    window.CountInEngine?.startCountIn({
      bpm: bpm,
      beats: beats,
      countInBars: countInBars,
      startAtServer: serverStartAt,
      onComplete: () => {
        if (LiveSession.isHost()) {
          LiveSession.broadcastState({
            transport: { state: 'playing', startAt: 0 }
          });
        }
        // Tự động bật cuộn trang nếu đã bật
        if (window.AutoScroller && !window.AutoScroller.isActive?.()) {
          window.AutoScroller.start?.();
        }
      }
    });
  }

  /**
   * Áp dụng bố cục hiển thị theo vai trò (Role View)
   */
  function applyRoleView(role) {
    const lyricContainer = document.getElementById('lyric-view-container');
    const osmdContainer  = document.getElementById('osmd-container');
    const btnLyricView   = document.getElementById('btn-lyric-view');

    if (role === 'vocal') {
      // Ca đoàn: mở chế độ Lời Nhạc
      if (lyricContainer && lyricContainer.classList.contains('hidden') && btnLyricView) {
        btnLyricView.click();
      }
    } else if (role === 'guitar') {
      // Guitar: đảm bảo bản nhạc và hợp âm hiện rõ
      if (lyricContainer && !lyricContainer.classList.contains('hidden') && btnLyricView) {
        btnLyricView.click(); // chuyển về bản nhạc
      }
      if (window.ChordCanvas && !window.ChordCanvas.isHighlightMode?.()) {
        window.ChordCanvas.toggleHighlight?.();
      }
    } else {
      // Piano / Leader / Viewer: bản nhạc chuẩn
      if (lyricContainer && !lyricContainer.classList.contains('hidden') && btnLyricView) {
        btnLyricView.click();
      }
    }
  }

  function onSessionStarted({ mode, room, isHost }) {
    // Preload setlist songs nếu có
    _preloadCurrentSetlist();
  }

  function onSessionEnded() {
    _preloadedSongs.clear();
  }

  async function _preloadCurrentSetlist() {
    const setlist = window.SetlistUI?.getCurrentSetlist?.();
    if (!setlist || !setlist.items || setlist.items.length === 0) return;

    // Tải trước tối đa 10 bài hát trong setlist
    setlist.items.slice(0, 10).forEach(async (item) => {
      const songId = item.song_id;
      if (!songId || _preloadedSongs.has(songId)) return;
      try {
        const res = await fetch(`storage/Thanh ca/${songId}.xml`);
        if (res.ok) {
          const xml = await res.text();
          _preloadedSongs.set(songId, xml);
        }
      } catch (e) {}
    });
  }

  return {
    init,
    applyRemoteState,
    applyRoleView,
    triggerHostCountIn,
    onSessionStarted,
    onSessionEnded
  };
})();

window.PerformanceEngine = PerformanceEngine;
