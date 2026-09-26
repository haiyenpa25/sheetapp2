/**
 * editor/js/editor-modifiers.js — Note & Measure Manipulation Engine
 * Xử lý thay đổi cao độ, trường độ, dấu hoá, liên 3, luyến, dấu lặng, lời ca, và cấu trúc ô nhịp.
 */
(() => {
  'use strict';

  function durationToType(subDuration, divisions) {
    const mult = subDuration / (divisions || 4);
    if (mult >= 3.5) return 'whole';
    if (mult >= 1.75) return 'half';
    if (mult >= 0.85) return 'quarter';
    if (mult >= 0.4) return 'eighth';
    if (mult >= 0.2) return '16th';
    return '32nd';
  }

  function getDivisionsForMeasure(xmlDoc, measureEl) {
    if (measureEl) {
      let cur = measureEl;
      while (cur) {
        const divEl = cur.querySelector('attributes > divisions');
        if (divEl) {
          const val = parseInt(divEl.textContent.trim(), 10);
          if (val > 0) return val;
        }
        cur = cur.previousElementSibling;
      }
    }
    const gDiv = xmlDoc?.querySelector('divisions');
    if (gDiv) {
      const val = parseInt(gDiv.textContent.trim(), 10);
      if (val > 0) return val;
    }
    return 2;
  }

  function setNotePitchInXml(xmlDoc, noteEl, step, octave, alter = 0) {
    if (!noteEl || !xmlDoc) return;
    const rest = noteEl.querySelector('rest');
    if (rest) rest.remove();

    let pitchEl = noteEl.querySelector('pitch');
    if (!pitchEl) {
      pitchEl = xmlDoc.createElement('pitch');
      noteEl.insertBefore(pitchEl, noteEl.querySelector('duration') || noteEl.firstChild);
    }

    let stepEl = pitchEl.querySelector('step');
    if (!stepEl) {
      stepEl = xmlDoc.createElement('step');
      pitchEl.appendChild(stepEl);
    }
    stepEl.textContent = step.toUpperCase();

    let octEl = pitchEl.querySelector('octave');
    if (!octEl) {
      octEl = xmlDoc.createElement('octave');
      pitchEl.appendChild(octEl);
    }
    octEl.textContent = String(octave);

    let altEl = pitchEl.querySelector('alter');
    if (alter !== 0) {
      if (!altEl) {
        altEl = xmlDoc.createElement('alter');
        pitchEl.appendChild(altEl);
      }
      altEl.textContent = String(alter);
    } else if (altEl) {
      altEl.remove();
    }
  }

  function modifyAccidental(curNote, accType, onModifyPitch) {
    if (!curNote) return;
    let alter = 0;
    if (accType === 'sharp') alter = 1;
    if (accType === 'flat') alter = -1;
    if (typeof onModifyPitch === 'function') {
      onModifyPitch(curNote.step, curNote.octave, alter);
    }
  }

  function modifyOctave(curNote, delta, onModifyPitch) {
    if (!curNote) return;
    const newOct = Math.max(1, Math.min(7, curNote.octave + delta));
    if (newOct !== curNote.octave && typeof onModifyPitch === 'function') {
      onModifyPitch(curNote.step, newOct, curNote.alter);
    }
  }

  function stepSemitone(curNote, voice, delta, pitchToMidiFn, onModifyPitch) {
    if (!curNote) return;
    const defaultVoiceMidi = { soprano: 67, alto: 64, tenor: 48, bass: 43 };
    const curMidi = curNote.isRest ? (defaultVoiceMidi[voice] || 60) : pitchToMidiFn(curNote.step, curNote.octave, curNote.alter);
    const newMidi = Math.max(24, Math.min(96, curMidi + delta));

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
    const item = chromaticMap[newMidi % 12];
    const newOct = Math.floor(newMidi / 12) - 1;
    if (typeof onModifyPitch === 'function') {
      onModifyPitch(item.step, newOct, item.alter);
    }
  }

  async function modifyDuration(xmlDoc, curNote, newType, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const noteEl = curNote.xmlNode;
    const divisions = getDivisionsForMeasure(xmlDoc, noteEl.closest('measure'));
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[newType] || 1;
    let newDuration = Math.max(1, Math.round(divisions * mult));
    if (curNote.isDot) newDuration = Math.round(newDuration * 1.5);

    let typeEl = noteEl.querySelector('type');
    if (!typeEl) {
      typeEl = xmlDoc.createElement('type');
      noteEl.appendChild(typeEl);
    }
    typeEl.textContent = newType;

    let durEl = noteEl.querySelector('duration');
    if (!durEl) {
      durEl = xmlDoc.createElement('duration');
      noteEl.appendChild(durEl);
    }
    durEl.textContent = String(newDuration);

    if (typeof showToastFn === 'function') {
      showToastFn(`Đã đổi trường độ: ${newType}`, 'info', 1000);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  async function toggleDot(xmlDoc, curNote, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;
    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();

    const noteEl = curNote.xmlNode;
    const dotEl = noteEl.querySelector('dot');
    if (dotEl) {
      dotEl.remove();
      curNote.isDot = false;
    } else {
      noteEl.appendChild(xmlDoc.createElement('dot'));
      curNote.isDot = true;
    }
    await modifyDuration(xmlDoc, curNote, curNote.type, null, renderFn, showToastFn);
  }

  async function deleteNoteAsRest(xmlDoc, curNote, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;
    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();

    const curEl = curNote.xmlNode;
    const siblings = curNote._chordSiblings || [curEl];
    const anchorNode = siblings[0] || curEl;

    for (let i = 1; i < siblings.length; i++) {
      if (siblings[i] && siblings[i].parentNode) {
        siblings[i].remove();
      }
    }

    anchorNode.querySelectorAll('pitch, chord, stem, beam, notations, lyric, dot, accidental, tie, tied').forEach(el => el.remove());

    if (!anchorNode.querySelector('rest')) {
      const newRest = xmlDoc.createElement('rest');
      const durEl = anchorNode.querySelector('duration');
      if (durEl) anchorNode.insertBefore(newRest, durEl);
      else anchorNode.insertBefore(newRest, anchorNode.firstChild);
    }

    if (typeof showToastFn === 'function') {
      showToastFn('𝄽 Đã chuyển thành dấu lặng (bảo toàn phách)', 'info', 1200);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  async function subdivideNoteToRests(xmlDoc, curNote, factor = 2, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) {
      if (typeof showToastFn === 'function') showToastFn('Hãy chọn vị trí nốt để phân rã!', 'error');
      return;
    }

    const curEl = curNote.xmlNode;
    const oldDuration = curNote.duration;
    if (oldDuration < factor) {
      if (typeof showToastFn === 'function') showToastFn('Nốt này quá ngắn, không thể chia nhỏ hơn!', 'warn');
      return;
    }

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const measureEl = curEl.closest('measure');
    const divisions = getDivisionsForMeasure(xmlDoc, measureEl);

    const subDuration = Math.max(1, Math.floor(oldDuration / factor));
    const subType = durationToType(subDuration, divisions);

    const siblings = curNote._chordSiblings || [curEl];
    const anchorNode = siblings[0] || curEl;
    const voiceText = anchorNode.querySelector('voice')?.textContent || '1';
    const staffText = anchorNode.querySelector('staff')?.textContent || '1';

    for (let i = 1; i < siblings.length; i++) {
      if (siblings[i] && siblings[i].parentNode) {
        siblings[i].remove();
      }
    }

    anchorNode.querySelectorAll('pitch, chord, stem, beam, notations, lyric, dot, accidental, tie, tied').forEach(el => el.remove());
    if (!anchorNode.querySelector('rest')) {
      const restEl = xmlDoc.createElement('rest');
      const durEl = anchorNode.querySelector('duration');
      if (durEl) anchorNode.insertBefore(restEl, durEl);
      else anchorNode.insertBefore(restEl, anchorNode.firstChild);
    }

    let durEl = anchorNode.querySelector('duration');
    if (!durEl) {
      durEl = xmlDoc.createElement('duration');
      anchorNode.appendChild(durEl);
    }
    durEl.textContent = String(subDuration);

    let typeEl = anchorNode.querySelector('type');
    if (!typeEl) {
      typeEl = xmlDoc.createElement('type');
      anchorNode.appendChild(typeEl);
    }
    typeEl.textContent = subType;

    let prevNode = anchorNode;
    for (let i = 1; i < factor; i++) {
      const newRestNote = xmlDoc.createElement('note');
      newRestNote.appendChild(xmlDoc.createElement('rest'));

      const newDurEl = xmlDoc.createElement('duration');
      newDurEl.textContent = String(subDuration);
      newRestNote.appendChild(newDurEl);

      const newVoiceEl = xmlDoc.createElement('voice');
      newVoiceEl.textContent = voiceText;
      newRestNote.appendChild(newVoiceEl);

      const newTypeEl = xmlDoc.createElement('type');
      newTypeEl.textContent = subType;
      newRestNote.appendChild(newTypeEl);

      const newStaffEl = xmlDoc.createElement('staff');
      newStaffEl.textContent = staffText;
      newRestNote.appendChild(newStaffEl);

      prevNode.parentNode.insertBefore(newRestNote, prevNode.nextSibling);
      prevNode = newRestNote;
    }

    if (typeof showToastFn === 'function') {
      showToastFn(`✨ Đã phân rã thành ${factor} dấu lặng! Bấm phím đàn hoặc C-B để điền nốt vào`, 'success', 2500);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  async function mergeWithNextRest(xmlDoc, curNote, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;
    if (!curNote.isRest) {
      if (typeof showToastFn === 'function') showToastFn('Hãy chọn 1 dấu lặng để gộp với dấu lặng tiếp theo!', 'warn');
      return;
    }

    const curEl = curNote.xmlNode;
    const curVoice = curEl.querySelector('voice')?.textContent || '1';

    let nextNode = curEl.nextElementSibling;
    while (nextNode) {
      if (nextNode.nodeName === 'note') {
        const nv = nextNode.querySelector('voice')?.textContent || '1';
        if (nv === curVoice) break;
      }
      nextNode = nextNode.nextElementSibling;
    }

    if (!nextNode || nextNode.nodeName !== 'note' || !nextNode.querySelector('rest')) {
      if (typeof showToastFn === 'function') showToastFn('Không tìm thấy dấu lặng liền sau trong cùng bè để gộp!', 'warn');
      return;
    }

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const divisions = getDivisionsForMeasure(xmlDoc, curEl.closest('measure'));

    const dur1 = parseInt(curEl.querySelector('duration')?.textContent, 10) || 0;
    const dur2 = parseInt(nextNode.querySelector('duration')?.textContent, 10) || 0;
    const combinedDur = dur1 + dur2;
    const combinedType = durationToType(combinedDur, divisions);

    curEl.querySelector('duration').textContent = String(combinedDur);
    let typeEl = curEl.querySelector('type');
    if (!typeEl) {
      typeEl = xmlDoc.createElement('type');
      curEl.appendChild(typeEl);
    }
    typeEl.textContent = combinedType;
    nextNode.remove();

    if (typeof showToastFn === 'function') {
      showToastFn('𝄾+𝄾 Đã gộp 2 dấu lặng thành công (bảo toàn phách)', 'success', 1500);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  async function splitCurrentNote(xmlDoc, curNote, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;

    const noteEl = curNote.xmlNode;
    const oldDuration = curNote.duration;
    if (oldDuration <= 1) {
      if (typeof showToastFn === 'function') showToastFn('Nốt này quá ngắn, không thể tách đôi!', 'warn');
      return;
    }

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const divisions = getDivisionsForMeasure(xmlDoc, noteEl.closest('measure'));

    const halfDur = Math.floor(oldDuration / 2);
    const halfType = durationToType(halfDur, divisions);

    const durEl = noteEl.querySelector('duration');
    if (durEl) durEl.textContent = String(halfDur);
    let typeEl = noteEl.querySelector('type');
    if (typeEl) typeEl.textContent = halfType;

    const cloneEl = noteEl.cloneNode(true);
    const cloneDurEl = cloneEl.querySelector('duration');
    if (cloneDurEl) cloneDurEl.textContent = String(halfDur);
    const cloneTypeEl = cloneEl.querySelector('type');
    if (cloneTypeEl) cloneTypeEl.textContent = halfType;

    noteEl.parentNode.insertBefore(cloneEl, noteEl.nextSibling);

    if (typeof showToastFn === 'function') {
      showToastFn('✂️ Đã tách đôi nốt thành công (bảo toàn phách)', 'success', 1500);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  function toggleArticulation(xmlDoc, curNote, artName, symStr, saveSnapshotFn, renderFn, showToastFn) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;
    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();

    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }

    if (artName === 'tie') {
      const tiedEl = notEl.querySelector('tied');
      if (tiedEl) tiedEl.remove();
      else {
        const t = xmlDoc.createElement('tied');
        t.setAttribute('type', 'start');
        notEl.appendChild(t);
      }
    } else if (artName === 'slur') {
      const slurEl = notEl.querySelector('slur');
      if (slurEl) {
        slurEl.remove();
        if (typeof showToastFn === 'function') showToastFn('Đã bỏ dấu luyến', 'info', 1000);
      } else {
        const s = xmlDoc.createElement('slur');
        s.setAttribute('type', 'start');
        notEl.appendChild(s);
        if (typeof showToastFn === 'function') showToastFn('⌒ Đã thêm dấu luyến', 'info', 1000);
      }
    } else if (artName === 'fermata') {
      const fermataEl = notEl.querySelector('fermata');
      if (fermataEl) {
        fermataEl.remove();
        if (typeof showToastFn === 'function') showToastFn('Đã bỏ dấu mắt ngỗng', 'info', 1000);
      } else {
        const f = xmlDoc.createElement('fermata');
        f.setAttribute('type', 'upright');
        notEl.appendChild(f);
        if (typeof showToastFn === 'function') showToastFn('𝄐 Đã gắn dấu mắt ngỗng', 'info', 1000);
      }
    } else if (artName === 'tuplet') {
      const tupletEl = notEl.querySelector('tuplet');
      if (tupletEl) {
        tupletEl.remove();
        noteEl.querySelector('time-modification')?.remove();
        if (typeof showToastFn === 'function') showToastFn('Đã hủy liên 3', 'info', 1000);
      } else {
        const t = xmlDoc.createElement('tuplet');
        t.setAttribute('type', 'start');
        notEl.appendChild(t);
        let tm = noteEl.querySelector('time-modification');
        if (!tm) {
          tm = xmlDoc.createElement('time-modification');
          const an = xmlDoc.createElement('actual-notes'); an.textContent = '3';
          const nn = xmlDoc.createElement('normal-notes'); nn.textContent = '2';
          tm.appendChild(an); tm.appendChild(nn);
          noteEl.appendChild(tm);
        }
        if (typeof showToastFn === 'function') showToastFn('³ Đã đặt liên 3 (3 nốt gom 2 phách)', 'info', 1000);
      }
    } else {
      let artEl = notEl.querySelector('articulations');
      if (!artEl) {
        artEl = xmlDoc.createElement('articulations');
        notEl.appendChild(artEl);
      }
      const el = artEl.querySelector(artName);
      if (el) {
        el.remove();
        if (!artEl.children.length) artEl.remove();
        if (typeof showToastFn === 'function') showToastFn(`Đã bỏ ${artName}`, 'info', 1000);
      } else {
        const a = xmlDoc.createElement(artName);
        artEl.appendChild(a);
        if (typeof showToastFn === 'function') showToastFn(`${symStr} Đã gắn ${artName}`, 'info', 1000);
      }
    }

    if (typeof renderFn === 'function') renderFn();
  }

  function applyLyricText(xmlDoc, curNote, text, autoAdvance = false, saveSnapshotFn, renderFn, onAutoAdvance) {
    if (!curNote || !curNote.xmlNode || !xmlDoc) return;
    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();

    const noteEl = curNote.xmlNode;
    let lyricEl = noteEl.querySelector('lyric');

    if (!lyricEl && curNote._chordSiblings) {
      for (const sib of curNote._chordSiblings) {
        const sibLyric = sib.querySelector('lyric');
        if (sibLyric) {
          lyricEl = sibLyric;
          break;
        }
      }
    }

    if (!text || !text.trim()) {
      if (lyricEl) lyricEl.remove();
    } else {
      if (!lyricEl) {
        lyricEl = xmlDoc.createElement('lyric');
        noteEl.appendChild(lyricEl);
      }
      let txtEl = lyricEl.querySelector('text');
      if (!txtEl) {
        txtEl = xmlDoc.createElement('text');
        lyricEl.appendChild(txtEl);
      }
      txtEl.textContent = text.trim();
    }

    if (typeof renderFn === 'function') renderFn();
    if (autoAdvance && typeof onAutoAdvance === 'function') onAutoAdvance();
  }

  window.EditorModifiers = {
    durationToType,
    getDivisionsForMeasure,
    setNotePitchInXml,
    modifyAccidental,
    modifyOctave,
    stepSemitone,
    modifyDuration,
    toggleDot,
    deleteNoteAsRest,
    subdivideNoteToRests,
    mergeWithNextRest,
    splitCurrentNote,
    toggleArticulation,
    applyLyricText
  };
})();
