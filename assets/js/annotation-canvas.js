/**
 * annotation-canvas.js — Tương tác trực tiếp để gắn Ghi Chú (Sticky Notes)
 */
const AnnotationCanvas = (() => {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────── */
  let _editEnabled = false;
  let _popup       = null;
  let _notes       = {}; // { "measureIdx_noteIdx": { text, color } }
  let _noteEls     = [];
  let _ro          = null;
  let _isInitialized = false;

  const DOT_CLASS = 'ano-dot';
  const BTN_CLASS = 'ano-dot-btn';

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    document.getElementById('btn-add-annotate-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-annotate')?.addEventListener('click', () => setAddMode(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });
    
    if (_isInitialized) return;
    _isInitialized = true;

    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        if (!_editEnabled && Object.keys(_notes).length === 0) return;
        clearTimeout(rTid);
        rTid = setTimeout(() => { _build(); }, 150);
      });
      _ro.observe(container);
    }
  }

  function onOSMDRendered() { setTimeout(_build, 200); }
  function reposition() { setTimeout(_build, 100); }

  async function loadSong(songId) {
    _clear();
    setAddMode(false);
    _notes = {};
    if (!songId) return;

    try {
      const res = await window.ApiService?.annotations?.load?.(songId);
      // AnnotationController trả {success:true, annotations:[...]} via Response::ok()
      const list = res?.annotations ?? (Array.isArray(res) ? res : []);
      list.forEach(a => {
        _notes[`${a.measureIdx}_${a.noteIdx}`] = a;
      });
    } catch(e) {
      console.warn('Load annotation error:', e);
    }
    _build();
  }

  function clearSong() { _clear(); setAddMode(false); }

  /* ─── Mode ──────────────────────────────────────────────────── */
  function setAddMode(on) {
    _editEnabled = !!on;
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('active', on);
    document.getElementById('add-annotate-hint')?.classList.toggle('hidden', !on);
    document.querySelectorAll('.' + BTN_CLASS).forEach(d => { d.style.display = on ? 'flex' : 'none'; });
    
    // Nếu ChordMode đang bật thì tắt
    if (on && window.ChordCanvas && document.getElementById('btn-add-chord-mode')?.classList.contains('active')) {
      window.ChordCanvas.setAddMode(false);
    }

    if (on) { _build(); } 
    else { _closePopup(); _build(); } // Vẽ lại để xoá nút [+] nếu có
  }

  function toggleAddMode() { setAddMode(!_editEnabled); }

  /* ─── Build dots ─────────────────────────────────────────────── */
  function _clear() {
    document.querySelectorAll('.' + DOT_CLASS).forEach(d => d.remove());
    _closePopup();
    _noteEls = [];
  }

  function _build() {
    _clear();
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    let notes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    if (!notes.length) {
      notes = Array.from(svg.querySelectorAll('g')).filter(g => g.querySelector('ellipse') && !g.querySelector('g > g > ellipse'));
    }
    if (!notes.length) return;

    _noteEls = notes;
    const mapped = _mapNotes(notes);
    mapped.forEach(m => _placeDot(m));
  }

  function _mapNotes(noteEls) {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const ml   = osmd?.graphic?.measureList;
    if (ml) {
      try {
        const result = [], byEl = new Map();
        for (let mi = 0; mi < ml.length; mi++) {
          const staves = ml[mi];
          if (!staves?.length) continue;
          const staff = staves[0];
          if (!staff?.staffEntries) continue;
          const src  = staff.ParentSourceMeasure ?? staves[0].parentSourceMeasure;
          const mIdx = src?.measureListIndex ?? mi;
          let nIdx = 0;
          for (const se of staff.staffEntries) {
            if (!se) continue;
            for (const ve of (se.graphicalVoiceEntries || [])) {
              for (const gn of (ve.notes || [])) {
                const svgG = gn.getSVGGElement?.();
                if (svgG) byEl.set(svgG, { mIdx, nIdx });
              }
            }
            nIdx++;
          }
        }
        if (byEl.size > 0) {
          for (const el of noteEls) {
            const m = byEl.get(el) || byEl.get(el.parentElement);
            result.push({
              el, rect: el.getBoundingClientRect(),
              measureIdx: m?.mIdx ?? -1, noteIdx: m?.nIdx ?? result.length,
              anno: m ? (_notes[`${m.mIdx}_${m.nIdx}`] || null) : null
            });
          }
          if (result.some(r => r.measureIdx >= 0)) return result;
        }
      } catch(e) {}
    }
    return [];
  }

  function _placeDot({ el, rect, measureIdx, noteIdx, anno }) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    const cRect = container.getBoundingClientRect();
    
    // Đặt ghi chú phía DƯỚI nốt nhạc thay vì phía trên
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = (rect.top - cRect.top) + rect.height + 15;

    const scale = window.App?.getCurrentZoom?.() ?? 1.0;

      if (anno && anno.text) {
      const div = document.createElement('div');
      div.className = DOT_CLASS;
      div.textContent = (anno.icon ? anno.icon + ' ' : '') + anno.text;
      div.dataset.color = anno.color || 'yellow';

      div.style.cssText = [
        'position:absolute', `left:${cx}px`, `top:${cy}px`,
        'transform:translateX(-50%)', 'z-index:90',
        'border-radius:6px',
        `font-size:${Math.max(10, 11 * scale)}px`, 'padding:3px 8px',
        'white-space:nowrap', 'user-select:none', 'pointer-events:auto', 'cursor:pointer',
        'box-shadow: 0 4px 10px rgba(0,0,0,0.15)', 'transition: transform 0.15s ease, box-shadow 0.15s ease'
      ].join(';');

      div.addEventListener('mouseenter', () => { div.style.transform = 'translateX(-50%) scale(1.05)'; div.style.boxShadow = '0 6px 14px rgba(0,0,0,0.2)'; });
      div.addEventListener('mouseleave', () => { div.style.transform = 'translateX(-50%) scale(1)'; div.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)'; });


      div.addEventListener('click', e => { e.stopPropagation(); _showPopup(div, measureIdx, noteIdx, anno); });
      container.appendChild(div);
    } else if (_editEnabled) {
      const dotSize = Math.max(12, Math.round(16 * scale));
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '✎';
      
      btn.style.cssText = [
        'position:absolute', `left:${cx}px`, `top:${cy}px`,
        'transform:translateX(-50%)', 'z-index:80',
        'display:flex', 'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`, 'border-radius:50%', 'background:rgba(5,150,105,0.85)',
        'color:#fff', `font-size:${10 * scale}px`, 'line-height:1', 'box-shadow:0 2px 7px rgba(5,150,105,0.5)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none', 'transition: transform 0.15s ease, background 0.15s ease'
      ].join(';');

      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateX(-50%) scale(1.15)'; btn.style.background = 'rgba(5,150,105,1)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateX(-50%) scale(1)'; btn.style.background = 'rgba(5,150,105,0.85)'; });

      
      btn.addEventListener('click', e => { e.stopPropagation(); _showPopup(btn, measureIdx, noteIdx, null); });
      container.appendChild(btn);
    }
  }

  /* ─── Popup (Sprint C1: colors + icons) ────────────────────── */
  const _COLORS = [
    { id:'yellow', hex:'#fbbf24', title:'Nhắc nhở' },
    { id:'blue',   hex:'#60a5fa', title:'Kỹ thuật' },
    { id:'red',    hex:'#f87171', title:'Quan trọng' },
    { id:'green',  hex:'#34d399', title:'Hiệu quả' },
    { id:'purple', hex:'#a78bfa', title:'Nâng cao' },
  ];
  const _ICONS = [
    { icon:'🎹', label:'Đàn' }, { icon:'🎵', label:'Hát' },
    { icon:'⚡', label:'Nhanh' }, { icon:'🐢', label:'Chậm' },
    { icon:'⚠️', label:'Lưu ý' }, { icon:'🔄', label:'Lặp' },
  ];

  function _showPopup(anchor, measureIdx, noteIdx, anno) {
    _closePopup();
    let selColor = anno?.color || 'yellow';
    let selIcon  = anno?.icon  || '';
    const ar  = anchor.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'cc-popup';
    pop.style.cssText = [
      'position:fixed', `left:${ar.left + ar.width / 2}px`, `top:${ar.bottom + 8}px`,
      'transform:translateX(-50%) translateY(10px)', 'z-index:99999',
      'background:var(--bg-surface, #fff)', 'border:1px solid rgba(5,150,105,0.3)', 'border-radius:var(--radius, 12px)',
      'padding:.8rem', 'box-shadow:var(--shadow, 0 8px 28px rgba(5,150,105,0.2))',
      'min-width:240px', 'pointer-events:auto', 'opacity:0', 'transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease'
    ].join(';');
    
    // Kích hoạt animation slide-up
    setTimeout(() => {
        pop.style.transform = 'translateX(-50%) translateY(0)';
        pop.style.opacity = '1';
    }, 10);

    const colorBtns = _COLORS.map(c =>
      `<button class="ano-color-btn ${selColor===c.id?'active':''}" data-color="${c.id}"
               style="background:${c.hex}" title="${c.title}"></button>`
    ).join('');
    const iconBtns = _ICONS.map(ic =>
      `<button class="ano-icon-btn ${selIcon===ic.icon?'active':''}" data-icon="${ic.icon}" title="${ic.label}">${ic.icon}</button>`
    ).join('');

    pop.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:.35rem;">
        ${anno ? 'Sửa' : 'Thêm'} Ghi chú
      </div>
      <div class="ano-color-row">${colorBtns}</div>
      <div class="ano-icon-row">${iconBtns}
        <button class="ano-icon-btn ${selIcon===''?'active':''}" data-icon="" title="Không icon">∅</button>
      </div>
      <input id="ac-pop-inp" type="text" maxlength="40"
             placeholder="Ghi chú text..." value="${anno ? _escH(anno.text) : ''}"
             style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:5px;
                    padding:.3rem .55rem;font-size:.85rem;outline:none;margin-bottom:.4rem;">
      <div style="display:flex;gap:.35rem;justify-content:flex-end;">
        <button id="ac-pop-save" class="btn btn-primary btn-xs" style="background:#059669;border-color:#059669;">✓ Lưu</button>
        ${anno ? '<button id="ac-pop-del" class="btn btn-danger btn-xs">🗑</button>' : ''}
        <button id="ac-pop-cancel" class="btn btn-ghost btn-xs">✕</button>
      </div>`;

    document.body.appendChild(pop);
    _popup = pop;

    pop.querySelectorAll('.ano-color-btn').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation(); selColor = b.dataset.color;
        pop.querySelectorAll('.ano-color-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    pop.querySelectorAll('.ano-icon-btn').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation(); selIcon = b.dataset.icon;
        pop.querySelectorAll('.ano-icon-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    const inp = pop.querySelector('#ac-pop-inp');
    setTimeout(() => { inp?.focus(); inp?.select(); }, 20);

    const doSave = async () => {
      const val = inp.value.trim();
      _closePopup();
      if (val) await _saveAnnotation(measureIdx, noteIdx, val, selColor, selIcon);
      else if (anno) await _deleteAnnotation(measureIdx, noteIdx);
    };

    pop.querySelector('#ac-pop-save')?.addEventListener('click', doSave);
    pop.querySelector('#ac-pop-del')?.addEventListener('click', () => { _closePopup(); _deleteAnnotation(measureIdx, noteIdx); });
    pop.querySelector('#ac-pop-cancel')?.addEventListener('click', _closePopup);
    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); doSave(); }
      if (e.key === 'Escape') { e.stopPropagation(); _closePopup(); }
    });

    setTimeout(() => {
      const outside = ev => {
        if (!pop.contains(ev.target) && ev.target !== anchor) {
          _closePopup();
          document.removeEventListener('click', outside, true);
        }
      };
      document.addEventListener('click', outside, true);
    }, 80);
  }

  function _escH(str) { return String(str||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _closePopup() { 
      if (_popup) {
          // Bỏ focus trước khi xoá DOM để tránh trình duyệt (đặc biệt là Safari/Chrome di động) tự nhảy trang lên top
          const docActive = document.activeElement;
          if (docActive && _popup.contains(docActive)) {
              docActive.blur();
          }
          _popup.remove(); 
          _popup = null; 
      }
  }

  /* ─── Save / Delete ────────────────────────────────────── */
  async function _saveAnnotation(measureIdx, noteIdx, text, color = 'yellow', icon = '') {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    _notes[`${measureIdx}_${noteIdx}`] = { measureIdx, noteIdx, text, color, icon };
    await _syncServer();
  }

  async function _deleteAnnotation(measureIdx, noteIdx) {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    delete _notes[`${measureIdx}_${noteIdx}`];
    await _syncServer();
  }

  async function _syncServer() {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    
    const arr = Object.values(_notes);
    try {
      await window.ApiService?.annotations?.save?.(songId, arr);
      window.App?.showToast?.(`Đã lưu ghi chú`, 'success');
    } catch(e) {
      console.warn('Save annotation error:', e);
      window.App?.showToast?.('Lỗi lưu ghi chú', 'error');
    }
    _build();
  }

  return { init, onOSMDRendered, reposition, loadSong, clearSong, setAddMode, toggleAddMode };
})();

window.AnnotationCanvas = AnnotationCanvas;
