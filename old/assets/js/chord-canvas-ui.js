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
    // Vi\u1ec3u d\u1ea5u '+': nh\u1ecf g\u1ecdn, scale theo zoom, t\u1ed1i thi\u1ec3u 10px \u2014 touch area m\u1edf r\u1ed9ng qua CSS ::after
    return Math.max(10, Math.round(14 * scale));
  }

  function applyAbsolute(el, cx, cy, extras) {
    el.style.cssText = [
      'position:absolute', `left:${cx}px`, `top:${cy}px`,
      'transform:translateX(-50%)', 'z-index:80', ...extras
    ].join(';');
  }


  /* ─── Chord history (localStorage) ─────────────────────────── */
  const _HK = 'cc_chord_history';
  function _getHist() { try { return JSON.parse(localStorage.getItem(_HK)||'[]'); } catch{return[];} }
  function _pushHist(c) {
    if (!c) return;
    const h = _getHist().filter(x => x !== c); h.unshift(c);
    localStorage.setItem(_HK, JSON.stringify(h.slice(0,20)));
  }

  /* ─── Key detection từ MusicXML ────────────────────────────── */
  const _F2M = {'-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F',
                 '0':'C', '1':'G', '2':'D',  '3':'A',  '4':'E',  '5':'B',  '6':'F#'};
  const _F2m = {'-6':'Eb','-5':'Bb','-4':'F','-3':'C','-2':'G','-1':'D',
                 '0':'A', '1':'E', '2':'B',  '3':'F#', '4':'C#', '5':'G#','6':'D#'};
  const _CR  = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const _SH  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function _detectKey() {
    const xml = window.App?.getOriginalXml?.();
    if (!xml) return null;
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const k   = doc.querySelector('key'); if (!k) return null;
      const f   = String(parseInt(k.querySelector('fifths')?.textContent ?? '0'));
      const m   = k.querySelector('mode')?.textContent?.toLowerCase() ?? 'major';
      const r   = m === 'minor' ? (_F2m[f]??'A') : (_F2M[f]??'C');
      return { root: r, mode: m, label: `${r} ${m==='minor'?'thứ':'trưởng'}` };
    } catch { return null; }
  }

  function _diatonicChords(root, mode) {
    const useFlat = ['F','Bb','Eb','Ab','Db','Gb'].includes(root);
    const arr = useFlat ? _CR : _SH;
    let ri = arr.indexOf(root); if (ri === -1) ri = _CR.indexOf(root); if (ri === -1) return [];
    const pat = mode === 'minor'
      ? [{d:0,s:'m'},{d:2,s:'dim'},{d:3,s:''},{d:5,s:'m'},{d:7,s:'m'},{d:7,s:'7'},{d:8,s:''},{d:10,s:''}]
      : [{d:0,s:''},{d:2,s:'m'},{d:4,s:'m'},{d:5,s:''},{d:7,s:''},{d:7,s:'7'},{d:9,s:'m'},{d:11,s:'dim'}];
    return [...new Set(pat.map(({d,s}) => arr[(ri+d)%12]+s))];
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
  function createPopup(anchor, measureIdx, noteIdx, existing, currentSet, callbacks) {
    const ar  = anchor.getBoundingClientRect();
    const isMobile = window.innerWidth <= 900;
    const pop = document.createElement('div');
    pop.className = 'cc-popup';

    const keyInfo  = _detectKey();
    const keyLabel = keyInfo ? keyInfo.label : '';
    const isDefault  = currentSet === 'default';
    const semitones  = window.App?.getCurrentTranspose?.() ?? 0;
    const keyHint    = semitones !== 0
      ? `<span style="font-size:.6rem;color:#f59e0b;font-weight:600;margin-left:4px;">(tông ${semitones>0?'+':''}${semitones})</span>` : '';

    if (isMobile) {
      // Mobile: bottom sheet cố định — sử dụng class CSS
      pop.classList.add('cc-popup-mobile');
      requestAnimationFrame(() => { pop.classList.add('active'); });
    } else {
      // Desktop / iPad: popup float bên DƯỚI chord dot
      let popLeft = ar.left + ar.width / 2;
      const vw = window.innerWidth;
      const hw = 145;
      if (popLeft < hw) popLeft = hw;
      if (popLeft > vw - hw) popLeft = vw - hw;
      // Hiển thị bêN DƯỚI anchor (ar.bottom + 8px khoảng cách)
      const popTop = ar.bottom + 8;
      pop.style.cssText = [
        'position:fixed', `left:${popLeft}px`, `top:${popTop}px`,
        'transform:translateX(-50%)',
        'z-index:99999',
        'background:var(--bg-surface,#fff)',
        'border:1px solid rgba(109,40,217,0.3)',
        'border-radius:var(--radius,12px)',
        'padding:.8rem',
        'box-shadow:0 8px 28px rgba(109,40,217,.22)',
        'min-width:260px', 'max-width:320px',
        'pointer-events:auto',
        'opacity:0',
        'transition:opacity .15s ease'
      ].join(';');
      // Sau khi render, check viewport overflow → flip lên trên nếu cần
      requestAnimationFrame(() => {
        const pr = pop.getBoundingClientRect();
        const vh = window.innerHeight;
        if (pr.bottom > vh - 8) {
          // Không đủ chỗ bên dưới → hiển thị phía trên anchor
          pop.style.top = (ar.top - 8) + 'px';
          pop.style.transform = 'translateX(-50%) translateY(-100%)';
        }
        pop.style.opacity = '1';
      });
    }

    pop.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:#6d28d9;text-transform:uppercase;
                  letter-spacing:.5px;margin-bottom:.35rem;display:flex;align-items:center;gap:4px;">
        ${existing ? 'Sửa' : 'Thêm'} hợp âm
        ${!isDefault ? `<span style="opacity:.6;font-weight:400">· ${currentSet}</span>` : ''}
        ${keyLabel ? `<span style="opacity:.5;font-weight:400;font-size:.6rem">· ${keyLabel}</span>` : ''}
        ${keyHint}
      </div>
      <input id="cc-pop-inp" type="text" maxlength="12" autocomplete="off"
             placeholder="VD: Am, D7, G…" value="${existing}"
             style="width:100%;box-sizing:border-box;border:1.5px solid #c4b5fd;border-radius:5px;
                    padding:.35rem .55rem;font-size:.95rem;font-weight:700;font-family:monospace;
                    color:#c00;outline:none;background:var(--bg-base,#fff);margin-bottom:.35rem;
                    text-transform:capitalize;transition:border-color .15s;"
             onfocus="this.style.borderColor='#6d28d9';this.style.boxShadow='0 0 0 3px rgba(109,40,217,.18)'"
             onblur="this.style.borderColor='#c4b5fd';this.style.boxShadow='none'">
      <div id="cc-sug-hist" style="display:flex;align-items:flex-start;gap:4px;min-height:22px;margin-bottom:2px;"></div>
      <div id="cc-sug-key"  style="display:flex;align-items:flex-start;gap:4px;min-height:22px;margin-bottom:.35rem;"></div>
      <details id="cc-lib-det" style="margin-bottom:.4rem;">
        <summary style="font-size:.65rem;color:#9ca3af;cursor:pointer;list-style:none;
                        display:flex;align-items:center;gap:4px;">
          <span>📚 Thư viện</span>
          <span id="cc-lib-tabs" style="display:flex;gap:2px;flex-wrap:wrap;"></span>
        </summary>
        <input id="cc-lib-search" type="text" placeholder="Tìm hợp âm..." autocomplete="off"
               style="width:100%;box-sizing:border-box;margin-top:4px;padding:2px 7px;
                      border:1px solid #ddd;border-radius:5px;font-size:.75rem;
                      outline:none;color:#374151;">
        <div id="cc-lib-chips" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;max-height:72px;overflow-y:auto;"></div>
      </details>
      <div style="display:flex;gap:.35rem;justify-content:flex-end;">
        <button id="cc-pop-save" class="btn btn-primary btn-xs">✓ Lưu</button>
        ${existing ? '<button id="cc-pop-del" class="btn btn-danger btn-xs">🗑</button>' : ''}
        <button id="cc-pop-cancel" class="btn btn-ghost btn-xs">✕</button>
      </div>`;

    document.body.appendChild(pop);

    const inp      = pop.querySelector('#cc-pop-inp');
    const histDiv  = pop.querySelector('#cc-sug-hist');
    const keyDiv   = pop.querySelector('#cc-sug-key');
    const libTabs  = pop.querySelector('#cc-lib-tabs');
    const libChips = pop.querySelector('#cc-lib-chips');
    let   activeGrp = 0;

    /* helper: make a chip — touch-action + pointerdown để instant tap trên iOS */
    const makeChip = (label, isHist, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = isHist ? 'cc-chip cc-chip-hist' : 'cc-chip cc-chip-dia';
      // pointerdown = instant, không có 300ms delay iOS
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onClick(label); });
      return b;
    };

    /* populate history */
    const hist = _getHist();
    if (hist.length) {
      const lbl = document.createElement('span');
      lbl.textContent = '🕐';
      lbl.style.cssText = 'font-size:.65rem;flex-shrink:0;margin-top:2px;';
      histDiv.appendChild(lbl);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
      hist.slice(0,8).forEach(c => wrap.appendChild(makeChip(c, true, v => { inp.value = v; inp.focus(); })));
      histDiv.appendChild(wrap);
    } else { histDiv.style.display = 'none'; }

    /* populate key diatonic */
    if (keyInfo) {
      const diat = _diatonicChords(keyInfo.root, keyInfo.mode);
      if (diat.length) {
        const lbl = document.createElement('span');
        lbl.textContent = '🎵';
        lbl.style.cssText = 'font-size:.65rem;flex-shrink:0;margin-top:2px;';
        keyDiv.appendChild(lbl);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
        diat.forEach(c => wrap.appendChild(makeChip(c, false, v => { inp.value = v; inp.focus(); })));
        keyDiv.appendChild(wrap);
      }
    } else { keyDiv.style.display = 'none'; }

    /* library tabs */
    const renderLib = (gi) => {
      activeGrp = gi;
      libChips.innerHTML = '';
      libTabs.querySelectorAll('button').forEach((b,i) => {
        b.style.background = i === gi ? '#6d28d9' : '#f3f4f6';
        b.style.color      = i === gi ? '#fff' : '#6b7280';
      });
      const root = inp.value.match(/^[A-Ga-g][b#]?/)?.[0];
      const fmtRoot = root ? root.charAt(0).toUpperCase() + root.slice(1) : null;
      _GROUPS[gi].s.forEach(s => {
        const label = fmtRoot ? fmtRoot + s : 'C' + s;
        libChips.appendChild(makeChip(label, false, v => { inp.value = v; inp.focus(); }));
      });
    };

    _GROUPS.forEach((g, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = g.label;
      b.style.cssText = 'padding:1px 6px;border-radius:99px;font-size:.6rem;font-weight:600;border:1px solid #e5e7eb;cursor:pointer;';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); renderLib(i); });
      libTabs.appendChild(b);
    });
    renderLib(0);

    /* search trong chord library */
    const libSearch = pop.querySelector('#cc-lib-search');
    libSearch?.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { renderLib(activeGrp); return; }
      libChips.innerHTML = '';
      const root    = inp.value.match(/^[A-Ga-g][b#]?/)?.[0];
      const fmtRoot = root ? root.charAt(0).toUpperCase() + root.slice(1) : 'C';
      _GROUPS.forEach(g => {
        g.s.filter(s => (fmtRoot + s).toLowerCase().includes(q) || s.toLowerCase().includes(q))
          .forEach(s => {
            const label = fmtRoot + s;
            libChips.appendChild(makeChip(label, false, v => { inp.value = v; inp.focus(); }));
          });
      });
    });
    libSearch?.addEventListener('keydown', e => e.stopPropagation());

    /* format */
    const formatChord = v => {
      if (!v) return v;
      let r = v.charAt(0).toUpperCase() + v.substring(1);
      if (r.length >= 2) { const c = r.charAt(1).toLowerCase(); if (c==='b'||c==='#') r = r[0]+c+r.slice(2); }
      return r;
    };

    /* update lib chips when root changes */
    inp.addEventListener('input', () => {
      if (pop.querySelector('#cc-lib-det[open]')) renderLib(activeGrp);
    });

    // iOS cần delay 100ms+ để virtual keyboard mở sau khi popup animate vào
    setTimeout(() => { inp?.focus(); inp?.select(); }, isMobile ? 350 : 80);

    // _saved: guard chống double-fire (blur + button cùng lúc)
    let _saved = false;
    let _blurTimer = null;

    const doSave = () => {
      if (_saved) return;
      _saved = true;
      clearTimeout(_blurTimer);
      const val = formatChord(inp.value.trim());
      if (document.activeElement === inp) inp.blur();
      // onSave TRƯỚC onClose — tránh popup bị remove trước khi save chạy
      if (val)      { _pushHist(val); callbacks.onSave(val); }
      else if (existing) { callbacks.onDelete(); }
      callbacks.onClose();
    };

    // Blur auto-save (desktop: user bấm ra ngoài mà không bấm Lưu)
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

    // Nút Lưu: pointerdown (instant) + click (fallback desktop)
    const saveBtn = pop.querySelector('#cc-pop-save');
    if (saveBtn) {
      saveBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doSave(); });
      saveBtn.addEventListener('click', e => { e.stopPropagation(); doSave(); });
    }

    // Nút Xóa
    pop.querySelector('#cc-pop-del')?.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (_saved) return; _saved = true; clearTimeout(_blurTimer);
      if (document.activeElement === inp) inp.blur();
      callbacks.onDelete();
      callbacks.onClose();
    });

    // Nút Hủy
    pop.querySelector('#cc-pop-cancel')?.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      _saved = true; clearTimeout(_blurTimer);
      callbacks.onClose();
    });

    const doSaveNext = () => {
      if (_saved) return;
      _saved = true; clearTimeout(_blurTimer);
      const val = formatChord(inp.value.trim());
      if (document.activeElement === inp) inp.blur();
      callbacks.onClose();
      if (val) {
        _pushHist(val);
        window.ChordCanvas?.saveChordWithoutReload?.(measureIdx, noteIdx, val);
      }
      window.ChordCanvas?.openNextPopup?.(measureIdx, noteIdx);
    };

    inp?.addEventListener('keydown', e => {
      if (e.key==='Enter')  { e.stopPropagation(); doSave(); e.preventDefault(); }
      if (e.key==='Escape') { e.stopPropagation(); _saved=true; clearTimeout(_blurTimer); callbacks.onClose(); e.preventDefault(); }
      if (e.key==='Tab'||e.key==='ArrowRight') { e.stopPropagation(); e.preventDefault(); doSaveNext(); }
    });

    // Ngăn event lan ra ngoài popup
    pop.addEventListener('pointerdown', e => e.stopPropagation());
    pop.addEventListener('click', e => e.stopPropagation());

    // Outside-click đóng popup (delay 300ms để tránh đóng ngay khi vừa mở trên iPad)
    const outside = ev => {
      if (pop.contains(ev.target)) return;
      if (ev.target === anchor || anchor.contains(ev.target)) return;
      _saved = true; clearTimeout(_blurTimer);
      if (document.activeElement === inp) inp.blur();
      callbacks.onClose();
      document.removeEventListener('pointerdown', outside, true);
    };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 300);

    return pop;
  }

  /* ─── Modal Tạo Mới Hợp Âm ─────────────────────────────────── */

  function showNewSetModal(callbacks) {
    document.getElementById('cc-new-set-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cc-new-set-modal';
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,.45)',
      'display:flex','align-items:center','justify-content:center',
      'z-index:99999','animation:fadeIn .15s ease'
    ].join(';');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:1.5rem 1.75rem;
                  min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:1rem;font-weight:700;color:#1e1b4b;margin-bottom:.2rem;">Tạo bộ hợp âm mới</div>
        <div style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">
          Nhập tên người hoặc phong cách chơi (VD: Hoài Dinh, Gospel...)
        </div>
        <input id="cc-new-set-inp" type="text" maxlength="40"
               placeholder="Tên bộ hợp âm…"
               style="width:100%;box-sizing:border-box;border:1.5px solid #ddd;
                      border-radius:7px;padding:.45rem .7rem;font-size:.95rem;
                      font-weight:600;outline:none;margin-bottom:1rem;"
               onfocus="this.style.borderColor='#6d28d9';"
               onblur="this.style.borderColor='#ddd';">
        <div style="display:flex;gap:.5rem;justify-content:flex-end;">
          <button id="cc-new-set-cancel" class="btn btn-ghost btn-sm">Hủy</button>
          <button id="cc-new-set-ok" class="btn btn-primary btn-sm">✓ Tạo</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const inp = overlay.querySelector('#cc-new-set-inp');
    setTimeout(() => inp?.focus(), 50);

    const doCreate = () => {
      const n = inp.value.trim();
      overlay.remove();
      if (n) callbacks.onCreate(n);
    };

    overlay.querySelector('#cc-new-set-ok').addEventListener('click', doCreate);
    overlay.querySelector('#cc-new-set-cancel').addEventListener('click', () => overlay.remove());
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); doCreate(); }
      if (e.key === 'Escape') { e.stopPropagation(); overlay.remove(); }
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  /* ─── Modal Xác nhận xoá ─────────────────────────────────── */
  function showDeleteConfirmModal(name, callbacks) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:1.4rem 1.75rem;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:.95rem;font-weight:700;color:#b91c1c;margin-bottom:.5rem;">Xóa bộ hợp âm?</div>
        <div style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">Xóa "<strong>${name}</strong>"? Hành động này không thể hoàn tác.</div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;">
          <button id="cc-del-cancel" class="btn btn-ghost btn-sm">Hủy</button>
          <button id="cc-del-ok" class="btn btn-danger btn-sm">🗑 Xóa</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#cc-del-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#cc-del-ok').onclick = () => {
      overlay.remove();
      callbacks.onConfirm();
    };
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  }

  return { getScale, getTextSize, getDotSize, applyAbsolute, createPopup, showNewSetModal, showDeleteConfirmModal };
})();
