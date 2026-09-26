/**
 * assets/js/learn/midi/midi-input-engine.js — Stage 9: Web MIDI Hardware Integration
 *
 * Quản lý kết nối bàn phím MIDI / Piano điện (USB-MIDI hoặc Bluetooth MIDI).
 * Lắng nghe noteOn, noteOff, tracking nốt đang bấm, và phát sự kiện EventBus.
 *
 * Expose: window.MidiInputEngine
 */
const MidiInputEngine = (() => {
  'use strict';

  let _midiAccess = null;
  let _inputs = [];
  let _activeNotes = new Set(); // Set of MIDI note numbers currently pressed
  let _listeners = [];
  let _status = 'uninitialized'; // 'uninitialized' | 'connected' | 'no_devices' | 'unsupported' | 'error'
  let _deviceName = '';

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function midiToNoteName(midi) {
    const oct = Math.floor(midi / 12) - 1;
    const name = NOTE_NAMES[midi % 12];
    return `${name}${oct}`;
  }

  function midiToPitchClass(midi) {
    return midi % 12;
  }

  async function init() {
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
      _notifyStatus(err.message);
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

  function _onMidiMessage(event) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const cmd = data[0] >> 4;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] : 0;

    // Note On (cmd === 9) with velocity > 0
    if (cmd === 9 && velocity > 0) {
      _activeNotes.add(note);
      _emitNoteOn(note, velocity);
    }
    // Note Off (cmd === 8 or cmd === 9 with velocity === 0)
    else if (cmd === 8 || (cmd === 9 && velocity === 0)) {
      _activeNotes.delete(note);
      _emitNoteOff(note);
    }

    _emitActiveNotesChanged();
  }

  function _emitNoteOn(note, velocity) {
    const noteName = midiToNoteName(note);
    // Play audio feedback if sound engine exists
    if (window.LearnSoundEngine && LearnSoundEngine.triggerNote) {
      LearnSoundEngine.triggerNote('piano', noteName, 0.4, undefined, velocity / 127);
    }

    _listeners.forEach(fn => fn({ type: 'note_on', note, noteName, velocity }));
    if (window.EventBus) {
      EventBus.emit('LEARN_MIDI_NOTE_ON', { note, noteName, velocity });
    }
  }

  function _emitNoteOff(note) {
    const noteName = midiToNoteName(note);
    _listeners.forEach(fn => fn({ type: 'note_off', note, noteName }));
    if (window.EventBus) {
      EventBus.emit('LEARN_MIDI_NOTE_OFF', { note, noteName });
    }
  }

  function _emitActiveNotesChanged() {
    const activeArr = Array.from(_activeNotes);
    const activeNames = activeArr.map(midiToNoteName);

    // Update VirtualKeyboard active keys in real time
    if (window.VirtualKeyboard && VirtualKeyboard.setUserActiveNotes) {
      VirtualKeyboard.setUserActiveNotes(activeNames);
    }

    _listeners.forEach(fn => fn({ type: 'active_notes_changed', notes: activeArr, noteNames: activeNames }));
    if (window.EventBus) {
      EventBus.emit('LEARN_MIDI_NOTES_CHANGED', { notes: activeArr, noteNames: activeNames });
    }
  }

  function _notifyStatus() {
    const statusBadge = document.getElementById('learn-midi-badge');
    if (statusBadge) {
      if (_status === 'connected') {
        statusBadge.className = 'learn-status-badge learn-midi-connected';
        statusBadge.textContent = `🎹 MIDI: ${_deviceName || 'Đã kết nối'}`;
        statusBadge.title = `Đang kết nối: ${_deviceName}`;
      } else if (_status === 'no_devices') {
        statusBadge.className = 'learn-status-badge learn-midi-waiting';
        statusBadge.textContent = '🎹 MIDI: Chờ cắm đàn';
        statusBadge.title = 'Chưa nhận thấy đàn MIDI. Hãy cắm cáp USB vào máy tính và bật đàn.';
      } else if (_status === 'unsupported') {
        statusBadge.className = 'learn-status-badge learn-midi-unsupported';
        statusBadge.textContent = '🎹 MIDI: Không hỗ trợ';
        statusBadge.title = 'Trình duyệt không hỗ trợ Web MIDI. Bạn vẫn có thể nhấp chuột trên đàn ảo!';
      }
    }
  }

  // Simulation API for mouse clicks or touch on VirtualKeyboard
  function simulateNoteOn(noteName) {
    if (!window.Tonal) return;
    const midi = Tonal.Note.midi(noteName);
    if (midi !== null) {
      _activeNotes.add(midi);
      _emitNoteOn(midi, 100);
      _emitActiveNotesChanged();
    }
  }

  function simulateNoteOff(noteName) {
    if (!window.Tonal) return;
    const midi = Tonal.Note.midi(noteName);
    if (midi !== null) {
      _activeNotes.delete(midi);
      _emitNoteOff(midi);
      _emitActiveNotesChanged();
    }
  }

  function onMidiEvent(listener) {
    if (typeof listener === 'function') _listeners.push(listener);
  }

  function getActiveNotes() {
    return Array.from(_activeNotes);
  }

  function getStatus() {
    return { status: _status, deviceName: _deviceName, inputsCount: _inputs.length };
  }

  return {
    init,
    onMidiEvent,
    getActiveNotes,
    getStatus,
    simulateNoteOn,
    simulateNoteOff,
    midiToNoteName,
    midiToPitchClass
  };
})();

if (typeof window !== 'undefined') {
  window.MidiInputEngine = MidiInputEngine;
}
