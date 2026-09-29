/**
 * chord-canvas-ui.js — UI Components for ChordCanvas
 * Xử lý tạo Popup, Modals, tính toán kích thước Dots.
 */
const ChordCanvasUI = (() => {
  'use strict';

  function getScale() {
    return window.App?.getCurrentZoom?.() ?? 1.0;
  }

  function getTextSize(scale) {
    const svgText = document.querySelector('#osmd-container svg text');
    if (svgText) {
      const fs = parseFloat(window.getComputedStyle(svgText).fontSize);
      if (fs > 0 && fs < 100) return Math.round(fs * 0.85) + 'px';
    }
    return Math.round(11 * scale) + 'px';
  }

  function getDotSize(scale) {
    return Math.max(14, Math.min(20, Math.round(16 * scale)));
  }

  function applyAbsolute(el, cx, cy, extras) {
    el.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;transform:translateX(-50%);z-index:80;${extras.join(';')}`;
  }

  /* ─── Chord history (localStorage) ─────────────────────────── */
  const _HK = 'cc_chord_history';
  function _getHist() { try { return JSON.parse(localStorage.getItem(_HK)||'[]'); } catch{return[];} }
  function _pushHist(c) {
    if (!c) return;
    const h = _getHist().filter(x => x !== c); h.unshift(c);
    localStorage.setItem(_HK, JSON.stringify(h.slice(0,20)));
  }

  /* ─── Key detection & Diatonic (R2-2, B15) ──────────────────── */
  let _lastSavedChord = '';

  function _detectKey() {
    const xml = window.App?.getOriginalXml?.();
    if (!xml) return null;
    const doc = window.XmlDocCache?.getDoc(xml);
    return window.ChordCanvasTranspose?.detectDisplayKey?.(xml) || null;
  }

  function _diatonicChords(root, mode) {
    return window.ChordCanvasTranspose?.getDiatonicChords?.(root, mode) || [];
  }

  /* ─── Chord Library ─────────────────────────────────────────── */
  const _GROUPS = [
    { label:'Cơ bản',  s:['','m','7','m7','maj7','5','2'] },
    { label:'Mở rộng', s:['9','m9','maj9','add9','6','m6','11','13','add11','6/9'] },
    { label:'Jazz',    s:['maj9','maj13','9#11','7#9','7b9','13b9','m11','m13','maj7#11'] },
    { label:'Altered', s:['7#5','7b5','7#11','7b13','7alt','aug7'] },
    { label:'Dim/Aug', s:['dim','dim7','m7b5','aug','augmaj7'] },
    { label:'Sus',     s:['sus2','sus4','7sus4','7sus2'] },
  ];

  /* ─── Popup Hợp âm ─────────────────────────────────────────── */
  function createPopup(anchor, measureIdx, noteIdx, existing, currentSet, callbacks, suggestion = '', meta = {}) {
    const ar  = anchor.getBoundingClientRect();
    const isMobile = window.innerWidth <= 900;
    const pop = document.createElement('div');
    pop.className = 'cc-popup';

    const keyInfo  = _detectKey();
    const displayedRoot = keyInfo ? (keyInfo.displayedRoot || keyInfo.root) : 'C';
    const mode = keyInfo ? keyInfo.mode : 'major';
    const keyLabel = keyInfo ? keyInfo.label : '';
    const isDefault  = currentSet === 'default';
    const diatonicChords = _diatonicChords(displayedRoot, mode);
    const seventhChords = window.ChordCanvasTranspose?.getSeventhChords?.(displayedRoot, mode) || [];
    const secondaryChords = window.ChordCanvasTranspose?.getSecondaryChords?.(displayedRoot, mode) || [];

    const { totalNotes = 0, curNoteNum = 0, lyricInfo = '' } = meta;

    let _onVv = null;
    const _cleanupMob = () => {
      if (_onVv && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', _onVv);
        window.visualViewport.removeEventListener('scroll', _onVv);
        _onVv = null;
      }
      document.body.classList.remove('cc-palette-open');
    };

    if (isMobile) {
      document.body.classList.add('cc-palette-open');
      pop.classList.add('cc-popup-mobile', 'active');
      if (window.visualViewport) {
        _onVv = () => {
          const vv = window.visualViewport;
          const off = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
          pop.style.bottom = `${off}px`;
          anchor?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        };
        window.visualViewport.addEventListener('resize', _onVv);
        window.visualViewport.addEventListener('scroll', _onVv);
      }
    } else {
      let popLeft = Math.max(145, Math.min(ar.left + ar.width / 2, window.innerWidth - 145));
      pop.style.cssText = `position:fixed;left:${popLeft}px;top:${ar.bottom + 8}px;transform:translateX(-50%);z-index:99999;background:var(--bg-surface,#fff);border:1px solid rgba(109,40,217,0.3);border-radius:var(--radius,12px);padding:.8rem;box-shadow:0 8px 28px rgba(109,40,217,.22);min-width:260px;max-width:320px;pointer-events:auto;opacity:0;transition:opacity .15s ease;`;
      requestAnimationFrame(() => {
        if (pop.getBoundingClientRect().bottom > window.innerHeight - 8) {
          pop.style.top = (ar.top - 8) + 'px';
          pop.style.transform = 'translateX(-50%) translateY(-100%)';
        }
        pop.style.opacity = '1';
      });
    }

    if (isMobile) {
      pop.innerHTML = `
        <div class="cc-mob-header">
          <div class="cc-mob-nav-group">
            <button id="cc-mob-prev" class="cc-mob-nav-btn" type="button" title="Nốt trước (Shift+Tab)">◀</button>
            <span id="cc-mob-note-idx" class="cc-mob-note-label">nốt ${curNoteNum || (noteIdx + 1)}/${totalNotes || '?'}</span>
            <button id="cc-mob-next" class="cc-mob-nav-btn" type="button" title="Nốt sau (Enter)">▶</button>
          </div>
          <div id="cc-mob-info" class="cc-mob-info-label" title="${window.SafeHtml.escape(lyricInfo || `ô nhịp ${measureIdx + 1}`)}">${window.SafeHtml.escape(lyricInfo || `ô nhịp ${measureIdx + 1}`)}</div>
          <div class="cc-mob-act-group">
            <button id="cc-mob-del" class="cc-mob-act-btn" type="button" title="Xóa hợp âm (⌫)">⌫</button>
            <button id="cc-mob-undo" class="cc-mob-act-btn" type="button" title="Hoàn tác (↶)">↶</button>
            <button id="cc-mob-done" class="cc-mob-act-btn cc-mob-btn-done" type="button" title="Xong / Lưu">Xong</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <input id="cc-pop-inp" type="text" maxlength="12" autocomplete="off"
                 placeholder="${suggestion ? `Gợi ý: ${window.SafeHtml.escape(suggestion)} (T)` : 'VD: Am, D7, G…'}" value="${window.SafeHtml.escape(existing)}"
                 style="flex:1;box-sizing:border-box;border:1.5px solid #c4b5fd;border-radius:6px;padding:.35rem .55rem;font-size:14px;font-weight:700;font-family:monospace;color:#c00;outline:none;background:var(--bg-base,#fff);text-transform:capitalize;">
          ${suggestion ? `<button type="button" class="btn-apply-suggestion btn btn-xs" id="btn-apply-sug" title="Nhận gợi ý (Phím T)" style="height:34px;font-size:12px;">Nhận ${window.SafeHtml.escape(suggestion)} (T)</button>` : ''}
        </div>
        <div id="cc-sug-key" class="cc-mob-chips-row"></div>
        <div class="cc-mob-modifiers-row">
          <button id="cc-mod-slash" class="cc-mob-mod-chip" type="button" title="Hợp âm đảo bass">/bass</button>
          <button id="cc-mod-7" class="cc-mob-mod-chip" type="button" title="Thêm âm 7">7</button>
          <button id="cc-mod-sus" class="cc-mob-mod-chip" type="button" title="Hợp âm Sus">sus</button>
          <button id="cc-mod-m" class="cc-mob-mod-chip" type="button" title="Thứ (minor)">m</button>
          <button id="cc-mod-kbd" class="cc-mob-mod-chip" type="button" title="Gõ tay hợp âm">⌨ gõ tay</button>
          <button id="cc-mod-copy" class="cc-mob-mod-chip" type="button" title="Chép ô nhịp">≡ chép ô nhịp</button>
        </div>
        <div id="cc-sug-hist" style="display:none;"></div>
        <div style="display:none;"><button id="cc-pop-save">Lưu</button><button id="cc-pop-del">Xóa</button><button id="cc-pop-cancel">Hủy</button><button id="cc-pop-copy-measures">Chép</button></div>`;
    } else {
      pop.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem;display:flex;align-items:center;gap:4px;">
          ${existing ? 'Sửa' : 'Thêm'} hợp âm ${!isDefault ? `<span style="opacity:.6;font-weight:400">· ${window.SafeHtml.escape(currentSet)}</span>` : ''} ${keyLabel ? `<span style="opacity:.7;font-weight:600;font-size:12px;color:#7c3aed">· ${window.SafeHtml.escape(keyLabel)}</span>` : ''}
        </div>
        <input id="cc-pop-inp" type="text" maxlength="12" autocomplete="off"
               placeholder="${suggestion ? `Gợi ý: ${window.SafeHtml.escape(suggestion)} (T)` : 'VD: Am, D7, G…'}" value="${window.SafeHtml.escape(existing)}"
               style="width:100%;box-sizing:border-box;border:1.5px solid #c4b5fd;border-radius:5px;padding:.35rem .55rem;font-size:.95rem;font-weight:700;font-family:monospace;color:#c00;outline:none;background:var(--bg-base,#fff);margin-bottom:.35rem;text-transform:capitalize;"
               onfocus="this.style.borderColor='#6d28d9';this.style.boxShadow='0 0 0 3px rgba(109,40,217,.18)'"
               onblur="this.style.borderColor='#c4b5fd';this.style.boxShadow='none'">
        ${suggestion ? `<div class="cc-suggestion-hint">Gợi ý từ TLH: <strong>${window.SafeHtml.escape(suggestion)}</strong> <button type="button" class="btn-apply-suggestion" id="btn-apply-sug" title="Nhận gợi ý (Phím T)">Nhận (T)</button><label class="cc-toggle-tlh-wrap" style="margin-left:auto;font-size:11px;color:var(--text-muted,#6b7280);cursor:pointer;display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" id="cc-toggle-tlh-ghost" ${window.ChordCanvas?.isSuggestionMode?.() ? 'checked' : ''} style="margin:0;cursor:pointer;"> TLH mờ</label></div>` : ''}
        <div id="cc-sug-key" style="display:flex;align-items:flex-start;gap:4px;min-height:22px;margin-bottom:.35rem;"></div>
        <div id="cc-sug-hist" style="display:flex;align-items:flex-start;gap:4px;min-height:22px;margin-bottom:2px;"></div>
        <div class="cc-shortcuts-hint" style="font-size:12px;color:#6b7280;margin-bottom:.35rem;">1–7: hợp âm · Shift+1–7: hợp âm 7 · /+số: bass · . lặp</div>
        <details id="cc-lib-det" style="margin-bottom:.4rem;">
          <summary style="font-size:12px;color:#9ca3af;cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px;">
            <span>📚 Thư viện</span><span id="cc-lib-tabs" style="display:flex;gap:2px;flex-wrap:wrap;"></span>
          </summary>
          <input id="cc-lib-search" type="text" placeholder="Tìm hợp âm..." autocomplete="off" style="width:100%;box-sizing:border-box;margin-top:4px;padding:2px 7px;border:1px solid #ddd;border-radius:5px;font-size:12px;outline:none;color:#374151;">
          <div id="cc-lib-chips" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;max-height:72px;overflow-y:auto;"></div>
        </details>
        <div style="display:flex;gap:.35rem;justify-content:flex-end;">
          <button id="cc-pop-copy-measures" class="btn btn-ghost btn-xs" type="button" title="Chép ô nhịp (Ctrl+C/V)">≡ Chép ô</button>
          <button id="cc-pop-save" class="btn btn-primary btn-xs">✓ Lưu</button>
          ${existing ? '<button id="cc-pop-del" class="btn btn-danger btn-xs">🗑</button>' : ''}
          <button id="cc-pop-cancel" class="btn btn-ghost btn-xs">✕</button>
        </div>`;
    }

    document.body.appendChild(pop);

    const inp      = pop.querySelector('#cc-pop-inp');
    const histDiv  = pop.querySelector('#cc-sug-hist');
    const keyDiv   = pop.querySelector('#cc-sug-key');
    const libTabs  = pop.querySelector('#cc-lib-tabs');
    const libChips = pop.querySelector('#cc-lib-chips');
    let   activeGrp = 0;

    const makeChip = (label, isHist, onClick, deg) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = deg ? `<span class="cc-deg-num">${deg}</span>${window.SafeHtml.escape(label)}` : window.SafeHtml.escape(label);
      b.className = isHist ? 'cc-chip cc-chip-hist' : (deg ? 'cc-chip cc-chip-dia' : 'cc-chip cc-chip-sec');
      b.setAttribute('data-chord', label);
      if (deg) b.setAttribute('data-degree', deg);
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onClick(label); });
      return b;
    };

    /* populate history */
    const hist = _getHist();
    if (hist.length && !isMobile) {
      const lbl = document.createElement('span'); lbl.textContent = '🕐'; lbl.style.cssText = 'font-size:12px;flex-shrink:0;margin-top:2px;';
      histDiv.appendChild(lbl);
      const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
      hist.slice(0,8).forEach(c => wrap.appendChild(makeChip(c, true, v => { inp.value = v; inp.focus(); })));
      histDiv.appendChild(wrap);
    } else if (histDiv) { histDiv.style.display = 'none'; }

    /* populate key diatonic & secondary (R2-2 & R2-5) */
    if (diatonicChords.length && keyDiv) {
      if (!isMobile) {
        const lbl = document.createElement('span'); lbl.textContent = '🎵'; lbl.style.cssText = 'font-size:12px;flex-shrink:0;margin-top:2px;';
        keyDiv.appendChild(lbl);
      }
      const wrap = isMobile ? keyDiv : document.createElement('div');
      if (!isMobile) { wrap.className = 'cc-diatonic-bar'; wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;align-items:center;'; }
      diatonicChords.forEach((c, idx) => {
        wrap.appendChild(makeChip(c, false, v => { inp.value = v; doSaveNext(); }, idx + 1));
      });
      if (seventhChords.length) {
        const c7 = seventhChords[4] || seventhChords[0];
        if (c7 && !diatonicChords.includes(c7)) wrap.appendChild(makeChip(c7, false, v => { inp.value = v; doSaveNext(); }));
      }
      if (secondaryChords.length && !isMobile) {
        const div = document.createElement('span'); div.className = 'cc-palette-divider';
        div.style.cssText = 'width:1px;height:16px;background:var(--lp-border,#e5e7eb);margin:0 2px;';
        wrap.appendChild(div);
        secondaryChords.forEach(c => wrap.appendChild(makeChip(c, false, v => { inp.value = v; doSaveNext(); })));
      }
      if (!isMobile) keyDiv.appendChild(wrap);
    } else if (keyDiv) { keyDiv.style.display = 'none'; }

    /* library tabs (desktop) */
    const renderLib = (gi) => {
      if (!libChips || !libTabs) return;
      activeGrp = gi; libChips.innerHTML = '';
      libTabs.querySelectorAll('button').forEach((b,i) => {
        b.style.background = i === gi ? '#6d28d9' : '#f3f4f6'; b.style.color = i === gi ? '#fff' : '#6b7280';
      });
      const root = inp.value.match(/^[A-Ga-g][b#]?/)?.[0];
      const fmtRoot = root ? root.charAt(0).toUpperCase() + root.slice(1) : null;
      _GROUPS[gi].s.forEach(s => {
        const label = fmtRoot ? fmtRoot + s : 'C' + s;
        libChips.appendChild(makeChip(label, false, v => { inp.value = v; inp.focus(); }));
      });
    };

    if (libTabs) {
      _GROUPS.forEach((g, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = g.label;
        b.style.cssText = 'padding:1px 6px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;cursor:pointer;';
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); renderLib(i); });
        libTabs.appendChild(b);
      });
      renderLib(0);
    }

    const libSearch = pop.querySelector('#cc-lib-search');
    libSearch?.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { renderLib(activeGrp); return; }
      libChips.innerHTML = '';
      const root = inp.value.match(/^[A-Ga-g][b#]?/)?.[0];
      const fmtRoot = root ? root.charAt(0).toUpperCase() + root.slice(1) : 'C';
      _GROUPS.forEach(g => {
        g.s.filter(s => (fmtRoot + s).toLowerCase().includes(q) || s.toLowerCase().includes(q))
          .forEach(s => libChips.appendChild(makeChip(fmtRoot + s, false, v => { inp.value = v; inp.focus(); })));
      });
    });
    libSearch?.addEventListener('keydown', e => e.stopPropagation());

    const formatChord = v => {
      if (!v) return v;
      let r = v.charAt(0).toUpperCase() + v.substring(1);
      if (r.length >= 2) { const c = r.charAt(1).toLowerCase(); if (c==='b'||c==='#') r = r[0]+c+r.slice(2); }
      return r;
    };

    inp.addEventListener('input', () => {
      if (pop.querySelector('#cc-lib-det[open]')) renderLib(activeGrp);
    });

    setTimeout(() => { if (!isMobile) { inp?.focus(); inp?.select(); } }, 80);

    let _saved = false, _blurTimer = null;

    const doSave = () => {
      if (_saved) return;
      _saved = true; clearTimeout(_blurTimer);
      const val = formatChord(inp.value.trim());
      if (document.activeElement === inp) inp.blur();
      _cleanupMob();
      if (val) { _pushHist(val); _lastSavedChord = val; callbacks.onSave(val); }
      else if (existing) { callbacks.onDelete(); }
      callbacks.onClose();
    };

    if (!isMobile) {
      inp.addEventListener('blur', () => {
        if (_saved) return;
        _blurTimer = setTimeout(() => {
          if (_saved) return;
          const val = formatChord(inp.value.trim());
          if (val && val !== existing) doSave();
          else callbacks.onClose();
        }, 400);
      });
      inp.addEventListener('focus', () => clearTimeout(_blurTimer));
    }

    const saveBtn = pop.querySelector('#cc-pop-save');
    saveBtn?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doSave(); });
    saveBtn?.addEventListener('click', e => { e.stopPropagation(); doSave(); });

    pop.querySelector('#cc-pop-del')?.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (_saved) return; _saved = true; clearTimeout(_blurTimer);
      if (document.activeElement === inp) inp.blur();
      _cleanupMob(); callbacks.onDelete(); callbacks.onClose();
    });

    pop.querySelector('#cc-pop-cancel')?.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); _saved = true; clearTimeout(_blurTimer); _cleanupMob(); callbacks.onClose();
    });

    const copyBtn = pop.querySelector('#cc-pop-copy-measures');
    const handleCopy = (e) => {
      e.preventDefault(); e.stopPropagation(); _saved = true; clearTimeout(_blurTimer); _cleanupMob();
      window.ChordCanvasEdit?.showCopyMeasuresModal?.(measureIdx);
      setTimeout(() => callbacks.onClose(), 50);
    };
    copyBtn?.addEventListener('pointerdown', handleCopy);
    copyBtn?.addEventListener('click', handleCopy);

    const sugBtn = pop.querySelector('#btn-apply-sug');
    sugBtn?.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); inp.value = suggestion; inp.focus();
    });
    const ghostToggle = pop.querySelector('#cc-toggle-tlh-ghost');
    ghostToggle?.addEventListener('change', (e) => {
      window.ChordCanvas?.setShowTlhSuggestions?.(e.target.checked);
    });

    const doSaveNext = () => {
      if (_saved) return;
      _saved = true; clearTimeout(_blurTimer);
      const val = formatChord(inp.value.trim());
      if (document.activeElement === inp) inp.blur();
      _cleanupMob(); callbacks.onClose();
      if (val) { _pushHist(val); _lastSavedChord = val; callbacks.onSave(val, { skipRebuild: true }); }
      else if (existing) { callbacks.onDelete(); }
      callbacks.onNext?.(measureIdx, noteIdx);
    };

    const doSavePrev = () => {
      if (_saved) return;
      _saved = true; clearTimeout(_blurTimer);
      const val = formatChord(inp.value.trim());
      if (document.activeElement === inp) inp.blur();
      _cleanupMob(); callbacks.onClose();
      if (val) { _pushHist(val); _lastSavedChord = val; callbacks.onSave(val, { skipRebuild: true }); }
      else if (existing) { callbacks.onDelete(); }
      callbacks.onPrev?.(measureIdx, noteIdx);
    };

    /* R2-5: Mobile specific button listeners */
    if (isMobile) {
      pop.querySelector('#cc-mob-done')?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doSave(); });
      pop.querySelector('#cc-mob-done')?.addEventListener('click', e => { e.stopPropagation(); doSave(); });
      pop.querySelector('#cc-mob-del')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (_saved) return; _saved = true; clearTimeout(_blurTimer);
        _cleanupMob(); callbacks.onDelete(); callbacks.onClose();
      });
      pop.querySelector('#cc-mob-undo')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); callbacks.onUndo?.();
      });
      pop.querySelector('#cc-mob-prev')?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doSavePrev(); });
      pop.querySelector('#cc-mob-next')?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doSaveNext(); });
      pop.querySelector('#cc-mod-kbd')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); inp?.focus(); inp?.select();
      });
      pop.querySelector('#cc-mod-copy')?.addEventListener('pointerdown', handleCopy);
      pop.querySelector('#cc-mod-slash')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (!inp.value.endsWith('/')) inp.value += '/';
        inp.focus();
      });
      pop.querySelector('#cc-mod-7')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); inp.value += '7'; inp.focus();
      });
      pop.querySelector('#cc-mod-sus')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); inp.value += 'sus4'; inp.focus();
      });
      pop.querySelector('#cc-mod-m')?.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); inp.value += 'm'; inp.focus();
      });
    }

    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); doSaveNext(); return; }
      if (e.key === 'Escape') { e.stopPropagation(); _saved = true; clearTimeout(_blurTimer); _cleanupMob(); callbacks.onClose(); e.preventDefault(); return; }
      if (e.key === 'Tab' && e.shiftKey) { e.stopPropagation(); e.preventDefault(); doSavePrev(); return; }
      if (e.key === 'Tab' || (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length)) { e.stopPropagation(); e.preventDefault(); doSaveNext(); return; }
      if (e.key === 'ArrowLeft' && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.stopPropagation(); e.preventDefault(); doSavePrev(); return; }

      const isDigit = e.code && e.code.startsWith('Digit') ? parseInt(e.code.replace('Digit', ''), 10) : parseInt(e.key, 10);
      if (!isNaN(isDigit) && isDigit >= 1 && isDigit <= 7 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (inp.value.endsWith('/')) {
          e.preventDefault();
          inp.value = window.ChordCanvasTranspose?.resolveSlashBass?.(inp.value.slice(0, -1), isDigit, displayedRoot, mode) || (inp.value + isDigit);
          inp.select(); return;
        }
        if (e.shiftKey) {
          const c7 = seventhChords[isDigit - 1];
          if (c7) { e.preventDefault(); inp.value = c7; inp.select(); return; }
        }
        if (!inp.value || (inp.selectionStart === 0 && inp.selectionEnd === inp.value.length)) {
          const c = diatonicChords[isDigit - 1];
          if (c) { e.preventDefault(); inp.value = c; inp.select(); return; }
        }
      }
      if (e.key === '.' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (_lastSavedChord && (!inp.value || (inp.selectionStart === 0 && inp.selectionEnd === inp.value.length))) {
          e.preventDefault(); inp.value = _lastSavedChord; inp.select(); return;
        }
      }
      if ((e.key === 't' || e.key === 'T') && suggestion && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!inp.value.trim() || inp.value === suggestion) {
          e.preventDefault(); inp.value = suggestion; inp.select();
        }
      }
    });

    pop.addEventListener('pointerdown', e => e.stopPropagation());
    pop.addEventListener('click', e => e.stopPropagation());

    const outside = ev => {
      if (pop.contains(ev.target)) return;
      if (ev.target === anchor || anchor.contains(ev.target)) return;
      document.removeEventListener('pointerdown', outside, true);
      _cleanupMob(); doSave();
    };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 300);

    return pop;
  }

  /* ─── Modals ─────────────────────────────────────────────────── */
  function showNewSetModal(callbacks) {
    document.getElementById('cc-new-set-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'cc-new-set-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.5rem;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.2);"><div style="font-size:1rem;font-weight:700;color:#1e1b4b;margin-bottom:.2rem;">Tạo bộ hợp âm mới</div><div style="font-size:12px;color:#6b7280;margin-bottom:1rem;">Nhập tên người hoặc phong cách chơi</div><input id="cc-new-set-inp" type="text" maxlength="40" placeholder="Tên bộ hợp âm…" style="width:100%;box-sizing:border-box;border:1.5px solid #ddd;border-radius:7px;padding:.45rem .7rem;font-size:14px;font-weight:600;outline:none;margin-bottom:1rem;"><div style="display:flex;gap:.5rem;justify-content:flex-end;"><button id="cc-new-set-cancel" class="btn btn-ghost btn-sm">Hủy</button><button id="cc-new-set-ok" class="btn btn-primary btn-sm">✓ Tạo</button></div></div>`;
    document.body.appendChild(overlay);
    const inp = overlay.querySelector('#cc-new-set-inp');
    setTimeout(() => inp?.focus(), 50);
    const doCreate = () => { const n = inp.value.trim(); overlay.remove(); if (n) callbacks.onCreate(n); };
    overlay.querySelector('#cc-new-set-ok').onclick = doCreate;
    overlay.querySelector('#cc-new-set-cancel').onclick = () => overlay.remove();
    inp.onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); doCreate(); } if (e.key === 'Escape') { e.stopPropagation(); overlay.remove(); } };
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  }

  function showDeleteConfirmModal(name, callbacks) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.4rem;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,.2);"><div style="font-size:14px;font-weight:700;color:#b91c1c;margin-bottom:.5rem;">Xóa bộ hợp âm?</div><div style="font-size:12px;color:#6b7280;margin-bottom:1rem;">Xóa "<strong>${window.SafeHtml.escape(name)}</strong>"? Hành động này không thể hoàn tác.</div><div style="display:flex;gap:.5rem;justify-content:flex-end;"><button id="cc-del-cancel" class="btn btn-ghost btn-sm">Hủy</button><button id="cc-del-ok" class="btn btn-danger btn-sm">🗑 Xóa</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cc-del-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#cc-del-ok').onclick = () => { overlay.remove(); callbacks.onConfirm(); };
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  }

  function showCloneChoiceModal({ sourceLabel, targetSet, onEditMine, onCopyOverwrite, onCancel }) {
    const isDark = document.body.classList.contains('dark-mode');
    const bgCard = isDark ? '#1e293b' : '#ffffff', textPri = isDark ? '#f8fafc' : '#0f172a';
    const textSec = isDark ? '#94a3b8' : '#64748b', border = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const safeSource = window.SafeHtml ? window.SafeHtml.escape(sourceLabel) : sourceLabel;
    const safeTarget = window.SafeHtml ? window.SafeHtml.escape(targetSet) : targetSet;
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'cc-clone-choice-title');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
    overlay.innerHTML = `<div style="background:${bgCard};color:${textPri};border:1px solid ${border};border-radius:14px;padding:1.5rem;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.4);"><div id="cc-clone-choice-title" style="font-size:1rem;font-weight:700;line-height:1.2;margin-bottom:.35rem;">Bắt đầu sửa hợp âm</div><div style="font-size:12px;color:${textSec};line-height:1.5;margin-bottom:1.1rem;">Bạn đang xem bộ <strong>${safeSource}</strong> — không thể sửa trực tiếp. Bộ cá nhân của bạn là <strong style="color:#10b981;">${safeTarget}</strong>.</div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"><button id="cc-clone-edit-mine" class="btn btn-primary btn-sm" style="text-align:left;padding:10px 12px;border-radius:10px;font-weight:600;">✎ Sửa trên bản của tôi (${safeTarget})<div style="font-weight:400;font-size:12px;opacity:.85;margin-top:2px;">Giữ nguyên hợp âm đã có trong bản của bạn.</div></button><button id="cc-clone-copy" class="btn btn-sm" style="text-align:left;padding:10px 12px;border-radius:10px;background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.35);color:#b45309;font-weight:600;">⧉ Sao chép ${safeSource} sang ${safeTarget} (ghi đè)<div style="font-weight:400;font-size:12px;opacity:.9;margin-top:2px;">Thay thế toàn bộ hợp âm hiện có.</div></button></div><div style="display:flex;justify-content:flex-end;"><button id="cc-clone-cancel" class="btn btn-ghost btn-sm">Hủy</button></div></div>`;
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    overlay.querySelector('#cc-clone-edit-mine').onclick = () => { cleanup(); onEditMine?.(); };
    overlay.querySelector('#cc-clone-cancel').onclick = () => { cleanup(); onCancel?.(); };
    overlay.querySelector('#cc-clone-copy').onclick = () => {
      if (window.confirm(`Ghi đè TOÀN BỘ hợp âm hiện có trong bản "${targetSet}" bằng nội dung của "${sourceLabel}"?\n\nHành động này không thể hoàn tác.`)) {
        cleanup(); onCopyOverwrite?.();
      }
    };
    overlay.onclick = e => { if (e.target === overlay) { cleanup(); onCancel?.(); } };
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); cleanup(); onCancel?.(); }
    });
  }

  return { getScale, getTextSize, getDotSize, applyAbsolute, createPopup, showNewSetModal, showDeleteConfirmModal, showCloneChoiceModal };
})();

window.ChordCanvasUI = ChordCanvasUI;
