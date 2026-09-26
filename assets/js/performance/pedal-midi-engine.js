/**
 * assets/js/performance/pedal-midi-engine.js — SheetApp Stage Foot Pedal & MIDI Engine
 * 
 * Handles hands-free performance control via:
 * 1. Bluetooth Page Turner Pedals (AirTurn, PageFlip, Donner, Stomp via Keyboard events)
 * 2. Web MIDI API (Bluetooth MIDI pedals, USB MIDI surfaces via navigator.requestMIDIAccess)
 * 
 * Provides:
 * - Macro action dispatching (Next Section, Prev Section, Count-In, Cue Chorus, Snap Host)
 * - Visual HUD feedback toast on stage display
 */
const PedalMidiEngine = (() => {
  'use strict';

  const STORAGE_KEY_MAP = 'sheetapp_pedal_key_map';

  // Default Action Mappings
  const DEFAULT_MAP = {
    // Bluetooth Page Turner typical keys
    'ArrowRight': 'next',
    'PageDown':   'next',
    'ArrowDown':  'next',
    'Enter':      'next',
    'ArrowLeft':  'prev',
    'PageUp':     'prev',
    'ArrowUp':    'prev',
    'Space':      'countin'
  };

  let _keyMap = { ...DEFAULT_MAP };
  let _midiAccess = null;
  let _isEnabled = true;
  let _actionHandler = null; // Callback: (actionName) => void

  function init(actionCallback) {
    _actionHandler = actionCallback;
    _loadSavedKeyMap();
    _bindKeyboardListener();
    _initWebMidi();
    console.log('[PedalMidiEngine] Initialized with keyboard & Web MIDI support.');
  }

  function _loadSavedKeyMap() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MAP);
      if (saved) {
        _keyMap = { ...DEFAULT_MAP, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  function _bindKeyboardListener() {
    window.addEventListener('keydown', (e) => {
      if (!_isEnabled) return;

      // Ignore when user is actively typing in an input or textarea
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }

      const action = _keyMap[e.key] || _keyMap[e.code];
      if (action) {
        // Prevent default page scroll for pedal keys
        e.preventDefault();
        _dispatchAction(action, `Bàn Đạp (${e.key})`);
      }
    }, { passive: false });
  }

  async function _initWebMidi() {
    if (!navigator.requestMIDIAccess) return;

    try {
      _midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      _bindMidiInputs();

      _midiAccess.onstatechange = () => {
        _bindMidiInputs();
      };
    } catch (err) {
      console.warn('[PedalMidiEngine] Web MIDI not available:', err);
    }
  }

  function _bindMidiInputs() {
    if (!_midiAccess) return;

    const inputs = _midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = _handleMidiMessage;
      console.log(`[PedalMidiEngine] Connected MIDI device: ${input.name}`);
    }
  }

  function _handleMidiMessage(event) {
    if (!_isEnabled || !event.data) return;

    const [status, data1, data2] = event.data;
    const cmd = status >> 4;
    // const channel = status & 0xf;

    // Command 11 = Control Change (CC), Command 9 = Note On
    if (cmd === 11) { // CC
      // data1 = Controller Number, data2 = Value
      if (data2 > 63) { // Pedal Pressed
        if (data1 === 64) { // Sustain pedal default
          _dispatchAction('next', 'MIDI Pedal (CC64)');
        } else if (data1 === 66) { // Sostenuto pedal
          _dispatchAction('prev', 'MIDI Pedal (CC66)');
        } else if (data1 === 67) { // Soft pedal
          _dispatchAction('countin', 'MIDI Pedal (CC67)');
        }
      }
    } else if (cmd === 9 && data2 > 0) { // Note On
      if (data1 === 60) { // Middle C or custom trigger
        _dispatchAction('next', 'MIDI Note (C4)');
      }
    }
  }

  function _dispatchAction(action, sourceLabel = 'Pedal') {
    _showPedalFeedbackToast(action, sourceLabel);

    if (typeof _actionHandler === 'function') {
      _actionHandler(action);
    }
  }

  function _showPedalFeedbackToast(action, source) {
    let toast = document.getElementById('pedal-feedback-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pedal-feedback-toast';
      toast.className = 'pedal-feedback-toast';
      document.body.appendChild(toast);
    }

    const actionLabels = {
      next:    '⏭ Sang Đoạn / Tiến Ô Nhịp',
      prev:    '⏮ Về Đoạn Trước',
      countin: '🔥 Đếm Nhịp Vào Bài',
      chorus:  '⚡ Vào Điệp Khúc',
      snap:    '🔄 Quay về Ca Trưởng'
    };

    const label = actionLabels[action] || action.toUpperCase();
    toast.textContent = `🦶 ${source} ➔ ${label}`;
    toast.classList.add('visible');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 1800);
  }

  return {
    init,
    setEnabled: (val) => { _isEnabled = !!val; },
    isEnabled: () => _isEnabled,
    dispatchAction: _dispatchAction
  };
})();

window.PedalMidiEngine = PedalMidiEngine;
