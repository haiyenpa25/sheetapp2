/**
 * editor/js/editor-health.js — Measure Health Validator & Realtime Alert System
 * Kiểm tra đủ phách trong từng ô nhịp (Underflow / Overflow), tô viền cảnh báo SVG, và tự động bù dấu lặng.
 */
(() => {
  'use strict';

  function validateAllMeasures(xmlDoc, selectedPosition, onSelectMeasureCallback) {
    if (!xmlDoc) return {};
    const measureHealth = {};

    const parts = xmlDoc.querySelectorAll('part');
    const part1 = xmlDoc.querySelector('part#P1') || parts[0];
    if (!part1) return {};

    const measures = part1.querySelectorAll('measure');
    let underflowCount = 0;
    let overflowCount = 0;

    let currentDivisions = 2;
    let currentBeats = 4;
    let currentBeatType = 4;

    let pickupDiv = 0;
    if (measures.length > 2) {
      const m0 = measures[0];
      let m0Div = 0;
      m0.querySelectorAll('note').forEach(n => {
        if (!n.querySelector('chord') && (n.querySelector('voice')?.textContent || '1') === '1') {
          m0Div += parseInt(n.querySelector('duration')?.textContent || 0, 10);
        }
      });
      const beats0 = parseInt(m0.querySelector('attributes > time > beats')?.textContent || currentBeats, 10);
      const bType0 = parseInt(m0.querySelector('attributes > time > beat-type')?.textContent || currentBeatType, 10);
      const div0 = parseInt(m0.querySelector('attributes > divisions')?.textContent || currentDivisions, 10);
      const target0 = Math.round(beats0 * (4 / bType0) * div0);
      if (m0Div < target0) {
        pickupDiv = m0Div;
      }
    }

    measures.forEach((mEl, mIdx) => {
      const mNum = parseInt(mEl.getAttribute('number') || (mIdx + 1), 10);

      const divEl = mEl.querySelector('attributes > divisions');
      if (divEl) {
        const dVal = parseInt(divEl.textContent.trim(), 10);
        if (dVal > 0) currentDivisions = dVal;
      }

      const beatsEl = mEl.querySelector('attributes > time > beats');
      const bTypeEl = mEl.querySelector('attributes > time > beat-type');
      if (beatsEl && bTypeEl) {
        currentBeats = parseInt(beatsEl.textContent.trim(), 10) || currentBeats;
        currentBeatType = parseInt(bTypeEl.textContent.trim(), 10) || currentBeatType;
      }

      const targetDivisions = Math.round(currentBeats * (4 / currentBeatType) * currentDivisions);

      let totalDiv = 0;
      mEl.querySelectorAll('note').forEach(n => {
        if (!n.querySelector('chord')) {
          const v = n.querySelector('voice')?.textContent || '1';
          if (v === '1') {
            const d = parseInt(n.querySelector('duration')?.textContent || 0, 10);
            totalDiv += d;
          }
        }
      });

      let status = 'ok';
      let missing = 0;
      let excess = 0;

      const isPickup = (mIdx === 0 && totalDiv < targetDivisions && measures.length > 2);
      const isFinalPickupComplement = (mIdx === measures.length - 1 && pickupDiv > 0 && totalDiv + pickupDiv === targetDivisions);

      if (isPickup) {
        status = 'pickup';
      } else if (isFinalPickupComplement) {
        status = 'pickup-final';
      } else if (totalDiv < targetDivisions) {
        status = 'underflow';
        missing = targetDivisions - totalDiv;
        underflowCount++;
      } else if (totalDiv > targetDivisions) {
        status = 'overflow';
        excess = totalDiv - targetDivisions;
        overflowCount++;
      }

      measureHealth[mNum] = {
        measureNum: mNum,
        status: status,
        target: targetDivisions,
        total: totalDiv,
        missing: missing,
        excess: excess,
        missingBeats: missing > 0 ? (missing / currentDivisions).toFixed(1).replace('.0', '') : 0,
        excessBeats: excess > 0 ? (excess / currentDivisions).toFixed(1).replace('.0', '') : 0,
        divisions: currentDivisions
      };
    });

    renderMeasureHealthBar(measureHealth, underflowCount, overflowCount, selectedPosition, onSelectMeasureCallback);
    updateRealtimeMeasureUI(measureHealth, selectedPosition);

    return measureHealth;
  }

  function renderMeasureHealthBar(measureHealth, underflowCount, overflowCount, selectedPosition, onSelectMeasureCallback) {
    const summaryBadge = document.getElementById('health-summary-badge');
    const autoFixBtn   = document.getElementById('btn-auto-fix-all-rests');
    const stripPills   = document.getElementById('measure-strip-pills');
    if (!summaryBadge || !stripPills) return;

    const totalIssues = underflowCount + overflowCount;
    if (totalIssues === 0) {
      summaryBadge.textContent = '100% Ô nhịp đủ phách';
      summaryBadge.className = 'badge-health-ok';
      if (autoFixBtn) autoFixBtn.classList.add('hidden');
    } else {
      summaryBadge.textContent = `⚠️ Có ${totalIssues} ô nhịp chưa chuẩn (${underflowCount} thiếu, ${overflowCount} thừa)`;
      summaryBadge.className = 'badge-health-warn';
      if (autoFixBtn) autoFixBtn.classList.toggle('hidden', underflowCount === 0);
    }

    stripPills.innerHTML = '';
    Object.values(measureHealth).forEach(m => {
      const pill = document.createElement('div');
      pill.className = `measure-pill ${m.status}`;
      if (m.measureNum === selectedPosition?.measureNumber) pill.classList.add('active');
      pill.textContent = m.measureNum;
      pill.title = `Ô nhịp ${m.measureNum}: ` + (m.status === 'ok' ? 'Đủ phách' : (m.status === 'underflow' ? `Thiếu ${m.missingBeats} phách` : `Thừa ${m.excessBeats} phách`));

      pill.onclick = () => {
        if (typeof onSelectMeasureCallback === 'function') {
          onSelectMeasureCallback(m.measureNum);
        }
      };
      stripPills.appendChild(pill);
    });
  }

  function applyMeasureSvgHighlights(osmd, measureHealth, selectedPosition) {
    const container = document.getElementById('osmd-editor-container');
    if (!container || !osmd || !osmd.GraphicSheet) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    svg.querySelectorAll('.measure-highlight-rect').forEach(r => r.remove());

    const ml = osmd.GraphicSheet.MeasureList;
    if (!ml || !ml.length) return;

    Object.values(measureHealth).forEach(m => {
      let targetStaves = null;
      for (let i = 0; i < ml.length; i++) {
        const staves = ml[i];
        if (staves && staves[0]) {
          const s0 = staves[0];
          const mNum = parseInt(s0.parentSourceMeasure?.MeasureNumberXML ?? s0.MeasureNumber, 10);
          if (mNum === m.measureNum) {
            targetStaves = staves;
            break;
          }
        }
      }

      if (!targetStaves || !targetStaves.length) return;

      const s0 = targetStaves[0];
      const sLast = targetStaves[targetStaves.length - 1];
      if (!s0 || !s0.PositionAndShape) return;

      const x = s0.PositionAndShape.AbsolutePosition.x * 10;
      const y = (s0.PositionAndShape.AbsolutePosition.y - 2) * 10;
      const w = s0.PositionAndShape.Size.width * 10;
      const sLastH = (sLast.PositionAndShape?.Size?.height || 4);
      const bottomY = (sLast.PositionAndShape.AbsolutePosition.y + sLastH + 3) * 10;
      const h = Math.max(50, bottomY - y);

      const isError = (m.status === 'underflow' || m.status === 'overflow');
      const isActive = (m.measureNum === selectedPosition?.measureNumber);

      if (isError) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'measure-highlight-rect measure-highlight-error');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('rx', '6');
        rect.setAttribute('data-measure', String(m.measureNum));
        svg.prepend(rect);
      } else if (isActive) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'measure-highlight-rect measure-highlight-active');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('rx', '6');
        rect.setAttribute('data-measure', String(m.measureNum));
        svg.prepend(rect);
      }
    });
  }

  function updateRealtimeMeasureUI(measureHealth, selectedPosition) {
    const curMNum = selectedPosition?.measureNumber || 1;
    const h = measureHealth[curMNum];

    const quickbar = document.getElementById('smart-note-quickbar');
    const qStatusText = document.getElementById('quickbar-status-text');
    const qAutofillBtn = document.getElementById('quick-btn-autofill');

    const beatCard = document.getElementById('inspector-beat-card');
    const bIcon = document.getElementById('inspector-beat-icon');
    const bTitle = document.getElementById('inspector-meter-title');
    const bSub = document.getElementById('inspector-meter-sub');
    const bFill = document.getElementById('meter-fill-bar');
    const bBtn = document.getElementById('btn-inspector-autofill');

    if (!h || h.status === 'ok' || h.status === 'pickup' || h.status === 'pickup-final') {
      if (quickbar) {
        quickbar.classList.remove('has-error');
        quickbar.classList.add('is-valid');
      }
      if (qStatusText) qStatusText.textContent = `Ô nhịp ${curMNum}: Đủ ${h ? (h.target / (h.divisions || 2)) : 4} phách chuẩn`;
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');

      if (beatCard) {
        beatCard.className = 'inspector-card meter-card is-valid';
        if (bIcon) bIcon.textContent = '✓';
        if (bTitle) bTitle.textContent = `Ô ${curMNum}: Đủ phách`;
        if (bSub) bSub.textContent = 'Hoàn hảo theo số chỉ nhịp';
        if (bFill) {
          bFill.style.width = '100%';
          bFill.className = 'meter-fill is-valid';
        }
        if (bBtn) bBtn.classList.add('hidden');
      }
    } else if (h.status === 'underflow') {
      if (quickbar) {
        quickbar.classList.add('has-error');
        quickbar.classList.remove('is-valid');
      }
      if (qStatusText) qStatusText.textContent = `⚠️ Ô nhịp ${curMNum} đang thiếu ${h.missingBeats} phách!`;
      if (qAutofillBtn) {
        qAutofillBtn.classList.remove('hidden');
        qAutofillBtn.textContent = `+ Bù ${h.missingBeats} phách`;
      }

      if (beatCard) {
        beatCard.className = 'inspector-card meter-card has-underflow';
        if (bIcon) bIcon.textContent = '⚠️';
        if (bTitle) bTitle.textContent = `Thiếu ${h.missingBeats} phách!`;
        if (bSub) bSub.textContent = `Đã có: ${(h.total / h.divisions).toFixed(1)} / ${(h.target / h.divisions).toFixed(1)} phách`;
        if (bFill) {
          const pct = Math.max(5, Math.min(95, Math.round((h.total / h.target) * 100)));
          bFill.style.width = `${pct}%`;
          bFill.className = 'meter-fill has-underflow';
        }
        if (bBtn) {
          bBtn.classList.remove('hidden');
          bBtn.textContent = `⚡ Bù ${h.missingBeats} phách dấu lặng`;
        }
      }
    } else if (h.status === 'overflow') {
      if (quickbar) {
        quickbar.classList.add('has-error');
        quickbar.classList.remove('is-valid');
      }
      if (qStatusText) qStatusText.textContent = `⛔ Ô nhịp ${curMNum} đang thừa ${h.excessBeats} phách!`;
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');

      if (beatCard) {
        beatCard.className = 'inspector-card meter-card has-overflow';
        if (bIcon) bIcon.textContent = '⛔';
        if (bTitle) bTitle.textContent = `Thừa ${h.excessBeats} phách!`;
        if (bSub) bSub.textContent = `Đã có: ${(h.total / h.divisions).toFixed(1)} / ${(h.target / h.divisions).toFixed(1)} phách`;
        if (bFill) {
          bFill.style.width = '100%';
          bFill.className = 'meter-fill has-overflow';
        }
        if (bBtn) bBtn.classList.add('hidden');
      }
    }
  }

  async function autoFillRestForMeasure(xmlDoc, measureNum, measureHealth, saveSnapshotFn, renderFn, showToastFn) {
    if (!xmlDoc) return;
    const h = measureHealth[measureNum];
    if (!h || h.status !== 'underflow' || h.missing <= 0) {
      if (typeof showToastFn === 'function') showToastFn(`Ô nhịp ${measureNum} đã đủ phách!`, 'info');
      return;
    }

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const parts = xmlDoc.querySelectorAll('part');
    const div = h.divisions || 2;

    parts.forEach(part => {
      const mEl = part.querySelector(`measure[number="${measureNum}"]`);
      if (!mEl) return;

      let remaining = h.missing;
      while (remaining > 0) {
        let durToAdd = 0;
        let typeToAdd = 'quarter';
        if (remaining >= div * 2) {
          durToAdd = div * 2;
          typeToAdd = 'half';
        } else if (remaining >= div) {
          durToAdd = div;
          typeToAdd = 'quarter';
        } else if (remaining >= Math.round(div / 2)) {
          durToAdd = Math.max(1, Math.round(div / 2));
          typeToAdd = 'eighth';
        } else {
          durToAdd = remaining;
          typeToAdd = '16th';
        }

        const restNote = xmlDoc.createElement('note');
        restNote.appendChild(xmlDoc.createElement('rest'));

        const durEl = xmlDoc.createElement('duration');
        durEl.textContent = String(durToAdd);
        restNote.appendChild(durEl);

        const voiceEl = xmlDoc.createElement('voice');
        voiceEl.textContent = '1';
        restNote.appendChild(voiceEl);

        const typeEl = xmlDoc.createElement('type');
        typeEl.textContent = typeToAdd;
        restNote.appendChild(typeEl);

        const staffEl = xmlDoc.createElement('staff');
        staffEl.textContent = '1';
        restNote.appendChild(staffEl);

        mEl.appendChild(restNote);
        remaining -= durToAdd;
      }
    });

    if (typeof showToastFn === 'function') {
      showToastFn(`⚡ Đã tự động bù dấu lặng chuẩn cho ô nhịp ${measureNum}!`, 'success', 1500);
    }
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  }

  async function autoFillAllRests(xmlDoc, measureHealth, saveSnapshotFn, renderFn, showToastFn) {
    if (!xmlDoc) return;
    let fixed = 0;
    const underflows = Object.values(measureHealth).filter(h => h.status === 'underflow' && h.missing > 0);
    if (!underflows.length) {
      if (typeof showToastFn === 'function') showToastFn('Tất cả ô nhịp đều đã đủ phách!', 'info');
      return;
    }

    if (typeof saveSnapshotFn === 'function') saveSnapshotFn();
    const parts = xmlDoc.querySelectorAll('part');

    underflows.forEach(h => {
      const div = h.divisions || 2;
      parts.forEach(part => {
        const mEl = part.querySelector(`measure[number="${h.measureNum}"]`);
        if (!mEl) return;

        let remaining = h.missing;
        while (remaining > 0) {
          let durToAdd = 0;
          let typeToAdd = 'quarter';
          if (remaining >= div * 2) {
            durToAdd = div * 2;
            typeToAdd = 'half';
          } else if (remaining >= div) {
            durToAdd = div;
            typeToAdd = 'quarter';
          } else if (remaining >= Math.round(div / 2)) {
            durToAdd = Math.max(1, Math.round(div / 2));
            typeToAdd = 'eighth';
          } else {
            durToAdd = remaining;
            typeToAdd = '16th';
          }

          const restNote = xmlDoc.createElement('note');
          restNote.appendChild(xmlDoc.createElement('rest'));

          const durEl = xmlDoc.createElement('duration');
          durEl.textContent = String(durToAdd);
          restNote.appendChild(durEl);

          const voiceEl = xmlDoc.createElement('voice');
          voiceEl.textContent = '1';
          restNote.appendChild(voiceEl);

          const typeEl = xmlDoc.createElement('type');
          typeEl.textContent = typeToAdd;
          restNote.appendChild(typeEl);

          const staffEl = xmlDoc.createElement('staff');
          staffEl.textContent = '1';
          restNote.appendChild(staffEl);

          mEl.appendChild(restNote);
          remaining -= durToAdd;
        }
      });
      fixed++;
    });

    if (fixed > 0) {
      if (typeof showToastFn === 'function') {
        showToastFn(`⚡ Đã tự động bù dấu lặng cho ${fixed} ô nhịp!`, 'success', 2000);
      }
      if (typeof renderFn === 'function') {
        await renderFn();
      }
    }
  }

  window.EditorHealth = {
    validateAllMeasures,
    renderMeasureHealthBar,
    applyMeasureSvgHighlights,
    updateRealtimeMeasureUI,
    autoFillRestForMeasure,
    autoFillAllRests
  };
})();
