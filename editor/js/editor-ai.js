/**
 * editor/js/editor-ai.js — AI SATB Harmonization & Rehearsal Focus Engine
 * Tự động hòa âm 4 bè theo phong cách Thánh ca truyền thống & chế độ luyện bè tập trung.
 */
(() => {
  'use strict';

  function openAiHarmonizeModal() {
    document.getElementById('ai-harmonize-modal')?.classList.remove('hidden');
  }

  function closeAiHarmonizeModal() {
    document.getElementById('ai-harmonize-modal')?.classList.add('hidden');
  }

  async function executeAiHarmonization(context) {
    const {
      xmlDoc,
      selectedPosition,
      pushUndoStateFn,
      showToastFn,
      getMeasureChordsSATBFn,
      extractSatbNotesAtFn,
      setNotePitchInXmlFn,
      renderOsmdFromXmlDocFn,
      playSatbChordFn
    } = context;

    if (!xmlDoc) return;
    const scopeEl = document.getElementById('select-ai-scope');
    const scope = scopeEl?.value || 'all';

    if (typeof pushUndoStateFn === 'function') {
      pushUndoStateFn('AI Hòa Âm 4 Bè SATB');
    }
    if (typeof showToastFn === 'function') {
      showToastFn('✨ AI đang phân tích giai điệu và thiết lập hòa âm 4 bè...', 'info', 2000);
    }

    try {
      // 1. Nhận diện giọng điệu (Key)
      const fifthsVal = parseInt(xmlDoc.querySelector('key fifths')?.textContent || '0', 10);
      const fifthsMap = {
        0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B',
        '-1': 'F', '-2': 'Bb', '-3': 'Eb', '-4': 'Ab', '-5': 'Db'
      };
      const keyName = fifthsMap[fifthsVal] || 'C';

      // Hợp âm hòa thanh kinh điển theo giọng
      const chordsDict = {
        C:  { I: ['C','E','G'], ii: ['D','F','A'], IV: ['F','A','C'], V: ['G','B','D'], vi: ['A','C','E'] },
        G:  { I: ['G','B','D'], ii: ['A','C','E'], IV: ['C','E','G'], V: ['D','F#','A'], vi: ['E','G','B'] },
        F:  { I: ['F','A','C'], ii: ['G','Bb','D'], IV: ['Bb','D','F'], V: ['C','E','G'], vi: ['D','F','A'] },
        D:  { I: ['D','F#','A'], ii: ['E','G','B'], IV: ['G','B','D'], V: ['A','C#','E'], vi: ['B','D','F#'] },
        Bb: { I: ['Bb','D','F'], ii: ['C','Eb','G'], IV: ['Eb','G','Bb'], V: ['F','A','C'], vi: ['G','Bb','D'] }
      }[keyName] || {
        I: ['C','E','G'], ii: ['D','F','A'], IV: ['F','A','C'], V: ['G','B','D'], vi: ['A','C','E']
      };

      const p1 = xmlDoc.querySelector('part#P1') || xmlDoc.querySelector('part');
      if (!p1) throw new Error('Không tìm thấy dữ liệu bè trong MusicXML');

      const measures = Array.from(p1.querySelectorAll('measure'));
      const startIdx = (scope === 'from_current') ? Math.max(0, (selectedPosition?.measureNumber || 1) - 1) : 0;

      for (let mIdx = startIdx; mIdx < measures.length; mIdx++) {
        const m = measures[mIdx];
        const mNum = parseInt(m.getAttribute('number') || String(mIdx + 1), 10);
        const satbGroup = getMeasureChordsSATBFn(mNum);

        if (Array.isArray(satbGroup)) {
          satbGroup.forEach((chordGroup, beatIdx) => {
            const s = chordGroup.soprano;
            if (!s || s.isRest || !s.step) return;

            let chord = chordsDict.I;
            if (chordsDict.V.some(t => t.startsWith(s.step))) chord = chordsDict.V;
            else if (chordsDict.IV.some(t => t.startsWith(s.step))) chord = chordsDict.IV;
            else if (chordsDict.vi.some(t => t.startsWith(s.step))) chord = chordsDict.vi;
            else if (chordsDict.ii.some(t => t.startsWith(s.step))) chord = chordsDict.ii;

            // Bass: Root
            const bNote = chord[0];
            const bStep = bNote[0];
            const bOct = (bStep === 'C' || bStep === 'D' || bStep === 'E') ? 3 : 2;

            // Alto: 3rd / 5th
            const aNote = chord[1];
            const aStep = aNote[0];
            const aOct = 4;

            // Tenor
            const tNote = chord[2];
            const tStep = tNote[0];
            const tOct = 3;

            const currSatb = extractSatbNotesAtFn(mNum, beatIdx);
            if (currSatb) {
              if (currSatb.alto?.element) setNotePitchInXmlFn(currSatb.alto.element, aStep, aOct, 0);
              if (currSatb.tenor?.element) setNotePitchInXmlFn(currSatb.tenor.element, tStep, tOct, 0);
              if (currSatb.bass?.element) setNotePitchInXmlFn(currSatb.bass.element, bStep, bOct, 0);
            }
          });
        }
      }

      if (typeof renderOsmdFromXmlDocFn === 'function') {
        await renderOsmdFromXmlDocFn();
      }
      closeAiHarmonizeModal();
      if (typeof playSatbChordFn === 'function') {
        playSatbChordFn();
      }
      if (typeof showToastFn === 'function') {
        showToastFn('✨ Phép màu AI: Đã tự động hòa âm 4 bè SATB hoàn hảo!', 'success', 3000);
      }
    } catch (err) {
      console.error('[AIHarmonizer]', err);
      if (typeof showToastFn === 'function') {
        showToastFn('⚠️ Lỗi hòa âm: ' + err.message, 'danger', 3000);
      }
    }
  }

  function toggleRehearsalMode(playbackState, selectedPosition, showToastFn, playSatbChordFn) {
    playbackState.rehearsalMode = !playbackState.rehearsalMode;
    const btn = document.getElementById('btn-toggle-rehearsal');
    const container = document.querySelector('.sheet-paper-container');

    if (btn) btn.classList.toggle('active', playbackState.rehearsalMode);
    if (container) {
      container.classList.toggle('rehearsal-mode-active', playbackState.rehearsalMode);
      ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
        container.classList.remove(`focus-${v}`);
      });
      if (playbackState.rehearsalMode) {
        container.classList.add(`focus-${selectedPosition.voice}`);
      }
    }

    const voiceName = (selectedPosition?.voice || 'soprano').toUpperCase();
    if (playbackState.rehearsalMode) {
      if (typeof showToastFn === 'function') {
        showToastFn(`🎯 Đã bật Chế độ Luyện Bè: Nổi bật bè ${voiceName} (Âm lượng 100%, 3 bè phụ 20%)`, 'info', 2500);
      }
      if (typeof playSatbChordFn === 'function') {
        playSatbChordFn();
      }
    } else {
      if (typeof showToastFn === 'function') {
        showToastFn('Đã tắt Chế độ Luyện Bè', 'info', 1500);
      }
    }
  }

  window.EditorAI = {
    openAiHarmonizeModal,
    closeAiHarmonizeModal,
    executeAiHarmonization,
    toggleRehearsalMode
  };
})();
