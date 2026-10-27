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

  let _initOptions = {}, _renderCount = 0, _lastContainerWidth = 0, _lastViewportWidth = 0;
  const OSMD_LOCAL_SRC = 'assets/js/vendor/opensheetmusicdisplay.min.js';
  const OSMD_CDN_SRC = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';

  function _canRender() {
    return window.OSMDRenderCore ? window.OSMDRenderCore.canRender(containerId) : false;
  }

  function _createInstanceSync() {
    if (osmd) return osmd;
    if (!containerId || typeof opensheetmusicdisplay === 'undefined' || !opensheetmusicdisplay.OpenSheetMusicDisplay) return null;
    const container = document.getElementById(containerId);
    if (!container) return null;
    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: false, backend: 'svg', drawTitle: true, drawSubtitle: true, drawComposer: true, drawCredits: true, coloringEnabled: true, pageFormat: 'Endless',
      engravingRules: {
        ChordSymbolFontFamily: "OSMDChordFont, sans-serif", ChordSymbolTextHeight: 2.6, ChordSymbolYOffset: 1.2, DefaultColorChordSymbol: '#dc2626',
        StaffLineWidth: 0.1, StemWidth: 0.15, TupletNumberTextHeight: 1.5, TitleTopDistance: 1.5, SheetTitleHeight: 2.0, SheetComposerHeight: 1.5, SheetAuthorHeight: 1.5
      },
      ..._initOptions
    });
    if (osmd.rules) { refreshRules(); osmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif"; }
    return osmd;
  }

  async function _ensureInstance() {
    if (osmd) return osmd;
    if ((typeof opensheetmusicdisplay === 'undefined' || !opensheetmusicdisplay.OpenSheetMusicDisplay) && window.ScriptLoader?.loadWithFallback) {
      await window.ScriptLoader.loadWithFallback(OSMD_LOCAL_SRC, OSMD_CDN_SRC);
    }
    const inst = _createInstanceSync();
    if (!inst) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    return inst;
  }
  /**
   * Khởi tạo OSMD vào một container DOM.
   */
  function init(id, options = {}) {
    containerId = id;
    const container = document.getElementById(id);
    if (!container) throw new Error(`Container #${id} không tồn tại`);

    _initOptions = options; osmd = null; isLoaded = false;
    // Resize observer để auto-reflow khi container thay đổi kích thước qua OSMDRenderCore
    _lastContainerWidth = container.clientWidth; _lastViewportWidth = window.innerWidth;
    const onResize = () => {
      if (!osmd) return;
      const pending = window.OSMDRenderCore.hasPendingRender();
      if (!isLoaded && !pending) return;
      const currentWidth = container.clientWidth, vpWidth = window.innerWidth;
      if (!pending && Math.abs(currentWidth - _lastContainerWidth) < 8 && Math.abs(vpWidth - _lastViewportWidth) < 8) return;
      window.OSMDRenderCore.scheduleResize(containerId, async () => {
        if (!osmd || window.ChordCanvas?.isPopupOpen?.()) return;
        _lastContainerWidth = container.clientWidth; _lastViewportWidth = window.innerWidth;
        const svg = container.querySelector('svg'); if (svg) svg.style.maxWidth = '';
        _renderCount++;
        await osmd.render();
        _forceLayoutRecalc();
        _titleCompacted = false; _compactTitleSVG();
        if (window.ChordCanvas) window.ChordCanvas.reposition();
        if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
        if (!isLoaded) {
          isLoaded = true;
          _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
        }
      }, window.OSMDRenderCore.RESIZE_DEBOUNCE_MS);
    };
    new ResizeObserver(onResize).observe(container);
    window.addEventListener('resize', onResize, { passive: true });

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

    container.addEventListener('touchcancel', () => {
      isPinching = false; initTouchDist = 0; currentScaleRatio = 1;
      const svg = container.querySelector('svg');
      if (svg) svg.style.transform = '';
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
                          // Kết thúc nhóm (cluster) cũ, áp dụng cao độ lớn nhất cho nốt chính
                          if (currentPrimaryNote && maxPitchNode) {
                              const pPitch = currentPrimaryNote.querySelector("pitch");
                              if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) {
                                  pPitch.innerHTML = maxPitchNode.innerHTML;
                              }
                          }
                          // Bắt đầu nhóm mới với nốt không có chord
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
    if (!containerId) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    await _ensureInstance();
    currentXmlString = xmlString; // Luôn giữ bản gốc
    isLoaded = false;

    const token = window.OSMDRenderCore.nextToken();
    try {
      const processedXml = preprocessXML(xmlString);
      await osmd.load(processedXml);
      if (token !== window.OSMDRenderCore.getToken()) return osmd;
      osmd.zoom = currentZoom;
      _applyCompactMode();
      if (transposeValue !== 0 && osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
        osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
        osmd.Sheet.Transpose = transposeValue;
        osmd.updateGraphic?.();
      }
      refreshRules();
      const res = await window.OSMDRenderCore.enqueueRender(containerId, async () => {
        _renderCount++;
        await osmd.render();
      }, { token, rethrow: true });
      if (!res.rendered || token !== window.OSMDRenderCore.getToken()) return osmd;
      _forceLayoutRecalc();
      const cEl = document.getElementById(containerId); if (cEl) { _lastContainerWidth = cEl.clientWidth; _lastViewportWidth = window.innerWidth; }
      _titleCompacted = false; _compactTitleSVG();
      isLoaded = true;
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
      return osmd;
    } catch (err) {
      if (token !== window.OSMDRenderCore.getToken()) return osmd;
      console.error('[OSMD] Lỗi khi load:', err);
      window.OSMDRenderCore.reportRenderError(err);
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
    if (xmlString) currentXmlString = xmlString;
    const token = window.OSMDRenderCore.nextToken();
    try {
      const processedXml = preprocessXML(currentXmlString);
      await osmd.load(processedXml);
      if (token !== window.OSMDRenderCore.getToken()) return osmd;
      osmd.zoom = currentZoom;
      if (window.InstrumentMixer?.restoreState) window.InstrumentMixer.restoreState();
      _applyCompactMode();

      if (osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
          osmd.updateGraphic?.();
      }

      refreshRules();
      _forceLayoutRecalc();
      const res = await window.OSMDRenderCore.enqueueRender(containerId, async () => {
        _renderCount++;
        await osmd.render();
      }, { token, rethrow: true });
      if (!res.rendered || token !== window.OSMDRenderCore.getToken()) return osmd;
      _forceLayoutRecalc();
      const cEl = document.getElementById(containerId); if (cEl) { _lastContainerWidth = cEl.clientWidth; _lastViewportWidth = window.innerWidth; }
      _titleCompacted = false;
      _compactTitleSVG();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} }); // Gọi lại để ChordCanvas rebuild
      return osmd;
    } catch (err) {
      if (token !== window.OSMDRenderCore.getToken()) return osmd;
      console.error('[OSMD] Lỗi reload:', err);
      window.OSMDRenderCore.reportRenderError(err);
      throw err;
    }
  }

  /**
   * Thay đổi mức zoom — nhận decimal (0.1 → 2.5), App.setZoom đã convert từ percent
   */
  async function setZoom(level) {
    currentZoom = Math.max(0.1, Math.min(2.5, level));
    if (osmd && (isLoaded || window.OSMDRenderCore.hasPendingRender())) {
      osmd.zoom = currentZoom;
      const token = window.OSMDRenderCore.nextToken();
      refreshRules();
      _forceLayoutRecalc();
      const res = await window.OSMDRenderCore.enqueueRender(containerId, async () => {
        _renderCount++;
        await osmd.render();
      }, { token });
      if (!res.rendered || token !== window.OSMDRenderCore.getToken()) return;
      _forceLayoutRecalc();
      const cEl = document.getElementById(containerId); if (cEl) { _lastContainerWidth = cEl.clientWidth; _lastViewportWidth = window.innerWidth; }
      _titleCompacted = false; _compactTitleSVG();
      if (window.ChordCanvas) window.ChordCanvas.reposition();
      if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
    }
  }

  async function renderPending() {
    if (!window.OSMDRenderCore.hasPendingRender() || !_canRender() || !osmd) return false;
    const token = window.OSMDRenderCore.nextToken();
    const res = await window.OSMDRenderCore.enqueueRender(containerId, async () => {
      _renderCount++;
      await osmd.render();
    }, { token });
    if (!res.rendered) return false;
    _forceLayoutRecalc();
    _titleCompacted = false; _compactTitleSVG();
    if (window.ChordCanvas) window.ChordCanvas.reposition();
    if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
    if (!isLoaded) {
      isLoaded = true;
      _onReadyCallbacks.forEach(cb => { try { cb(osmd); } catch(e) {} });
    }
    return true;
  }

  /** Set zoom level mà không trigger render (dùng trước load()) */
  function setZoomSilent(level) {
    currentZoom = Math.max(0.5, Math.min(2.5, level));
    if (osmd) osmd.zoom = currentZoom;
  }


  function getCurrentZoom() { return currentZoom; }

  /**
   * Trả về instance OSMD để truy cập trực tiếp API nếu cần.
   */
  function getInstance() { return osmd || _createInstanceSync(); }

  function getIsLoaded() { return isLoaded; }

  function getCurrentXml() { return currentXmlString; }

  /** Thêm callback khi OSMD render xong — hỗ trợ nhiều caller */
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

  /**
   * Tinh chỉnh title SVG sau render — ẩn title bị duplicate, style đẹp hơn.
   * XML Finale xuất ra: <movement-title> + <credit-words> cùng nội dung → OSMD vẽ chồng.
   */
  // Cùng mẫu với assets/js/osmd-svg-text.js (bản mới)
  const CHORD_TEXT_REGEX = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\/[A-G][b#]?)?$/;

  function _compactTitleSVG() {
    if (_titleCompacted) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Lấy tất cả text elements, bỏ chord symbols (hợp âm đầu bài có thể to bằng tiêu đề → bị tô nhầm màu tiêu đề)
    const texts = Array.from(svg.querySelectorAll('text')).filter(t => {
      const ff = t.getAttribute('font-family') || '';
      return !ff.includes('OSMDChordFont') && !CHORD_TEXT_REGEX.test(t.textContent.trim());
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

  function setCompactMode(val) { _isCompactMode = !!val; if (isLoaded && osmd && currentXmlString) reload(currentXmlString); }
  function getCompactMode() { return _isCompactMode; }

  /** Ẩn/hiện chữ Điệp Khúc, Coda, D.C., Fine... trong SVG khi compact mode bật. */
  function _hideRepeatLabels(hide) {
    const svg = document.getElementById(containerId)?.querySelector('svg');
    if (!svg) return;
    const REPEAT_PATTERN = /^(đi[eệ]p\s*kh[úu]c|coda|d\.?c\.?|da\s*capo|fine|segno|d\.?s\.?|chorus|refrain)/i;
    svg.querySelectorAll('text').forEach(t => { if (REPEAT_PATTERN.test(t.textContent.trim())) t.style.display = hide ? 'none' : ''; });
  }

  function _applyCompactMode() {
    if (!osmd || !osmd.Sheet) return;
    let compactPrefs = { hideBass: true, hideVoices: true, hideText: true };
    if (window.DisplaySettings) compactPrefs = DisplaySettings.getCompactPrefs();
    if (!_isCompactMode) { osmd.setOptions({ drawComposer: true, drawCredits: true, drawSubtitle: true, drawLyricist: true }); return; }
    osmd.Sheet.Instruments.forEach((ins, insIndex) => {
      if (!ins.Staves) return;
      if (compactPrefs.hideBass) {
        if (ins.Staves.length >= 2) for (let i = 1; i < ins.Staves.length; i++) ins.Staves[i].Visible = false;
        if (insIndex > 0) { ins.Visible = false; ins.Staves.forEach(st => st.Visible = false); }
      }
      if (compactPrefs.hideVoices && insIndex === 0 && ins.Voices) {
        ins.Voices.forEach(voice => { if (voice.VoiceId > 1) voice.Visible = false; });
      }
    });
    const showTxt = !compactPrefs.hideText;
    osmd.setOptions({ drawComposer: showTxt, drawCredits: showTxt, drawSubtitle: showTxt, drawLyricist: showTxt, drawTitle: !compactPrefs.hideTitle });
    setTimeout(() => _hideRepeatLabels(_isCompactMode), 400);
  }

  return { init, load, reload, setZoom, setZoomSilent, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode, refreshRules, getRenderToken: () => window.OSMDRenderCore.getToken(), getRenderCount: () => _renderCount, resetRenderCount: () => { _renderCount = 0; }, canRender: _canRender, renderPending, hasPendingRender: () => window.OSMDRenderCore.hasPendingRender() };
})();

window.OSMDRenderer = OSMDRenderer;
