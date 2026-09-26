/**
 * editor/js/editor-drag.js — Vertical Drag-to-Pitch 60 FPS Optimistic UI Engine
 * Cung cấp khả năng kéo nốt thẳng đứng để đổi cao độ trực quan, âm thanh preview tức thì, và hitbox click không trượt.
 */
(() => {
  'use strict';

  const _svgNoteMap = new Map();
  const _svgLyricMap = new Map();
  let _hasBoundGlobalDragListeners = false;

  const _dragState = {
    active: false,
    pointerId: null,
    targetEl: null,
    visualEl: null,
    startY: 0,
    startX: 0,
    baseMidi: 60,
    currentStep: 'C',
    currentOctave: 4,
    currentAlter: 0,
    previewStep: 'C',
    previewOctave: 4,
    hasMoved: false,
    voice: 'soprano'
  };

  function buildSvgNoteMap(osmd) {
    _svgNoteMap.clear();
    _svgLyricMap.clear();
    if (!osmd || !osmd.GraphicSheet) return { svgNoteMap: _svgNoteMap, svgLyricMap: _svgLyricMap };

    const gs = osmd.GraphicSheet;
    (gs.MeasureList || []).forEach(staves => {
      staves.forEach((staffMeasure, sIdx) => {
        const mNum = parseInt(staffMeasure.parentSourceMeasure?.MeasureNumberXML ?? staffMeasure.MeasureNumber, 10);
        const entries = staffMeasure.staffEntries || [];
        entries.forEach((se, seIdx) => {
          (se.LyricsEntries || []).forEach(le => {
            const txt = le.graphicalLabel?.Label?.text;
            if (txt) {
              const cleanTxt = txt.replace(/^\d+\./, '').trim().toLowerCase();
              if (cleanTxt) {
                _svgLyricMap.set(`${mNum}_${cleanTxt}`, {
                  measureNumber: mNum,
                  beatIndex: seIdx,
                  staffIndex: sIdx
                });
              }
            }
          });

          (se.graphicalVoiceEntries || []).forEach(gve => {
            (gve.notes || []).forEach(gn => {
              const el = gn.getSVGGElement?.();
              if (el) {
                if (!_svgNoteMap.has(el)) {
                  _svgNoteMap.set(el, {
                    measureNumber: mNum,
                    beatIndex: seIdx,
                    staffIndex: sIdx,
                    notes: []
                  });
                }
                const p = gn.sourceNote?.Pitch;
                _svgNoteMap.get(el).notes.push({
                  step: p?.step,
                  octave: p?.octave,
                  alter: p?.alter,
                  isRest: gn.sourceNote?.isRest?.(),
                  absY: gn.PositionAndShape?.AbsolutePosition?.y || 0
                });
              }
            });
          });
        });
      });
    });

    return { svgNoteMap: _svgNoteMap, svgLyricMap: _svgLyricMap };
  }

  function resolveVoiceFromClick(info, clientY, staveNoteEl, targetEl, currentVoice) {
    if (!info) return 'soprano';

    const noteheads = Array.from(staveNoteEl.querySelectorAll('g.vf-notehead'));
    if (noteheads.length >= 2) {
      const sorted = noteheads.map(nh => {
        const r = nh.getBoundingClientRect();
        return { el: nh, centerY: r.top + r.height / 2, rect: r };
      }).sort((a, b) => a.centerY - b.centerY);

      const clickedHead = targetEl ? targetEl.closest('g.vf-notehead') : null;
      if (clickedHead) {
        if (clickedHead === sorted[0].el) {
          return info.staffIndex === 0 ? 'soprano' : 'tenor';
        }
        if (clickedHead === sorted[sorted.length - 1].el) {
          return info.staffIndex === 0 ? 'alto' : 'bass';
        }
      }

      const topDist = Math.abs(clientY - sorted[0].centerY);
      const botDist = Math.abs(clientY - sorted[sorted.length - 1].centerY);
      const isTop = topDist <= botDist;

      if (info.staffIndex === 0) {
        return isTop ? 'soprano' : 'alto';
      } else {
        return isTop ? 'tenor' : 'bass';
      }
    }

    if (info.staffIndex === 0) {
      if (currentVoice === 'alto') return 'alto';
      return 'soprano';
    } else {
      if (currentVoice === 'tenor') return 'tenor';
      return 'bass';
    }
  }

  function highlightSelectedSvgNote(selectedPosition) {
    const container = document.getElementById('osmd-editor-container');
    if (!container || !selectedPosition) return;

    container.querySelectorAll('.selected-note-item, .selected-voice-notehead, .selected-chord-peer').forEach(el => {
      el.classList.remove('selected-note-item', 'selected-voice-notehead', 'selected-chord-peer');
    });

    const { measureNumber, beatIndex, voice } = selectedPosition;
    const isUpperStaff = (voice === 'soprano' || voice === 'alto');
    const isTopVoice = (voice === 'soprano' || voice === 'tenor');

    container.querySelectorAll('svg g.vf-stavenote').forEach(n => {
      const info = _svgNoteMap.get(n);
      if (info && info.measureNumber === measureNumber && info.beatIndex === beatIndex) {
        const matchesStaff = isUpperStaff ? (info.staffIndex === 0) : (info.staffIndex === 1);
        if (matchesStaff) {
          n.classList.add('selected-note-item');

          const noteheads = Array.from(n.querySelectorAll('g.vf-notehead'));
          if (noteheads.length >= 2) {
            noteheads.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const activeNh = isTopVoice ? noteheads[0] : noteheads[1];
            const peerNh = isTopVoice ? noteheads[1] : noteheads[0];
            activeNh?.classList.add('selected-voice-notehead');
            peerNh?.classList.add('selected-chord-peer');
          } else if (noteheads.length === 1) {
            noteheads[0].classList.add('selected-voice-notehead');
          }
        }
      }
    });
  }

  function wireVerticalDragEvents(options) {
    const {
      osmd,
      zoom,
      selectedPosition,
      onSelectNote,
      onPlayPitch,
      onCommitPitch
    } = options;

    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    buildSvgNoteMap(osmd);

    const noteGroups = container.querySelectorAll('svg g.vf-stavenote');
    noteGroups.forEach(staveNote => {
      staveNote.style.cursor = 'ns-resize';
      staveNote.style.pointerEvents = 'all';

      let hitbox = staveNote.querySelector('.vf-hitbox');
      if (hitbox) hitbox.style.display = 'none';
      let b = null;
      try {
        b = staveNote.getBBox();
      } catch (err) {}
      if (hitbox) hitbox.style.display = '';

      if (b && b.width > 0 && b.height > 0) {
        if (!hitbox) {
          hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          hitbox.setAttribute('class', 'vf-hitbox');
          hitbox.setAttribute('fill', 'transparent');
          hitbox.setAttribute('pointer-events', 'all');
          hitbox.style.cursor = 'ns-resize';
          staveNote.insertBefore(hitbox, staveNote.firstChild);
        }
        const padX = 14;
        const padY = 10;
        hitbox.setAttribute('x', b.x - padX);
        hitbox.setAttribute('y', b.y - padY);
        hitbox.setAttribute('width', Math.max(38, b.width + padX * 2));
        hitbox.setAttribute('height', Math.max(44, b.height + padY * 2));
      }

      staveNote.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const info = _svgNoteMap.get(staveNote);
        let targetVoice = selectedPosition.voice;
        if (info) {
          targetVoice = resolveVoiceFromClick(info, e.clientY, staveNote, e.target, selectedPosition.voice);
          if (typeof onSelectNote === 'function') {
            onSelectNote(info.measureNumber, info.beatIndex, targetVoice);
          }
        }

        const curNote = selectedPosition.activeVoiceMap[targetVoice];
        if (curNote && !curNote.isRest) {
          if (typeof onPlayPitch === 'function') {
            onPlayPitch(curNote.step, curNote.octave, curNote.alter, 0.25);
          }

          const noteheads = Array.from(staveNote.querySelectorAll('g.vf-notehead'));
          let visualEl = staveNote;
          if (noteheads.length >= 2) {
            noteheads.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const isTopVoice = (targetVoice === 'soprano' || targetVoice === 'tenor');
            visualEl = (isTopVoice ? noteheads[0] : noteheads[1]) || staveNote;
          }

          _dragState.active = true;
          _dragState.pointerId = e.pointerId;
          _dragState.targetEl = staveNote;
          _dragState.visualEl = visualEl;
          _dragState.startY = e.clientY;
          _dragState.startX = e.clientX;
          _dragState.currentStep = curNote.step;
          _dragState.currentOctave = curNote.octave;
          _dragState.currentAlter = curNote.alter;
          _dragState.previewStep = curNote.step;
          _dragState.previewOctave = curNote.octave;
          _dragState.hasMoved = false;

          visualEl.classList.add('is-dragging-note');
          visualEl.style.transition = 'none';

          const overlay = document.getElementById('drag-ghost-overlay');
          const badge = document.getElementById('drag-ghost-badge');
          const line = document.getElementById('drag-guide-line');
          if (overlay && badge && line) {
            overlay.classList.remove('hidden');
            badge.style.left = `${e.clientX}px`;
            badge.style.top = `${e.clientY}px`;
            const accSym = curNote.alter === 1 ? '♯' : (curNote.alter === -1 ? '♭' : '');
            badge.textContent = `${curNote.step}${accSym}${curNote.octave} (0)`;
            line.style.left = `${e.clientX}px`;
            line.style.top = '0';
            line.style.height = '100vh';
          }
        }
      };
    });

    container.querySelectorAll('svg text').forEach(textEl => {
      const raw = (textEl.textContent || '').trim();
      if (!raw || /^\d+$/.test(raw)) return;

      const clean = raw.replace(/^\d+\./, '').trim().toLowerCase();
      for (const [key, loc] of _svgLyricMap.entries()) {
        const [, word] = key.split('_');
        if (clean === word || clean.includes(word) || word.includes(clean)) {
          textEl.style.cursor = 'ns-resize';
          textEl.onpointerdown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            let targetVoice = selectedPosition.voice;
            if (loc.staffIndex === 0) {
              if (targetVoice !== 'soprano' && targetVoice !== 'alto') targetVoice = 'soprano';
            } else {
              if (targetVoice !== 'tenor' && targetVoice !== 'bass') targetVoice = 'bass';
            }

            if (typeof onSelectNote === 'function') {
              onSelectNote(loc.measureNumber, loc.beatIndex, targetVoice);
            }

            const cur = selectedPosition.activeVoiceMap[targetVoice];
            if (cur && !cur.isRest) {
              if (typeof onPlayPitch === 'function') {
                onPlayPitch(cur.step, cur.octave, cur.alter, 0.25);
              }

              _dragState.active = true;
              _dragState.pointerId = e.pointerId;
              _dragState.targetEl = textEl;
              _dragState.visualEl = null;
              _dragState.startY = e.clientY;
              _dragState.startX = e.clientX;
              _dragState.currentStep = cur.step;
              _dragState.currentOctave = cur.octave;
              _dragState.currentAlter = cur.alter;
              _dragState.previewStep = cur.step;
              _dragState.previewOctave = cur.octave;
              _dragState.hasMoved = false;

              const overlay = document.getElementById('drag-ghost-overlay');
              const badge = document.getElementById('drag-ghost-badge');
              const line = document.getElementById('drag-guide-line');
              if (overlay && badge && line) {
                overlay.classList.remove('hidden');
                badge.style.left = `${e.clientX}px`;
                badge.style.top = `${e.clientY}px`;
                const accSym = cur.alter === 1 ? '♯' : (cur.alter === -1 ? '♭' : '');
                badge.textContent = `${cur.step}${accSym}${cur.octave} (0)`;
                line.style.left = `${e.clientX}px`;
                line.style.top = '0';
                line.style.height = '100vh';
              }
            }
          };
          break;
        }
      }
    });

    if (!_hasBoundGlobalDragListeners) {
      _hasBoundGlobalDragListeners = true;

      window.addEventListener('pointermove', (e) => {
        if (!_dragState.active) return;
        e.preventDefault();

        const curZoom = (typeof options.getZoom === 'function') ? options.getZoom() : (zoom || 1.0);
        const deltaY = _dragState.startY - e.clientY;
        const stepPixels = Math.max(4, 5 * curZoom);
        const deltaSteps = Math.round(deltaY / stepPixels);

        if (Math.abs(deltaY) > 3) {
          _dragState.hasMoved = true;
        }

        if (_dragState.visualEl) {
          const visualY = -(deltaSteps * stepPixels);
          _dragState.visualEl.style.transform = `translateY(${visualY}px)`;
        }

        const diatonicSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const currentIdx = _dragState.currentOctave * 7 + diatonicSteps.indexOf(_dragState.currentStep);
        const newIdx = Math.max(14, Math.min(56, currentIdx + deltaSteps));

        const newStep = diatonicSteps[((newIdx % 7) + 7) % 7];
        const newOctave = Math.floor(newIdx / 7);

        const badge = document.getElementById('drag-ghost-badge');
        const line = document.getElementById('drag-guide-line');
        if (badge) {
          badge.style.left = `${e.clientX}px`;
          badge.style.top = `${e.clientY}px`;
          const accSym = _dragState.currentAlter === 1 ? '♯' : (_dragState.currentAlter === -1 ? '♭' : '');
          const diffSign = deltaSteps > 0 ? `+${deltaSteps}` : (deltaSteps < 0 ? `${deltaSteps}` : '0');
          badge.textContent = `${newStep}${accSym}${newOctave} (${diffSign})`;
        }
        if (line) {
          line.style.left = `${e.clientX}px`;
        }

        if (newStep !== _dragState.previewStep || newOctave !== _dragState.previewOctave) {
          _dragState.previewStep = newStep;
          _dragState.previewOctave = newOctave;
          if (typeof onPlayPitch === 'function') {
            onPlayPitch(newStep, newOctave, _dragState.currentAlter, 0.15);
          }
        }
      });

      window.addEventListener('pointerup', () => {
        if (!_dragState.active) return;
        _dragState.active = false;

        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');

        if (_dragState.visualEl) {
          _dragState.visualEl.style.transform = '';
          _dragState.visualEl.classList.remove('is-dragging-note');
        }

        if (_dragState.hasMoved && _dragState.previewStep && 
            (_dragState.previewStep !== _dragState.currentStep || _dragState.previewOctave !== _dragState.currentOctave)) {
          if (typeof onCommitPitch === 'function') {
            onCommitPitch(_dragState.previewStep, _dragState.previewOctave, _dragState.currentAlter);
          }
        }
      });

      window.addEventListener('pointercancel', () => {
        if (!_dragState.active) return;
        _dragState.active = false;
        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');
        if (_dragState.visualEl) {
          _dragState.visualEl.style.transform = '';
          _dragState.visualEl.classList.remove('is-dragging-note');
        }
      });
    }

    highlightSelectedSvgNote(selectedPosition);
  }

  window.EditorDrag = {
    buildSvgNoteMap,
    resolveVoiceFromClick,
    highlightSelectedSvgNote,
    wireVerticalDragEvents,
    getSvgNoteMap: () => _svgNoteMap
  };
})();
