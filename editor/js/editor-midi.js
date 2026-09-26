/**
 * editor/js/editor-midi.js — Web MIDI Controller & Interactive Mini Piano Keyboard
 * Cho phép cắm đàn MIDI USB/Bluetooth gõ nốt tức thì và phím đàn ảo trực quan trên màn hình.
 */
(() => {
  'use strict';

  let _midiAccess = null;

  function initWebMidi(onNoteReceivedFn) {
    if (!navigator.requestMIDIAccess) {
      const badge = document.getElementById('midi-status-badge');
      if (badge) {
        badge.title = 'Trình duyệt không hỗ trợ Web MIDI API (Hãy dùng Google Chrome hoặc Edge)';
      }
      return;
    }

    navigator.requestMIDIAccess({ sysex: false }).then(
      (midiAccess) => {
        _midiAccess = midiAccess;
        updateMidiStatus(onNoteReceivedFn);
        _midiAccess.onstatechange = () => updateMidiStatus(onNoteReceivedFn);
      },
      (err) => {
        console.warn('[WebMIDI] Request access error:', err);
      }
    );
  }

  function updateMidiStatus(onNoteReceivedFn) {
    const badge = document.getElementById('midi-status-badge');
    const textEl = document.getElementById('midi-status-text');
    if (!badge || !_midiAccess) return;

    const inputs = Array.from(_midiAccess.inputs.values());
    if (inputs.length > 0) {
      badge.classList.remove('disconnected');
      badge.classList.add('connected');
      const devName = inputs[0].name || 'Đã kết nối';
      if (textEl) textEl.textContent = `🎹 MIDI: ${devName}`;
      badge.title = `Đã kết nối với đàn ${devName} qua Web MIDI. Gõ phím trên đàn để nhập nốt!`;

      inputs.forEach(input => {
        input.onmidimessage = (event) => handleMidiMessage(event, onNoteReceivedFn);
      });
    } else {
      badge.classList.remove('connected');
      badge.classList.add('disconnected');
      if (textEl) textEl.textContent = '🎹 MIDI: Chưa cắm';
      badge.title = 'Cắm đàn Piano/Organ qua USB hoặc Bluetooth MIDI để gõ nốt trực tiếp';
    }
  }

  function handleMidiMessage(event, onNoteReceivedFn) {
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;

    // Note On (command 9 và velocity > 0)
    if (command === 9 && velocity > 0) {
      const badge = document.getElementById('midi-status-badge');
      if (badge) {
        badge.classList.add('note-active');
        setTimeout(() => badge.classList.remove('note-active'), 150);
      }

      const chromaticMap = [
        { step: 'C', alter: 0 },
        { step: 'C', alter: 1 },
        { step: 'D', alter: 0 },
        { step: 'D', alter: 1 },
        { step: 'E', alter: 0 },
        { step: 'F', alter: 0 },
        { step: 'F', alter: 1 },
        { step: 'G', alter: 0 },
        { step: 'G', alter: 1 },
        { step: 'A', alter: 0 },
        { step: 'A', alter: 1 },
        { step: 'B', alter: 0 }
      ];
      const item = chromaticMap[noteNumber % 12];
      const oct = Math.floor(noteNumber / 12) - 1;

      if (typeof onNoteReceivedFn === 'function') {
        onNoteReceivedFn(item.step, oct, item.alter);
      }
    }
  }

  function buildMiniPiano(onKeyTriggerFn) {
    const container = document.getElementById('mini-piano');
    if (!container) return;
    container.innerHTML = '';

    const notesInOctave = [
      { step: 'C', isBlack: false },
      { step: 'C', alter: 1, isBlack: true, label: 'C♯' },
      { step: 'D', isBlack: false },
      { step: 'D', alter: 1, isBlack: true, label: 'D♯' },
      { step: 'E', isBlack: false },
      { step: 'F', isBlack: false },
      { step: 'F', alter: 1, isBlack: true, label: 'F♯' },
      { step: 'G', isBlack: false },
      { step: 'G', alter: 1, isBlack: true, label: 'G♯' },
      { step: 'A', isBlack: false },
      { step: 'A', alter: 1, isBlack: true, label: 'A♯' },
      { step: 'B', isBlack: false }
    ];

    [3, 4, 5].forEach(oct => {
      notesInOctave.forEach(item => {
        const key = document.createElement('div');
        key.className = `piano-key ${item.isBlack ? 'piano-black-key' : 'piano-white-key'}`;
        key.dataset.step = item.step;
        key.dataset.octave = oct;
        key.dataset.alter = item.alter || 0;

        const pitchName = item.isBlack ? `${item.step}♯${oct} / ${item.label || ''}` : `${item.step}${oct}`;
        key.title = pitchName;

        if (!item.isBlack && item.step === 'C') {
          const span = document.createElement('span');
          span.textContent = `C${oct}`;
          key.appendChild(span);
        }

        const handleKeyTrigger = (e) => {
          e.preventDefault();
          if (typeof onKeyTriggerFn === 'function') {
            onKeyTriggerFn(item.step, oct, item.alter || 0);
          }
        };

        key.addEventListener('click', handleKeyTrigger);
        key.addEventListener('touchstart', (e) => {
          e.preventDefault();
          handleKeyTrigger(e);
        }, { passive: false });

        container.appendChild(key);
      });
    });
  }

  window.EditorMidi = {
    initWebMidi,
    updateMidiStatus,
    handleMidiMessage,
    buildMiniPiano
  };
})();
