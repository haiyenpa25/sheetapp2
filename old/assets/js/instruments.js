/**
 * instruments.js — System for Instrument/Part Mixer
 * Hỗ trợ Bật/Tắt các dải nhạc cụ (Parts) của dự án nhạc MusicXML
 */
const InstrumentMixer = (() => {
  'use strict';

  function init() {
    document.getElementById('btn-mixer')?.addEventListener('click', openMixer);
    document.getElementById('btn-close-mixer')?.addEventListener('click', closeMixer);
    document.getElementById('btn-mixer-apply')?.addEventListener('click', applyMixer);
    
    // Đóng popup khi click ra ngoài overlay
    const modal = document.getElementById('mixer-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMixer();
      });
    }
    console.log('[Mixer] init OK');
  }

  function openMixer() {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const insts = osmd?.sheet?.Instruments;
    if (!insts || insts.length === 0) {
      window.App?.showToast?.('Bài hát này không chia nhiều dải nhạc cụ', 'warning');
      return;
    }
    
    // Xây dựng giao diện List checkbox tĩnh
    const listEl = document.getElementById('mixer-instruments-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    insts.forEach((ins, i) => {
      // OSMD lưu tên nhạc cụ ở nameLabel hoặc Id
      const name = ins.nameLabel?.text || ins.IdString || `Nhạc cụ ${i + 1}`;
      
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:.85rem;padding:.5rem .75rem;background:#fff;border:1px solid var(--border);border-radius:6px;transition:all 0.2s;';
      div.onmouseover = () => { div.style.borderColor = 'var(--accent)'; };
      div.onmouseout = () => { div.style.borderColor = 'var(--border)'; };
      
      div.innerHTML = `
        <label class="toggle-switch">
          <input type="checkbox" value="${i}" ${ins.Visible ? 'checked' : ''}>
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </label>
        <div style="font-weight:600;font-size:.9rem;color:var(--text-primary); cursor:pointer;" onclick="this.previousElementSibling.click()">${name}</div>
      `;
      listEl.appendChild(div);
    });

    document.getElementById('mixer-modal')?.classList.remove('hidden');
  }

  function closeMixer() {
    document.getElementById('mixer-modal')?.classList.add('hidden');
  }

  async function applyMixer() {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const insts = osmd?.sheet?.Instruments;
    if (!insts) return;

    const listEl = document.getElementById('mixer-instruments-list');
    const inputs = listEl.querySelectorAll('input[type="checkbox"]');
    
    let changed = false;
    let anyChecked = false;
    inputs.forEach(inp => {
      const idx = parseInt(inp.value, 10);
      const isChecked = inp.checked;
      if (isChecked) anyChecked = true;
      if (insts[idx] && insts[idx].Visible !== isChecked) {
        insts[idx].Visible = isChecked;
        changed = true;
      }
    });

    if (!anyChecked) {
      window.App?.showToast?.('Phải bật ít nhất 1 nhạc cụ để trống!', 'error');
      // Revert if all are hidden? Just let the user fixing it.
      return;
    }

    closeMixer();

    if (changed) {
      window.App?.showLoading?.('Đang kết xuất trình bày nhạc cụ...');
      
      // Cho UI cập nhật thanh loading trước
      setTimeout(() => {
        try {
          osmd.render();
          if (window.ChordCanvas) {
            window.ChordCanvas.reposition();
          }
          window.App?.showToast?.('Đã thay đổi hiển thị nhạc cụ', 'success');
        } catch(e) {
          console.error('[Mixer] Render error:', e);
          window.App?.showToast?.('Lỗi khi vẽ lại nhạc cụ', 'error');
        } finally {
          window.App?.hideLoading?.();
        }
      }, 50);
    }
  }

  function toggleMixerBtn(enabled) {
    const btn = document.getElementById('btn-mixer');
    if (btn) btn.disabled = !enabled;
  }

  // Quản lý trạng thái Mute dải nhạc cụ (chống reset khi Dịch giọng)
  let _savedMixerState = null;

  function preserveState() {
     const osmd = window.OSMDRenderer?.getInstance?.();
     const insts = osmd?.sheet?.Instruments;
     if (!insts) return;
     _savedMixerState = insts.map(i => i.Visible);
  }

  function restoreState() {
     if (!_savedMixerState) return;
     const osmd = window.OSMDRenderer?.getInstance?.();
     const insts = osmd?.sheet?.Instruments;
     if (insts && insts.length === _savedMixerState.length) {
         insts.forEach((ins, idx) => { ins.Visible = _savedMixerState[idx]; });
     } else {
         _savedMixerState = null; // Số lượng kớp, xoá state
     }
  }

  function clearState() { _savedMixerState = null; }

  return { init, toggleMixerBtn, preserveState, restoreState, clearState };
})();

window.InstrumentMixer = InstrumentMixer;
