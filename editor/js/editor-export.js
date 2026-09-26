/**
 * editor/js/editor-export.js — MusicXML / PDF / MIDI Export Hub
 * Phục vụ xuất bản ấn phẩm vector A4, tải file MusicXML chuẩn, và xuất file Standard MIDI đa bè.
 */
(() => {
  'use strict';

  function openExportModal() {
    document.getElementById('export-score-modal')?.classList.remove('hidden');
  }

  function closeExportModal() {
    document.getElementById('export-score-modal')?.classList.add('hidden');
  }

  function exportPdfScore(showToastFn) {
    closeExportModal();
    if (typeof showToastFn === 'function') {
      showToastFn('📄 Đang mở cửa sổ in PDF Vector A4...', 'info', 1500);
    }
    setTimeout(() => {
      window.print();
    }, 200);
  }

  function exportMusicXmlScore(xmlDoc, currentSong, showToastFn) {
    if (!xmlDoc) return;
    try {
      const serializer = new XMLSerializer();
      const xmlString = serializer.serializeToString(xmlDoc);
      const blob = new Blob([xmlString], { type: 'application/vnd.recordare.musicxml+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = (currentSong?.slug || 'sheetapp-score') + '.musicxml';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeExportModal();
      if (typeof showToastFn === 'function') {
        showToastFn(`🎼 Đã tải file MusicXML (${filename}) thành công!`, 'success', 2500);
      }
    } catch (e) {
      if (typeof showToastFn === 'function') {
        showToastFn('⚠️ Lỗi xuất MusicXML: ' + e.message, 'danger', 3000);
      }
    }
  }

  function exportMidiScore(xmlDoc, currentSong, mixerState, getMeasureChordsSATBFn, pitchToMidiFn, showToastFn) {
    if (!xmlDoc) return;
    try {
      const midiBlob = createStandardMidiFile(xmlDoc, currentSong, mixerState, getMeasureChordsSATBFn, pitchToMidiFn);
      const url = URL.createObjectURL(midiBlob);
      const a = document.createElement('a');
      const filename = (currentSong?.slug || 'sheetapp-score') + '.mid';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeExportModal();
      if (typeof showToastFn === 'function') {
        showToastFn(`🎹 Đã tải file MIDI (${filename}) thành công!`, 'success', 2500);
      }
    } catch (e) {
      if (typeof showToastFn === 'function') {
        showToastFn('⚠️ Lỗi xuất MIDI: ' + e.message, 'danger', 3000);
      }
    }
  }

  function createStandardMidiFile(xmlDoc, currentSong, mixerState, getMeasureChordsSATBFn, pitchToMidiFn) {
    const ticksPerQuarter = 480;
    const bpm = mixerState?.tempo || 84;
    const microsecPerQuarter = Math.round(60000000 / bpm);
    const trackEvents = [];

    function writeVarLen(val) {
      let buffer = val & 0x7f;
      while ((val >>= 7) > 0) {
        buffer <<= 8;
        buffer |= 0x80;
        buffer += (val & 0x7f);
      }
      const bytes = [];
      while (true) {
        bytes.push(buffer & 0xff);
        if (buffer & 0x80) buffer >>= 8;
        else break;
      }
      return bytes;
    }

    // Tempo event at delta 0: FF 51 03
    trackEvents.push(0x00, 0xff, 0x51, 0x03,
      (microsecPerQuarter >> 16) & 0xff,
      (microsecPerQuarter >> 8) & 0xff,
      microsecPerQuarter & 0xff
    );

    // Track Name
    const title = (currentSong?.title || 'SheetApp Choral Score');
    const titleBytes = Array.from(new TextEncoder().encode(title));
    trackEvents.push(0x00, 0xff, 0x03, titleBytes.length, ...titleBytes);

    // Collect note events
    const p1 = xmlDoc.querySelector('part#P1') || xmlDoc.querySelector('part');
    if (p1 && typeof getMeasureChordsSATBFn === 'function' && typeof pitchToMidiFn === 'function') {
      const measures = Array.from(p1.querySelectorAll('measure'));
      measures.forEach(m => {
        const mNum = parseInt(m.getAttribute('number') || '1', 10);
        const satbGroup = getMeasureChordsSATBFn(mNum);
        if (Array.isArray(satbGroup)) {
          satbGroup.forEach(chord => {
            ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
              const n = chord[v];
              if (n && !n.isRest && n.step) {
                const midi = pitchToMidiFn(n.step, n.octave, n.alter);
                trackEvents.push(0x00, 0x90, midi, 0x5a); // Note on
                trackEvents.push(...writeVarLen(ticksPerQuarter), 0x80, midi, 0x00); // Note off
              }
            });
          });
        }
      });
    }

    // End of Track
    trackEvents.push(0x00, 0xff, 0x2f, 0x00);

    const header = [
      0x4d, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00,
      0x00, 0x01,
      (ticksPerQuarter >> 8) & 0xff, ticksPerQuarter & 0xff
    ];

    const trkLen = trackEvents.length;
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b,
      (trkLen >> 24) & 0xff,
      (trkLen >> 16) & 0xff,
      (trkLen >> 8) & 0xff,
      trkLen & 0xff
    ];

    const fullMidiBytes = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
    return new Blob([fullMidiBytes], { type: 'audio/midi' });
  }

  window.EditorExport = {
    openExportModal,
    closeExportModal,
    exportPdfScore,
    exportMusicXmlScore,
    exportMidiScore,
    createStandardMidiFile
  };
})();
