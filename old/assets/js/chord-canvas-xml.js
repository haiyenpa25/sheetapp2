/**
 * chord-canvas-xml.js — XML Manipulation cho Hợp âm
 * Xử lý việc chèn, xoá, đọc hợp âm trực tiếp vào MusicXML.
 */
const ChordCanvasXML = (() => {
  'use strict';

  /* ─── Read XML chords ─────────────────────────── */
  function readXmlChords() {
    const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
    if (!xml) return {};
    const doc   = new DOMParser().parseFromString(xml, 'text/xml');
    const parts = doc.querySelectorAll('part');
    if (!parts.length) return {};
    const map = {};
    parts[0].querySelectorAll('measure').forEach((m, mi) => {
      let ni = -1, pChord = null;
      for (const c of m.children) {
        if (c.tagName === 'harmony') {
          const step  = c.querySelector('root-step')?.textContent?.trim() || '';
          const alter = c.querySelector('root-alter')?.textContent?.trim();
          const kind  = c.querySelector('kind')?.getAttribute('text') || '';
          
          let chordStr = step + (alter === '1' ? '#' : alter === '-1' ? 'b' : '') + kind;
          
          // Phân tích nốt Bass (nếu có hợp âm đảo / Slash Chords: ví dụ C/E)
          const bassStep = c.querySelector('bass > bass-step')?.textContent?.trim();
          if (bassStep) {
            const bassAlter = c.querySelector('bass > bass-alter')?.textContent?.trim();
            const bAcc = bassAlter === '1' ? '#' : bassAlter === '-1' ? 'b' : '';
            chordStr += '/' + bassStep + bAcc;
          }
          
          pChord = chordStr;
        } else if (c.tagName === 'note') {
          if (!c.querySelector('chord') && !c.querySelector('grace')) ni++;
          if (pChord !== null && !c.querySelector('chord')) {
            map[`${mi}_${ni}`] = pChord; pChord = null;
          }
        }
      }
    });
    return map;
  }

  function buildAbsMap() {
    const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
    if (!xml) return {};
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const measures = doc.querySelectorAll('part')[0]?.querySelectorAll('measure');
    if (!measures?.length) return {};

    const map = {};
    let abs = 0;
    measures.forEach((m, mi) => {
      let ni = -1;
      for (const c of m.children) {
        if (c.tagName !== 'note') continue;
        if (c.querySelector('chord') || c.querySelector('grace')) continue;
        ni++;
        map[abs] = { mi, ni };
        abs++;
      }
    });
    return map;
  }

  /* ─── XML injection ──────────────────────── */
  async function injectXml(mIdx, nIdx, text) {
    const xml = window.App?.getOriginalXml?.();
    if (!xml) { window.App?.showToast?.('Chưa có XML để lưu', 'error'); return; }
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const h   = _buildHarmony(doc, text);
    if (!h) { window.App?.showToast?.('Hợp âm không đúng (VD: Am, D7, F#m)', 'error'); return; }
    
    const m = doc.querySelectorAll('part')[0]?.querySelectorAll('measure')[mIdx];
    if (!m) { window.App?.showToast?.('Không tìm thấy ô nhịp!', 'error'); return; }
    
    let idx = -1, target = null;
    for (const n of m.querySelectorAll('note')) {
      if (!n.querySelector('chord') && !n.querySelector('grace')) idx++;
      if (idx === nIdx) { target = n; break; }
    }
    
    if (target) { _delAdj(target); m.insertBefore(h, target); }
    else        { _delEnd(m);      m.appendChild(h); }
    
    await window.App.saveModifiedXML(new XMLSerializer().serializeToString(doc));
  }

  async function removeXml(mIdx, nIdx) {
    const xml = window.App?.getOriginalXml?.();
    if (!xml) return;
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const m   = doc.querySelectorAll('part')[0]?.querySelectorAll('measure')?.[mIdx];
    if (!m) return;
    
    let idx = -1, target = null;
    for (const n of m.querySelectorAll('note')) {
      if (!n.querySelector('chord') && !n.querySelector('grace')) idx++;
      if (idx === nIdx) { target = n; break; }
    }
    
    const d = target ? _delAdj(target) : _delEnd(m);
    if (d) await window.App.saveModifiedXML(new XMLSerializer().serializeToString(doc));
  }

  function _delAdj(noteEl) {
    let p = noteEl.previousElementSibling, d = false;
    while (p) {
      const c = p; p = p.previousElementSibling;
      if (c.tagName === 'harmony') { c.remove(); d = true; }
      else if (!['forward','backup','direction'].includes(c.tagName)) break;
    }
    return d;
  }

  function _delEnd(m) {
    let l = m.lastElementChild, d = false;
    while (l) {
      const c = l; l = l.previousElementSibling;
      if (c.tagName === 'harmony') { c.remove(); d = true; }
      else if (!['forward','backup','direction'].includes(c.tagName)) break;
    }
    return d;
  }

  function _buildHarmony(doc, text, isCustom = false) {
    // Regex: Root (A-G[#b]), Suffix (anything except /), optional Bass (/X)
    const m = text.match(/^([A-G][#b]?)([^/]*)(\/([A-G][#b]?))?$/i);
    if (!m) return null;
    
    const root = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const suf  = m[2];
    const bass = m[4] ? (m[4].charAt(0).toUpperCase() + m[4].slice(1)) : null;

    const h = doc.createElement('harmony');
    if (isCustom) h.setAttribute('color', window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626');
    
    
    const r = doc.createElement('root');
    const s = doc.createElement('root-step');
    s.textContent = root.replace(/[#b]/,'');
    r.appendChild(s);
    if (root.includes('#')) {
      const a = doc.createElement('root-alter'); a.textContent='1'; r.appendChild(a);
    } else if (root.includes('b')) {
      const a = doc.createElement('root-alter'); a.textContent='-1'; r.appendChild(a);
    }
    h.appendChild(r);

    const k = doc.createElement('kind');

    // ── Bảng ánh xạ suffix → MusicXML kind ──────────────────────────────
    // Bao gồm: cơ bản, jazz nâng cao, altered, dim/aug, sus, add
    // Thứ tự: dài trước ngắn để tránh false-match (vd: 'maj7' trước 'm', 'dim7' trước 'dim')
    const KIND_MAP = [
      // Major extensions
      ['maj13',        'major-13th'],
      ['maj11',        'major-11th'],
      ['maj9',         'major-ninth'],
      ['maj7#11',      'major-seventh'],   // OSMD không có kind riêng, fallback
      ['maj7',         'major-seventh'],
      ['M7',           'major-seventh'],
      ['M13',          'major-13th'],
      ['M9',           'major-ninth'],
      // Minor extensions
      ['m13',          'minor-13th'],
      ['m11',          'minor-11th'],
      ['m9',           'minor-ninth'],
      ['m7b5',         'half-diminished'],
      ['m7',           'minor-seventh'],
      ['min7',         'minor-seventh'],
      ['m6',           'minor-sixth'],
      ['min',          'minor'],
      ['m',            'minor'],
      // Dominant extensions (7th-based)
      ['13b9',         'dominant-13th'],
      ['13#9',         'dominant-13th'],
      ['13#11',        'dominant-13th'],
      ['13',           'dominant-13th'],
      ['11',           'dominant-11th'],
      ['9#11',         'dominant-ninth'],  // #11 = lydian dominant, fallback dominant-ninth
      ['9b5',          'dominant-ninth'],
      ['9#5',          'dominant-ninth'],
      ['9',            'dominant-ninth'],
      ['7b13',         'dominant'],
      ['7#11',         'dominant'],
      ['7#9',          'dominant'],
      ['7b9',          'dominant'],
      ['7#5',          'augmented-seventh'],
      ['7b5',          'dominant'],
      ['7alt',         'dominant'],
      ['7sus4',        'suspended-fourth'],
      ['7sus2',        'suspended-second'],
      ['7',            'dominant'],
      // Diminished / Augmented
      ['dim7',         'diminished-seventh'],
      ['dim',          'diminished'],
      ['aug7',         'augmented-seventh'],
      ['augmaj7',      'major-seventh'],   // fallback
      ['aug',          'augmented'],
      ['+',            'augmented'],
      // Suspended / Add
      ['sus4',         'suspended-fourth'],
      ['sus2',         'suspended-second'],
      ['add11',        'major'],
      ['add9',         'major'],
      ['add2',         'major'],
      // Power / Special
      ['5',            'power'],
      ['6/9',          'major-sixth'],
      ['6',            'major-sixth'],
      ['2',            'major'],           // major add9 shorthand
      // Major / fallback
      ['M',            'major'],
      ['maj',          'major'],
    ];

    // Tìm kind phù hợp nhất (so sánh case-sensitive trước, insensitive fallback)
    let kindText = 'major';
    const sufLower = suf.toLowerCase();
    for (const [pattern, kind] of KIND_MAP) {
      if (suf === pattern || sufLower === pattern.toLowerCase()) {
        kindText = kind;
        break;
      }
    }

    k.textContent = kindText;
    // Luôn lưu suffix gốc vào attribute text để round-trip đọc lại đúng
    if (suf) k.setAttribute('text', suf);
    h.appendChild(k);

    if (bass) {
      const b = doc.createElement('bass');
      const bs = doc.createElement('bass-step');
      bs.textContent = bass.replace(/[#b]/,'');
      b.appendChild(bs);
      if (bass.includes('#')) {
        const ba = doc.createElement('bass-alter'); ba.textContent='1'; b.appendChild(ba);
      } else if (bass.includes('b')) {
        const ba = doc.createElement('bass-alter'); ba.textContent='-1'; b.appendChild(ba);
      }
      h.appendChild(b);
    }

    return h;
  }

  /* ─── XML Memory Manipulation ──────────────────────── */
  function cloneAndInjectChords(xmlStr, customChordsMap) {
    if (!xmlStr) return xmlStr;
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    
    // Xóa tất cả các thẻ <harmony> (hợp âm cũ Mặc định) hiện có
    const harmonies = doc.querySelectorAll('harmony');
    harmonies.forEach(h => h.remove());

    // Xóa thêm các thẻ <words> và <credit-words> (Text Direction / Floating Text) có nội dung giống hợp âm
    // (Vì nhiều phần mềm xuất XML biến hợp âm thành text tĩnh, gây ra lỗi hiển thị kép)
    const words = doc.querySelectorAll('words, credit-words');
    const chordRegex = /^[A-G][#b]?(m|min|maj|M|dim|aug|sus|add)?\d*(\/[A-G][#b]?)?$/i;
    words.forEach(w => {
      if (chordRegex.test(w.textContent.trim())) {
        const parent = w.closest('direction') || w.closest('credit');
        if (parent) parent.remove();
        else w.remove();
      }
    });

    // Nếu không có customChordsMap hoặc Map trống, trả về XML trắng hợp âm
    if (!customChordsMap || Object.keys(customChordsMap).length === 0) {
       return new XMLSerializer().serializeToString(doc);
    }

    // Nạp hợp âm tuỳ chỉnh vào
    const parts = doc.querySelectorAll('part');
    if (parts.length > 0) {
      const measures = parts[0].querySelectorAll('measure');
      
      for (const [key, chordStr] of Object.entries(customChordsMap)) {
         if (!chordStr) continue;
         const [mIdx, nIdx] = key.split('_').map(Number);
         const m = measures[mIdx];
         if (!m) continue;
         
         const h = _buildHarmony(doc, chordStr, true);
         if (!h) continue;

         let idx = -1;
         let target = null;
         for (const n of m.querySelectorAll('note')) {
            if (!n.querySelector('chord') && !n.querySelector('grace')) idx++;
            if (idx === nIdx) { target = n; break; }
         }

         if (target) {
            _delAdj(target); // optional clean
            m.insertBefore(h, target);
         } else {
            _delEnd(m);
            m.appendChild(h);
         }
      }
    }

    return new XMLSerializer().serializeToString(doc);
  }

  return { readXmlChords, buildAbsMap, injectXml, removeXml, cloneAndInjectChords };
})();

window.ChordCanvasXML = ChordCanvasXML;
