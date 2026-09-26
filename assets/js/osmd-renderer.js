/**
 * osmd-renderer.js
 * Wrapper module cho OpenSheetMusicDisplay (OSMD).
 * Quản lý lifecycle: init → load → render → zoom → transpose.
 */
const OSMDRenderer = (() => {
  'use strict';

  let osmd = null;
  let containerId = null;
  let currentXmlString = null;
  let currentZoom = 1.0;
  // NOTE: currentTranspose không lưu ở đây — dùng Store.get('currentTranspose')
  let isLoaded = false;
  let _onReadyCallbacks = []; // BUG-C fix: array thay vì single callback
  let _isCompactMode = false;
  let _titleCompacted = false; // flag tránh compact title nhiều lần
  let _renderToken = 0; // Race-condition guard: ngăn các lần load/render cũ đè lên bài mới

  /**
   * Khởi tạo OSMD vào một container DOM.
   */
  function init(id, options = {}) {
    containerId = id;
    const container = document.getElementById(id);
    if (!container) throw new Error(`Container #${id} không tồn tại`);

    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true,
      coloringEnabled: true,
      pageFormat: 'Endless',  // Scroll vertically, no page breaks
      engravingRules: {
        // Chord symbols — size to hơn, cao hơn
        ChordSymbolFontFamily: "OSMDChordFont, sans-serif",
        ChordSymbolTextHeight: 2.6,
        ChordSymbolYOffset: 1.2,
        DefaultColorChordSymbol: '#dc2626',
        // Sheet layout
        StaffLineWidth: 0.1,
        StemWidth: 0.15,
        TupletNumberTextHeight: 1.5,
        // Title tự điều chỉnh đẹp hơn
        TitleTopDistance: 1.5,        // Giảm khoảng trống phía trên
        SheetTitleHeight: 2.0,        // Cỡ chữ title vừa phải (OSMD default ~4.0)
        SheetComposerHeight: 1.5,     // Nhạc sĩ nhỏ gọn hơn
        SheetAuthorHeight: 1.5,
      },
      ...options
    });

    // Force specific rules onto the rules object as some versions ignore constructor config
    if (osmd.rules) {
        refreshRules();
        osmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif";
    }

    // Resize observer để auto-reflow khi container thay đổi kích thước
    let lastWidth = container.clientWidth;
    const resizeObserver = new ResizeObserver(_debounce(async () => {
      if (isLoaded) {
          const currentWidth = container.clientWidth;
          // iPad/iPhone address bar co giãn thay đổi height nhưng giữ nguyên width.
          // Chỉ kích hoạt render lại khi chiều rộng thực tế thay đổi > 8px (tránh giật lag khi cuộn).
          if (currentWidth > 0 && Math.abs(currentWidth - lastWidth) < 8) {
              return;
          }
          lastWidth = currentWidth;

          if (window.ChordCanvas?.isPopupOpen?.()) return; // KHÔNG re-render nếu đang nhập popup hợp âm (tránh mất focus)
          await osmd.render();
          _titleCompacted = false; // reset để compact lại sau resize
          _compactTitleSVG();
          _tagChordSymbols();
          if (window.ChordCanvas) window.ChordCanvas.reposition();
          if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
      }
    }, 400));
    resizeObserver.observe(container);

    // Pinch-to-Zoom (Multi-touch) using GPU scale transform for buttery 60fps feeling on iPad/Mobile
    let initTouchDist = 0;
    let initZoom = 1.0;
    let isPinching = false;
    let currentScaleRatio = 1.0;

    container.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && isLoaded) {
        isPinching = true;
        initTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initZoom = currentZoom;
        currentScaleRatio = 1.0;
        
        const svg = container.querySelector('svg');
        if (svg) {
          svg.style.transition = 'none';
          svg.style.transformOrigin = 'top center';
        }
      }
    }, { passive: true });

    container.addEventListener('touchmove', e => {
      if (isPinching && e.touches.length === 2 && isLoaded) {
        e.preventDefault(); // prevent native browser zoom
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initTouchDist > 0) {
          currentScaleRatio = dist / initTouchDist;
          const svg = container.querySelector('svg');
          if (svg) {
            svg.style.transform = `scale(${currentScaleRatio})`;
          }
        }
      }
    }, { passive: false });

    container.addEventListener('touchend', async e => {
      if (isPinching) {
        isPinching = false;
        const svg = container.querySelector('svg');
        if (svg) {
          svg.style.transform = '';
        }
        
        // Calculate the final target zoom level (Snap to 5% steps)
        const finalZoomPercent = Math.round(Math.max(0.3, Math.min(2.5, initZoom * currentScaleRatio)) * 20) * 5;
        
        if (window.App?.setZoom) {
          await App.setZoom(finalZoomPercent);
        }
      }
    });

    return osmd;
  }

  /**
   * Buộc container tính lại chiều rộng thực trước khi render
   * (fix SVG tràn phải sau khi chord canvas thêm elements)
   */
  function _forceLayoutRecalc() {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Đọc clientWidth để buộc browser flush layout
    const w = container.clientWidth;
    // Đảm bảo SVG không rộng hơn container
    const svg = container.querySelector('svg');
    if (svg && w > 0) {
      svg.style.maxWidth = w + 'px';
      svg.style.width    = '100%';
    }
    // Xóa overflow ẩn sau khi render (chỉ để clip trong quá trình render)
    return w;
  }

  /**
   * Cập nhật lại Engraving Rules trước khi render
   */
  function refreshRules() {
    if (osmd && osmd.rules) {
        let prefs = { size: 2.6, yOffset: 1.2, color: '#dc2626' }; // chuẩn hiện tại
        if (window.DisplaySettings) prefs = DisplaySettings.getChordPrefs();

        osmd.rules.DefaultColorChordSymbol = prefs.color;
        osmd.rules.ChordSymbolTextHeight   = prefs.size   ?? 2.6;
        osmd.rules.ChordSymbolYOffset      = prefs.yOffset ?? 1.2;
        
        // --- ÉP KHOẢNG CÁCH HỢP ÂM CỐ ĐỊNH, KHÔNG BỊ ĐẨY LÊN CAO ---
        osmd.rules.ChordSymbolYPadding = 0.0;
        osmd.rules.ChordSymbolYSpacing = 0.0;
        osmd.rules.ChordOverlapAllowedIntoNextMeasure = true;

        // Title sizing — đặt lại mỗi lần refresh
        if (osmd.rules.SheetTitleHeight !== undefined)   osmd.rules.SheetTitleHeight   = 2.0;
        if (osmd.rules.SheetComposerHeight !== undefined) osmd.rules.SheetComposerHeight = 1.5;
        if (osmd.rules.SheetAuthorHeight !== undefined)   osmd.rules.SheetAuthorHeight   = 1.5;
        if (osmd.rules.TitleTopDistance !== undefined)    osmd.rules.TitleTopDistance    = 1.5;
    }
  }

  /**
   * Cắt tỉa XML gốc ngay từ trong trứng nước (Xoá thẻ DOM) để dẹp sạch nốt bè/chùm
   */
  function preprocessXML(xml) {
      if (!window.DisplaySettings || !_isCompactMode) return xml;
      const prefs = DisplaySettings.getCompactPrefs();
      if (!prefs.hideVoices && !prefs.hideChordNotes) return xml;

      try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "application/xml");

          if (prefs.hideVoices) {
              const voices = doc.querySelectorAll("note voice");
              voices.forEach(v => {
                  if (parseInt(v.textContent) > 1) {
                      v.parentNode.remove();
                  }
              });

              // Sau khi xóa notes voice>1, slur/tie có thể mất pair → xóa luôn trong compact mode
              doc.querySelectorAll("notations slur").forEach(el => el.remove());
              doc.querySelectorAll("notations tied").forEach(el => el.remove());
              doc.querySelectorAll("note > tie").forEach(el => el.remove());
          }

          if (prefs.hideChordNotes) {
              const measures = doc.querySelectorAll("measure");
              measures.forEach(measure => {
                  const notes = measure.querySelectorAll("note");
                  let currentPrimaryNote = null;
                  let maxPitchVal = -1;
                  let maxPitchNode = null;

                  notes.forEach(note => {
                      if (note.querySelector("rest")) return;

                      const pitchNode = note.querySelector("pitch");
                      if (!pitchNode) return;

                      const step = pitchNode.querySelector("step")?.textContent;
                      const alterNode = pitchNode.querySelector("alter");
                      const alter = alterNode ? parseInt(alterNode.textContent) : 0;
                      const octave = parseInt(pitchNode.querySelector("octave")?.textContent || "0");
                      
                      const stepVals = { 'C':0, 'D':2, 'E':4, 'F':5, 'G':7, 'A':9, 'B':11 };
                      const pitchVal = octave * 12 + (stepVals[step] || 0) + alter;

                      if (note.querySelector("chord")) {
                          if (currentPrimaryNote) {
                              if (pitchVal > maxPitchVal) {
                                  maxPitchVal = pitchVal;
                                  maxPitchNode = pitchNode.cloneNode(true);
                              }
                              note.parentNode.removeChild(note);
                          }
                      } else {
                          if (currentPrimaryNote && maxPitchNode) {
                              const pPitch = currentPrimaryNote.querySelector("pitch");
                              if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) pPitch.innerHTML = maxPitchNode.innerHTML;
                          }
                          currentPrimaryNote = note;
                          maxPitchVal = pitchVal;
                          maxPitchNode = pitchNode.cloneNode(true);
                      }
                  });
                  
                  // Xử lý nốt cuối cùng trong ô nhịp
                  if (currentPrimaryNote && maxPitchNode) {
                      const pPitch = currentPrimaryNote.querySelector("pitch");
                      if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) {
                          pPitch.innerHTML = maxPitchNode.innerHTML;
                      }
                  }
              });
          }

          const serializer = new XMLSerializer();
          return serializer.serializeToString(doc);
      } catch (err) {
          console.error("XML Preprocess error:", err);
          return xml;
      }
  }

  /**
   * Nạp XML string vào OSMD và render.
   * @param {string} xmlString - Nội dung MusicXML
   * @param {number} transposeValue - Số nửa cung để dịch (Mặc định: 0)
   */
  async function load(xmlString, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    const token = ++_renderToken;
    currentXmlString = xmlString; // Luôn giữ bản gốc
    isLoaded = false;

    try {
      const processedXml = preprocessXML(xmlString);
      await osmd.load(processedXml);
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần load mới hơn

      osmd.zoom = currentZoom;
      _applyCompactMode();
      
      if (osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
          osmd.updateGraphic();
      }

      refreshRules();
      _forceLayoutRecalc();
      await osmd.render();
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần render mới hơn

      _forceLayoutRecalc(); // lần 2: sau render để clip SVG nếu vẫn rộng
      _titleCompacted = false;
      _compactTitleSVG();
      _tagChordSymbols();
      isLoaded = true;
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== _renderToken) return osmd;
      console.error('[OSMD] Lỗi khi load:', err);
      throw err;
    }
  }

  /**
   * Reload lại OSMD với XML đã sửa (transpose, chord override, v.v.)
   * @param {string} xmlString - Nội dung XML đã được xử lý
   * @param {number} transposeValue - Số nửa cung để dịch
   */
  async function reload(xmlString, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa init');
    const token = ++_renderToken;
    if (xmlString) currentXmlString = xmlString;
    try {
      const processedXml = preprocessXML(currentXmlString);
      await osmd.load(processedXml);
      if (token !== _renderToken) return osmd; // Bị hủy bởi lần reload mới hơn

      osmd.zoom = currentZoom;
      if (window.InstrumentMixer?.restoreState) window.InstrumentMixer.restoreState();
      _applyCompactMode();

      if (osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
          osmd.updateGraphic();
      }

      refreshRules();
      _forceLayoutRecalc();
      await osmd.render();
      if (token !== _renderToken) return osmd;

      _forceLayoutRecalc();
      _titleCompacted = false;
      _compactTitleSVG();
      _tagChordSymbols();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== _renderToken) return osmd;
      console.error('[OSMD] Lỗi reload:', err);
      throw err;
    }
  }

  /**
   * Thay đổi mức zoom — nhận decimal (0.1 → 2.5), App.setZoom đã convert từ percent
   */
  async function setZoom(level) {
    // level là decimal: 0.1 = 10%, 1.0 = 100%, 2.0 = 200%
    currentZoom = Math.max(0.1, Math.min(2.5, level));
    if (osmd && isLoaded) {
      osmd.zoom = currentZoom;
      _forceLayoutRecalc();
      await osmd.render();
      _forceLayoutRecalc();
      _tagChordSymbols();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
    }
  }

  /** Set zoom level mà không trigger render (dùng trước load()) */
  function setZoomSilent(level) {
    currentZoom = Math.max(0.5, Math.min(2.5, level));
    if (osmd) osmd.zoom = currentZoom;
  }


  function getCurrentZoom() { return currentZoom; }
  function getInstance() { return osmd; }
  function getIsLoaded() { return isLoaded; }
  function getCurrentXml() { return currentXmlString; }
  function onReady(cb) { _onReadyCallbacks.push(cb); }
  function destroy() {
    if (osmd) {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    }
    osmd = null;
    isLoaded = false;
    currentXmlString = null;
  }
  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /**
   * Tinh chỉnh title SVG sau render — ẩn title bị duplicate, style đẹp hơn.
   * XML Finale xuất ra: <movement-title> + <credit-words> cùng nội dung → OSMD vẽ chồng.
   */
  function _compactTitleSVG() {
    if (_titleCompacted) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Lấy tất cả text elements, bỏ chord symbols
    const texts = Array.from(svg.querySelectorAll('text')).filter(t => {
      const ff = t.getAttribute('font-family') || '';
      return !ff.includes('OSMDChordFont');
    });
    if (!texts.length) { _titleCompacted = true; return; }

    // --- Tìm title text (lớn nhất) ---
    let maxSize = 0;
    let titleEl = null;
    texts.forEach(t => {
      const fs = parseFloat(t.getAttribute('font-size') || '0');
      if (fs > maxSize) { maxSize = fs; titleEl = t; }
    });

    if (titleEl) {
      // 1. Style title đẹp hơn
      titleEl.setAttribute('class', (titleEl.getAttribute('class') || '') + ' osmd-title-text');

      // 2. Convert ALL CAPS → Title Case cho dễ đọc
      const tspan = titleEl.querySelector('tspan');
      if (tspan) {
        const raw = tspan.textContent.trim();
        if (raw === raw.toUpperCase() && raw.length > 2 && !/^\d+$/.test(raw)) {
          tspan.textContent = raw.split(' ').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');
        }
      }

      // 3. Tìm và ẩn các text TRÙNG NỘI DUNG với title (duplicate từ movement-title + credit)
      const titleContent = (titleEl.querySelector('tspan') || titleEl).textContent.trim().toLowerCase();
      texts.forEach(t => {
        if (t === titleEl) return;
        const content = t.textContent.trim().toLowerCase();
        const fs = parseFloat(t.getAttribute('font-size') || '0');
        // Ẩn nếu trùng nội dung & nhỏ hơn title
        if (content === titleContent && fs < maxSize) {
          t.style.display = 'none';
        }
      });
    }

    // 4. Ẩn các rect nhỏ trong header (nếu OSMD vẽ enclosure/box xung quanh credit)
    const svgY = parseFloat(svg.getAttribute('viewBox')?.split(' ')[1] || '0');
    svg.querySelectorAll('rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height') || '999');
      const fill   = rect.getAttribute('fill') || '';
      const stroke = rect.getAttribute('stroke') || '';
      // Rect nhỏ (< 40px) có stroke = enclosure box xấu → ẩn
      if (height < 40 && stroke && stroke !== 'none' && fill === 'none') {
        rect.style.display = 'none';
      }
    });

    _titleCompacted = true;
  }

  function _tagChordSymbols() {
    try {
      // 1. Gắn qua OSMD graphical model nếu có node
      osmd?.graphic?.measureList?.forEach(sys => sys?.forEach(m => m?.staffEntries?.forEach(se => {
        const containers = se?.graphicalChordContainers || se?.chordSymbolContainers || [];
        containers.forEach(gcc => {
          const node = gcc?.graphicalLabel?.SVGNode || gcc?.graphicalLabel?.svgElement || gcc?.graphicalLabel?.textElement;
          if (node) {
            node.classList.add('osmd-chord-symbol');
            node.setAttribute('data-chord-symbol', 'true');
            node.querySelectorAll?.('text, tspan')?.forEach(t => {
              t.classList.add('osmd-chord-text');
              t.setAttribute('data-chord-text', 'true');
            });
          }
        });
      })));

      // 2. Quét DOM SVG để gắn chắc chắn 100% bằng cách đối chiếu
      const container = document.getElementById(containerId);
      if (!container) return;
      const svg = container.querySelector('svg');
      if (!svg) return;

      const xmlChordMap = (typeof ChordCanvasXML !== 'undefined' && ChordCanvasXML.readXmlChords)
        ? ChordCanvasXML.readXmlChords()
        : {};
      const chordSet = new Set(Object.values(xmlChordMap).map(c => String(c).trim()));

      const CHORD_REGEX = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\/[A-G][b#]?)?$/;

      const texts = Array.from(svg.querySelectorAll('text'));
      texts.forEach(t => {
        if (t.classList.contains('osmd-title-text')) return;
        if (t.parentElement && t.parentElement.classList.contains('vf-lyric')) return;

        const txt = t.textContent.trim();
        if (!txt) return;

        const ff = t.getAttribute('font-family') || '';
        const isChordFont = ff.includes('OSMDChordFont');
        const isKnownChord = chordSet.has(txt) || (CHORD_REGEX.test(txt) && !/^\d+$/.test(txt));

        if (isChordFont || isKnownChord) {
          t.classList.add('osmd-chord-symbol', 'osmd-chord-text');
          t.setAttribute('data-chord-symbol', 'true');
          t.setAttribute('data-chord-text', 'true');
          if (t.parentElement && t.parentElement.tagName.toLowerCase() === 'g') {
            t.parentElement.classList.add('osmd-chord-symbol');
            t.parentElement.setAttribute('data-chord-symbol', 'true');
          }
        }
      });
    } catch (e) {
      console.warn('[OSMD] Error tagging chord symbols:', e);
    }
  }

  function setCompactMode(val) {
    _isCompactMode = !!val;
    if (isLoaded && osmd && currentXmlString) reload(currentXmlString);
  }
  function getCompactMode() { return _isCompactMode; }

  /**
   * Ẩn/hiện chữ Điệp Khúc, Coda, D.C., Fine... trong SVG khi compact mode bật.
   * Các text này xuất phát từ <rehearsal> hoặc <direction><words> trong MusicXML.
   */
  function _hideRepeatLabels(hide) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const REPEAT_PATTERN = /^(đi[eệ]p\s*kh[úu]c|coda|d\.?c\.?|da\s*capo|fine|segno|d\.?s\.?|chorus|refrain)/i;

    svg.querySelectorAll('text').forEach(t => {
      const txt = t.textContent.trim();
      if (REPEAT_PATTERN.test(txt)) {
        t.style.display = hide ? 'none' : '';
      }
    });
  }

  function _applyCompactMode() {
    if (!osmd || !osmd.Sheet) return;
    let compactPrefs = { hideBass: true, hideVoices: true, hideText: true };
    if (window.DisplaySettings) compactPrefs = DisplaySettings.getCompactPrefs();
    if (!_isCompactMode) {
      osmd.setOptions({ drawComposer: true, drawCredits: true, drawSubtitle: true, drawLyricist: true });
      return;
    }
    osmd.Sheet.Instruments.forEach((ins, insIndex) => {
      if (ins.Staves) {
        if (compactPrefs.hideBass) {
          if (ins.Staves.length >= 2) {
            for (let i = 1; i < ins.Staves.length; i++) ins.Staves[i].Visible = false;
          }
          if (insIndex > 0) {
            ins.Visible = false;
            ins.Staves.forEach(st => st.Visible = false);
          }
        }
        if (compactPrefs.hideVoices && insIndex === 0 && ins.Voices) {
          ins.Voices.forEach(voice => { if (voice.VoiceId > 1) voice.Visible = false; });
        }
      }
    });

    const drawCredits = !compactPrefs.hideText;
    osmd.setOptions({
      drawComposer: drawCredits,
      drawCredits: drawCredits,
      drawSubtitle: drawCredits,
      drawLyricist: drawCredits,
      drawTitle: !compactPrefs.hideTitle,
      drawLyrics: !compactPrefs.hideLyrics,
      drawMeasureNumbers: !compactPrefs.hideMeasureNumbers
    });
    setTimeout(() => _hideRepeatLabels(_isCompactMode), 400);
  }

  return { init, load, reload, setZoom, setZoomSilent, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode, refreshRules, tagChordSymbols: _tagChordSymbols, getRenderToken: () => _renderToken };
})();

window.OSMDRenderer = OSMDRenderer;
