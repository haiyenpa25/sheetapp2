/**
 * assets/js/core/MidiEngine.js
 *
 * Bộ tích hợp Web MIDI Hardware dùng chung cho toàn bộ hệ thống SheetApp2:
 * 1. Quản lý kết nối phần cứng MIDI (USB MIDI Keyboard, Bluetooth MIDI, Bàn đạp chân Foot Pedal)
 * 2. Giải mã thông điệp MIDI chuẩn:
 *    - Note On / Note Off (theo dõi active notes, chuyển đổi số nốt sang nốt nhạc C4, D4... và pitch class)
 *    - Control Change (CC) (Bàn đạp vang sustain CC64, sostenuto CC66, soft pedal CC67)
 * 3. Phát sự kiện tập trung qua EventBus và các callback nội bộ
 * 4. Tương thích ngược hoàn toàn với MidiInputEngine và PedalMidiEngine
 *
 * Expose: window.MidiEngine
 */
(function(window) {
  'use strict';

  let _midiAccess = null;
  let _inputs = [];
  const _activeNotes = new Set();
  let _status = 'uninitialized'; // 'uninitialized' | 'connected' | 'no_devices' | 'unsupported' | 'error'
  let _deviceName = '';
  const _listeners = new Set();
  let _pedalActionHandler = null;

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * Chuyển số MIDI (0-127) thành tên nốt (ví dụ: 60 -> C4)
   */
  function midiToNoteName(midi) {
    if (typeof midi !== 'number' || midi < 0 || midi > 127) return '';
    const oct = Math.floor(midi / 12) - 1;
    const name = NOTE_NAMES[midi % 12];
    return `${name}${oct}`;
  }

  /**
   * Chuyển số MIDI thành pitch class (0 = C, 1 = C#, ..., 11 = B)
   */
  function midiToPitchClass(midi) {
    return (typeof midi === 'number') ? (midi % 12) : 0;
  }

  /**
   * Khởi tạo Web MIDI API
   */
  async function init(options = {}) {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      _status = 'unsupported';
      _notifyStatus();
      return false;
    }

    try {
      _midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      _midiAccess.onstatechange = _onStateChange;
      _updateInputs();
      return true;
    } catch (err) {
      _status = 'error';
      _notifyStatus(err.message || 'MIDI access denied');
      return false;
    }
  }

  function _updateInputs() {
    if (!_midiAccess) return;
    _inputs = [];
    const inputsIter = _midiAccess.inputs.values();
    for (const input of inputsIter) {
      input.onmidimessage = _onMidiMessage;
      _inputs.push(input);
    }

    if (_inputs.length > 0) {
      _status = 'connected';
      _deviceName = _inputs.map(i => i.name || 'MIDI Device').join(', ');
    } else {
      _status = 'no_devices';
      _deviceName = '';
    }
    _notifyStatus();
  }

  function _onStateChange() {
    _updateInputs();
  }

  /**
   * Bộ xử lý thông điệp MIDI thô
   */
  function _onMidiMessage(event) {
    if (!event.data) return;

    const [status, data1, data2] = event.data;
    const cmd = status >> 4;
    const channel = status & 0xf;

    // 1. Note On: cmd === 9 và velocity > 0
    if (cmd === 9 && data2 > 0) {
      const midiNote = data1;
      const velocity = data2;
      _activeNotes.add(midiNote);

      const notePayload = {
        type: 'noteon',
        note: midiNote,
        velocity,
        channel,
        noteName: midiToNoteName(midiNote),
        pitchClass: midiToPitchClass(midiNote),
        activeNotes: Array.from(_activeNotes)
      };

      _dispatchMidiEvent('noteon', notePayload);
      if (window.EventBus) window.EventBus.emit('midi:noteon', notePayload);
    }
    // 2. Note Off: cmd === 8 hoặc (cmd === 9 và velocity === 0)
    else if (cmd === 8 || (cmd === 9 && data2 === 0)) {
      const midiNote = data1;
      _activeNotes.delete(midiNote);

      const notePayload = {
        type: 'noteoff',
        note: midiNote,
        velocity: data2,
        channel,
        noteName: midiToNoteName(midiNote),
        pitchClass: midiToPitchClass(midiNote),
        activeNotes: Array.from(_activeNotes)
      };

      _dispatchMidiEvent('noteoff', notePayload);
      if (window.EventBus) window.EventBus.emit('midi:noteoff', notePayload);
    }
    // 3. Control Change (CC): cmd === 11 (Bàn đạp Foot Pedal & thanh gạt)
    else if (cmd === 11) {
      const ccNum = data1;
      const ccVal = data2;

      const ccPayload = {
        type: 'cc',
        controller: ccNum,
        value: ccVal,
        channel
      };

      _dispatchMidiEvent('cc', ccPayload);
      if (window.EventBus) window.EventBus.emit('midi:cc', ccPayload);

      // Nhận diện bàn đạp chân đạp xuống (value > 63)
      if (ccVal > 63) {
        let pedalType = '';
        let pedalAction = '';

        if (ccNum === 64) {
          pedalType = 'sustain';
          pedalAction = 'next';
        } else if (ccNum === 66) {
          pedalType = 'sostenuto';
          pedalAction = 'prev';
        } else if (ccNum === 67) {
          pedalType = 'soft';
          pedalAction = 'countin';
        }

        if (pedalType) {
          const pedalPayload = { type: 'pedal', pedal: pedalType, action: pedalAction, value: ccVal };
          _dispatchMidiEvent('pedal', pedalPayload);
          if (window.EventBus) window.EventBus.emit('midi:pedal', pedalPayload);
          if (typeof _pedalActionHandler === 'function') {
            _pedalActionHandler(pedalAction, `MIDI Pedal (CC${ccNum})`);
          }
        }
      }
    }
  }

  function _dispatchMidiEvent(type, payload) {
    _listeners.forEach(cb => {
      try { cb(type, payload); } catch (e) { console.error('[MidiEngine] listener error:', e); }
    });
  }

  function _notifyStatus(errorMsg = '') {
    const statusPayload = {
      status: _status,
      deviceName: _deviceName,
      devicesCount: _inputs.length,
      error: errorMsg
    };

    _dispatchMidiEvent('status', statusPayload);
    if (window.EventBus) window.EventBus.emit('midi:status', statusPayload);
  }

  /**
   * Đăng ký callback
   */
  function on(cb) {
    if (typeof cb === 'function') {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    }
    return () => {};
  }

  function getStatus() {
    return _status;
  }

  function getDeviceName() {
    return _deviceName;
  }

  function getActiveNotes() {
    return Array.from(_activeNotes);
  }

  function clearActiveNotes() {
    _activeNotes.clear();
  }

  function setPedalActionHandler(fn) {
    _pedalActionHandler = fn;
  }

  const MidiEngine = {
    init,
    on,
    getStatus,
    getDeviceName,
    getActiveNotes,
    clearActiveNotes,
    setPedalActionHandler,
    midiToNoteName,
    midiToPitchClass
  };

  window.MidiEngine = MidiEngine;

  // ── BACKWARD COMPATIBILITY SHIMS ──
  // Hỗ trợ MidiInputEngine cho /learn/
  window.MidiInputEngine = window.MidiInputEngine || {
    init: MidiEngine.init,
    getStatus: MidiEngine.getStatus,
    getDeviceName: MidiEngine.getDeviceName,
    getActiveNotes: MidiEngine.getActiveNotes,
    clearActiveNotes: MidiEngine.clearActiveNotes,
    midiToNoteName: MidiEngine.midiToNoteName,
    midiToPitchClass: MidiEngine.midiToPitchClass,
    on: (fn) => MidiEngine.on((type, data) => fn(data))
  };

})(window);
