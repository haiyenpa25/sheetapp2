/**
 * learn/accompaniment/pattern-engine.js — Stage 5 & Phase 2: Smart Adaptive Accompaniment Engine
 *
 * Facade & State Coordinator điều phối đệm thông minh tự thích ứng cho Piano / Organ & Acoustic Drums:
 * - Quản lý trạng thái phong cách đệm (Pattern ID), mật độ hòa âm (Density), bật/tắt đệm & trống
 * - Kết nối PatternScheduler (lên lịch đồng bộ Tone.js Transport clock) và PatternGenerator (sinh nốt theo phong cách)
 * - Tương thích ngược 100% với toàn bộ hệ thống Learn Studio
 *
 * Expose: window.PatternEngine
 */
const PatternEngine = (() => {
  'use strict';

  let _activePatternId = 'smart-ballad';
  let _density = 'medium'; // 'soft' | 'medium' | 'rich'
  let _enabled = true;

  function init() {
    const savedPattern = window.LearnStore?.get('patternId');
    if (savedPattern) {
      _activePatternId = savedPattern;
    }
    const savedDensity = window.LearnStore?.get('accompanimentDensity');
    if (savedDensity) {
      _density = savedDensity;
    }
  }

  function setPattern(patternId) {
    if (!patternId) return;
    _activePatternId = patternId;
    if (window.LearnStore) {
      LearnStore.set('patternId', patternId);
      LearnStore.savePreferences();
    }
    if (window.EventBus) {
      EventBus.emit(LEARN_EVENTS.PATTERN_CHANGED, { patternId });
    }
  }

  function getActivePattern() {
    return window.PatternLibrary ? PatternLibrary.getById(_activePatternId) : null;
  }

  function setDensity(density) {
    if (['soft', 'medium', 'rich'].includes(density)) {
      _density = density;
      if (window.LearnStore) {
        LearnStore.set('accompanimentDensity', density);
        LearnStore.savePreferences();
      }
    }
  }

  function getDensity() {
    return _density;
  }

  function setEnabled(enabled) {
    _enabled = !!enabled;
    if (!_enabled && window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  function isEnabled() {
    return _enabled;
  }

  function setDrums(enabled) {
    if (window.LearnSoundEngine) {
      LearnSoundEngine.setDrumsEnabled(enabled);
    }
  }

  function isDrums() {
    return window.LearnSoundEngine ? LearnSoundEngine.isDrumsEnabled() : false;
  }

  function toggleDrums() {
    const next = !isDrums();
    setDrums(next);
    return next;
  }

  /* ─── Transport Control & Scheduling ─── */

  function start() {
    if (!_enabled) return;
    if (window.PatternScheduler) {
      PatternScheduler.start((measure, time, bpm) => {
        if (!_enabled) return;
        if (window.PatternGenerator) {
          PatternGenerator.generateMeasure(measure, time, bpm, {
            patternId: _activePatternId,
            density: _density
          });
        }
      });
    }
  }

  function stop() {
    if (window.PatternScheduler) {
      PatternScheduler.stop();
    }
  }

  function pause() {
    if (window.PatternScheduler) {
      PatternScheduler.pause();
    }
  }

  return {
    init,
    setPattern,
    getActivePattern,
    setDensity,
    getDensity,
    setEnabled,
    isEnabled,
    setDrums,
    isDrums,
    toggleDrums,
    start,
    stop,
    pause
  };
})();

if (typeof window !== 'undefined') {
  window.PatternEngine = PatternEngine;
}
