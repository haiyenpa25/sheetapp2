/**
 * editor/js/editor-ui.js — Editor Inspector & DOM Synchronization UI
 * Đồng bộ dữ liệu nốt đang chọn với thanh công cụ Inspector, QuickBar và các phím tắt.
 */
(() => {
  'use strict';

  function refreshInspectorUI(selectedPosition, measureHealth, isSmartOverwriteMode) {
    const { measureNumber, voice, beatIndex } = selectedPosition;
    const satb = window.EditorParser?.extractSatbNotesAt(window.SheetEditor?.getXmlDoc(), measureNumber, beatIndex);
    if (!satb) return;

    selectedPosition.activeVoiceMap = {
      soprano: satb.soprano,
      alto:    satb.alto,
      tenor:   satb.tenor,
      bass:    satb.bass
    };

    const posLabel = document.getElementById('pos-info-label');
    if (posLabel) {
      posLabel.innerHTML = `Ô nhịp: <strong>${measureNumber}</strong> | Phách: <strong>${(beatIndex || 0) + 1}/${satb.totalBeats || 1}</strong>`;
    }

    ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
      const data = satb[v];
      const lbl = document.getElementById(`lbl-pitch-${v}`);
      if (lbl) {
        if (!data) lbl.textContent = 'Trống';
        else if (data.isRest) lbl.textContent = '𝄽 Nghỉ';
        else {
          const accSym = data.alter === 1 ? '♯' : (data.alter === -1 ? '♭' : '');
          lbl.textContent = `${data.step}${accSym}${data.octave}`;
        }
      }
    });

    document.querySelectorAll('.satb-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.voice === voice);
    });

    const curNote = selectedPosition.activeVoiceMap[voice];
    if (!curNote) {
      setControlsDisabled(true);
      return;
    }
    setControlsDisabled(false);

    const quickbarHint = document.getElementById('smart-quickbar-hint');
    if (quickbarHint) {
      const typeMapVi = { whole: 'Tròn (4 phách)', half: 'Trắng (2 phách)', quarter: 'Đen (1 phách)', eighth: 'Móc đơn (1/2)', '16th': 'Móc kép (1/4)' };
      const typeVi = typeMapVi[curNote.type] || curNote.type;
      const voiceVi = { soprano: 'Soprano', alto: 'Alto', tenor: 'Tenor', bass: 'Bass' }[voice] || voice;
      if (curNote.isRest) {
        quickbarHint.innerHTML = `Bè <strong>${voiceVi}</strong> · Dấu lặng <strong>${typeVi}</strong>`;
      } else {
        const acc = curNote.alter === 1 ? '♯' : (curNote.alter === -1 ? '♭' : '');
        quickbarHint.innerHTML = `Bè <strong>${voiceVi}</strong> · Nốt <strong>${curNote.step}${acc}${curNote.octave} (${typeVi})</strong>`;
      }
    }

    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.classList.toggle('active', !curNote.isRest && btn.dataset.step === curNote.step);
    });

    const octValEl = document.getElementById('current-octave-val');
    if (octValEl) octValEl.textContent = curNote.octave;
    document.querySelectorAll('.pill-oct').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.oct, 10) === curNote.octave);
    });

    document.querySelectorAll('[data-acc]').forEach(btn => {
      let isMatch = false;
      if (btn.dataset.acc === 'sharp' && curNote.alter === 1) isMatch = true;
      if (btn.dataset.acc === 'flat' && curNote.alter === -1) isMatch = true;
      if (btn.dataset.acc === 'natural' && curNote.alter === 0) isMatch = true;
      btn.classList.toggle('active', isMatch);
    });

    document.querySelectorAll('[data-dur], .btn-dur:not(.btn-dot)').forEach(btn => {
      const type = btn.dataset.dur || btn.dataset.type;
      btn.classList.toggle('active', type === curNote.type);
    });

    document.getElementById('btn-pal-dot')?.classList.toggle('active', !!curNote.isDot);
    document.getElementById('btn-pal-tie')?.classList.toggle('active', !!curNote.isTie);
    document.getElementById('btn-pal-slur')?.classList.toggle('active', !!curNote.isSlur);
    document.getElementById('btn-pal-staccato')?.classList.toggle('active', !!curNote.isStaccato);
    document.getElementById('btn-pal-accent')?.classList.toggle('active', !!curNote.isAccent);
    document.getElementById('btn-pal-tenuto')?.classList.toggle('active', !!curNote.isTenuto);
    document.getElementById('btn-pal-fermata')?.classList.toggle('active', !!curNote.isFermata);
    document.getElementById('btn-pal-tuplet')?.classList.toggle('active', !!curNote.isTuplet);

    const lyricInput = document.getElementById('input-note-lyric');
    if (lyricInput && document.activeElement !== lyricInput) {
      lyricInput.value = curNote.lyric || '';
    }

    if (window.EditorDrag) window.EditorDrag.highlightSelectedSvgNote(selectedPosition);
    if (window.EditorHealth) window.EditorHealth.updateRealtimeMeasureUI(measureHealth, selectedPosition);
  }

  function setControlsDisabled(disabled) {
    document.querySelectorAll('.inspector-body button:not(.btn-solo):not(.btn-mute):not(.btn-m-action), .inspector-body input:not(.ch-volume):not(#slider-tempo)').forEach(el => {
      el.disabled = disabled;
    });
  }

  function bindEditorEvents(ctx) {
    const {
      onZoom,
      onUndo,
      onRedo,
      onOpenSaveModal,
      onCloseSaveModal,
      onConfirmSave,
      onAutoFillAllRests,
      onSelectSongModal,
      onCloseSongModal,
      onSearchSongs,
      onPrevSong,
      onNextSong,
      onSelectVoice,
      onModifyPitch,
      onModifyOctave,
      onModifyDuration,
      onToggleDot,
      onDeleteAsRest,
      onSplitNote,
      onToggleArticulation,
      onStepSemitone,
      onSubdivideRests,
      onMergeRests,
      onModifyAccidental,
      onAutoFillMeasureRests,
      onTogglePlayback,
      onRewindPlayback,
      onOpenAiModal,
      onCloseAiModal,
      onConfirmAiHarmonize,
      onToggleRehearsal,
      onOpenExportModal,
      onCloseExportModal,
      onExportPdf,
      onExportXml,
      onExportMidi,
      getCurrentNote,
      getSelectedPosition
    } = ctx;

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => onZoom(0.1));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => onZoom(-0.1));

    document.getElementById('btn-undo')?.addEventListener('click', onUndo);
    document.getElementById('btn-redo')?.addEventListener('click', onRedo);

    document.getElementById('btn-open-save-modal')?.addEventListener('click', onOpenSaveModal);
    document.getElementById('btn-close-save-modal')?.addEventListener('click', onCloseSaveModal);
    document.getElementById('btn-cancel-save')?.addEventListener('click', onCloseSaveModal);
    document.getElementById('btn-confirm-save-version')?.addEventListener('click', onConfirmSave);
    document.getElementById('btn-modal-autofill-rests')?.addEventListener('click', () => {
      onAutoFillAllRests();
      onCloseSaveModal();
    });

    document.querySelectorAll('input[name="save-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.choice-option').forEach(opt => opt.classList.remove('selected'));
        radio.closest('.choice-option')?.classList.add('selected');
      });
    });

    const verBtn = document.getElementById('btn-editor-version');
    const verDropdown = document.getElementById('editor-version-dropdown');
    verBtn?.addEventListener('click', (e) => { e.stopPropagation(); verDropdown?.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (!verBtn?.contains(e.target) && !verDropdown?.contains(e.target)) verDropdown?.classList.add('hidden');
    });

    document.getElementById('btn-select-song')?.addEventListener('click', onSelectSongModal);
    document.getElementById('btn-close-picker-modal')?.addEventListener('click', onCloseSongModal);
    document.getElementById('song-search-input')?.addEventListener('input', (e) => onSearchSongs(e.target.value));

    document.getElementById('btn-prev-song')?.addEventListener('click', onPrevSong);
    document.getElementById('btn-next-song')?.addEventListener('click', onNextSong);

    document.querySelectorAll('.satb-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => onSelectVoice(btn.dataset.voice));
    });

    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', () => onModifyPitch(btn.dataset.step));
    });

    document.getElementById('btn-oct-dec')?.addEventListener('click', () => onModifyOctave(-1));
    document.getElementById('btn-oct-inc')?.addEventListener('click', () => onModifyOctave(1));

    document.querySelectorAll('[data-dur]').forEach(btn => {
      btn.addEventListener('click', () => onModifyDuration(btn.dataset.dur));
    });
    document.getElementById('btn-pal-dot')?.addEventListener('click', onToggleDot);
    document.getElementById('btn-pal-delete-rest')?.addEventListener('click', onDeleteAsRest);
    document.getElementById('btn-pal-split-note')?.addEventListener('click', onSplitNote);

    ['tie', 'slur', 'fermata', 'tuplet', 'staccato', 'accent', 'tenuto'].forEach(art => {
      document.getElementById(`btn-pal-${art}`)?.addEventListener('click', () => onToggleArticulation(art));
    });

    document.getElementById('btn-semi-dec')?.addEventListener('click', () => onStepSemitone(-1));
    document.getElementById('btn-semi-inc')?.addEventListener('click', () => onStepSemitone(1));

    document.getElementById('btn-subdivide-2')?.addEventListener('click', () => onSubdivideRests(2));
    document.getElementById('btn-merge-rests')?.addEventListener('click', onMergeRests);

    document.querySelectorAll('[data-acc]').forEach(btn => {
      btn.addEventListener('click', () => onModifyAccidental(btn.dataset.acc));
    });

    document.getElementById('btn-auto-fix-all-rests')?.addEventListener('click', onAutoFillAllRests);
    document.getElementById('btn-inspector-autofill')?.addEventListener('click', onAutoFillMeasureRests);

    document.getElementById('btn-transport-play')?.addEventListener('click', onTogglePlayback);
    document.getElementById('btn-transport-stop')?.addEventListener('click', onRewindPlayback);

    document.getElementById('btn-ai-harmonize')?.addEventListener('click', onOpenAiModal);
    document.getElementById('btn-close-ai-modal')?.addEventListener('click', onCloseAiModal);
    document.getElementById('btn-cancel-ai')?.addEventListener('click', onCloseAiModal);
    document.getElementById('btn-confirm-ai-harmonize')?.addEventListener('click', onConfirmAiHarmonize);
    document.getElementById('btn-toggle-rehearsal')?.addEventListener('click', onToggleRehearsal);

    document.getElementById('btn-open-export-modal')?.addEventListener('click', onOpenExportModal);
    document.getElementById('btn-close-export-modal')?.addEventListener('click', onCloseExportModal);
    document.getElementById('btn-export-pdf')?.addEventListener('click', onExportPdf);
    document.getElementById('btn-export-xml')?.addEventListener('click', onExportXml);
    document.getElementById('btn-export-midi')?.addEventListener('click', onExportMidi);

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); onRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onOpenSaveModal(); return; }
      if (e.key === 'Escape') {
        document.getElementById('shortcut-guide-modal')?.classList.add('hidden');
        document.getElementById('export-score-modal')?.classList.add('hidden');
        document.getElementById('save-version-modal')?.classList.add('hidden');
        document.getElementById('ai-harmonize-modal')?.classList.add('hidden');
        return;
      }

      if ((e.altKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const v = ['soprano', 'alto', 'tenor', 'bass'][parseInt(e.key, 10) - 1];
        if (v) onSelectVoice(v);
        return;
      }

      const keyUpper = e.key.toUpperCase();
      if (['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(keyUpper) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const cur = getCurrentNote();
        const pos = getSelectedPosition();
        if (cur && pos) {
          const defP = { soprano: 4, alto: 4, tenor: 3, bass: 2 }[pos.voice] || 4;
          const oct = cur.isRest ? defP : cur.octave;
          onModifyPitch(keyUpper, oct, cur.isRest ? 0 : cur.alter);
        }
      }
    });
  }

  window.EditorUI = {
    refreshInspectorUI,
    setControlsDisabled,
    bindEditorEvents
  };
})();
