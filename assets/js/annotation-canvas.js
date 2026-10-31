/** Instrument-specific annotations, shared by Modern and Classic. */
const AnnotationCanvas = (() => {
  'use strict';
  const STORAGE_KEY = 'sheetapp_annotation_layers';
  const MY_INSTRUMENT_KEY = 'sheetapp_annotation_my_instrument';
  let initialized = false, songId = null, generation = 0, pending = null;
  let notes = [], instruments = [], revision = '', registryRevision = '';
  let loaded = false, loading = false, saving = false, error = '', editing = false;
  let instrumentId = 'general', relocating = null, selected = null, hasPreference = false;
  let renderTimer, observer, unplaced = [], fingerprint = '', fingerprintXml = null;
  let gestureStart = null, gestureMoved = false, bandNote = null, revealed = false;
  const admin = () => !!window.Auth?.isAdmin?.();
  // Thành viên (Ban Hát trở lên) được ghi chú; danh mục/màu nhạc cụ vẫn chỉ Admin.
  const member = () => admin() || !!window.Auth?.isBanhat?.();
  const me = () => String(window.Auth?.getUser?.() || '');
  const canEditNote = note => admin() || (member() && !!note?.author && note.author === me());
  const current = () => window.App?.getCurrentSongId?.() || window.Store?.get?.('currentSong')?.id;

  function init() {
    if (initialized) return;
    initialized = true;
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value !== null) {
        const parsed = JSON.parse(value);
        if (parsed === null || (Array.isArray(parsed) && parsed.every(id => typeof id === 'string'))) {
          selected = parsed; hasPreference = true;
        }
      }
    } catch (_) {}
    try { instrumentId = localStorage.getItem(MY_INSTRUMENT_KEY) || instrumentId; } catch (_) {}
    window.AnnotationPanel.init({ activate: () => { revealed = true; return ensureLoaded(); }, reload, filter, filterAll,
      edit: setAddMode, instrument: id => { instrumentId = id; try { localStorage.setItem(MY_INSTRUMENT_KEY, id); } catch (_) {} if (editing && selected !== null && !selected.includes(id)) { selected.push(id); remember(); } else updatePanel(); },
      openEditor, relocate: note => { relocating = note; setAddMode(true); },
      save, createInstrument, color: saveInstrumentColor, saveBand });
    bindInteractions(); observeSheet(); updatePanel();
  }
  function bindInteractions() {
    document.getElementById('btn-add-annotate-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-annotate')?.addEventListener('click', () => setAddMode(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.querySelector('.ano-editor[open]')) setAddMode(false);
    });
    document.addEventListener('pointermove', event => {
      if (gestureStart && Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y) > 8) gestureMoved = true;
    }, { passive: true });
    document.addEventListener('pointercancel', () => { gestureMoved = true; }, { passive: true });
    window.EventBus?.on?.('auth:changed', () => { if (!member()) setAddMode(false); updatePanel(); build(); });
    const modeObserver = new window.MutationObserver(() => {
      if (editing && document.querySelector('#btn-add-chord-mode.active,#btn-add-chord-mode-bar.active')) setAddMode(false);
    });
    ['btn-add-chord-mode', 'btn-add-chord-mode-bar'].forEach(id => {
      const button = document.getElementById(id);
      if (button) modeObserver.observe(button, { attributes: true, attributeFilter: ['class'] });
    });
  }
  function observeSheet() {
    const container = document.getElementById('osmd-container');
    if (container) {
      observer = new ResizeObserver(reposition); observer.observe(container);
      // Classic can finish its chord overlay after OSMD's ready callback.
      const chordObserver = new window.MutationObserver(records => {
        if (records.some(record => record.target.closest?.('.cc-note-dot,.cc-dot') ||
          Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node =>
            node.nodeType === 1 && (node.matches?.('.cc-note-dot,.cc-dot') || node.querySelector?.('.cc-note-dot,.cc-dot'))))) reposition();
      });
      chordObserver.observe(container, { childList: true, subtree: true });
    }
  }
  function updatePanel() {
    window.AnnotationPanel?.render({ songId, notes, instruments, selected, loading, loaded,
      saving, error, editing: editing && member(), admin: admin(), member: member(), canEditNote, bandNote,
      instrumentId, unplaced, relocating: !!relocating });
  }
  function accept(data) {
    if (!Array.isArray(data?.annotations) || typeof data.revision !== 'string') throw new Error('Không đọc được dữ liệu ghi chú. Hãy tải lại.');
    notes = data.annotations; revision = data.revision; bandNote = data.bandNote || null;
    instruments = data.instruments || instruments; registryRevision = data.registryRevision || registryRevision;
    if (!instruments.some(item => item.id === instrumentId)) instrumentId = instruments[0]?.id || 'general';
    window.EventBus?.emit?.('annotations:band-note', { songId, bandNote });
    loaded = true; error = ''; updatePanel();
  }
  async function ensureLoaded() {
    if (!songId) return;
    if (loaded) { build(); return; }
    if (pending) return pending;
    const token = generation, id = songId;
    loading = true; error = ''; updatePanel();
    const task = (async () => {
      try {
        const data = await window.ApiService.annotations.load(id);
        if (token !== generation || id !== current()) return;
        accept(data);
      } catch (e) { if (token === generation) error = e.message || 'Không tải được ghi chú.'; }
      finally {
        if (token === generation) { loading = false; pending = null; build(); }
      }
    })();
    pending = task;
    return task;
  }
  async function reload() {
    if (saving || !songId) return;
    ++generation; pending = null; loaded = false;
    window.ApiService.annotations.clearCache(songId);
    return ensureLoaded();
  }
  async function loadSong(id, force = false) {
    clearSong(); songId = id || null; updatePanel();
    // Luôn tải (nhẹ, có cache) để ghi chú chung cho ban nhạc hiện ngay; dấu ghi chú chỉ vẽ khi người dùng đã bật lớp.
    await ensureLoaded();
  }
  function clearSong() {
    ++generation; songId = null; pending = null; notes = []; revision = ''; bandNote = null;
    loaded = false; loading = false; editing = false; relocating = null; error = '';
    fingerprint = ''; fingerprintXml = null; unplaced = [];
    window.AnnotationPanel?.closeEditor(); clearDots(); window.AnnotationGeometry?.reserveSpace(0); updatePanel();
  }
  function setAddMode(on) {
    if (on && !member()) return;
    editing = !!on;
    if (!on) { relocating = null; window.AnnotationPanel?.closeEditor(); }
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('active', editing);
    if (editing) {
      window.ChordCanvas?.setAddMode?.(false);
      if (selected !== null && !selected.includes(instrumentId)) selected.push(instrumentId);
      remember();
      ensureLoaded();
    }
    build();
  }
  function toggleAddMode() { setAddMode(!editing); }
  function remember() {
    hasPreference = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); } catch (_) {}
    build();
  }
  function filter(id, checked) {
    const set = new Set(selected === null ? instruments.map(item => item.id) : selected);
    if (checked) set.add(id); else set.delete(id);
    selected = Array.from(set); remember();
  }
  function filterAll(all) { selected = all ? null : []; remember(); }
  function clearDots() { document.querySelectorAll('.ano-dot,.ano-dot-btn').forEach(node => node.remove()); }
  function currentFingerprint() {
    const xml = window.Store?.get?.('originalXml');
    if (xml !== fingerprintXml) { fingerprintXml = xml; fingerprint = window.AnnotationGeometry.fingerprint(xml); }
    return fingerprint;
  }
  function build() {
    clearDots();
    const container = document.getElementById('osmd-container');
    if (!container || !songId || !loaded || songId !== current()) { updatePanel(); return; }
    const layersOn = revealed || editing || (hasPreference && (selected === null || selected.length > 0));
    if ((!notes.length || !layersOn) && !editing) { window.AnnotationGeometry.reserveSpace(0); unplaced = []; updatePanel(); return; }
    const anchors = window.AnnotationGeometry.anchors().filter(anchor => container.contains(anchor.el));
    const score = currentFingerprint(), mapped = new Set(), occupied = [];
    const bounds = container.getBoundingClientRect();
    const obstacles = window.AnnotationGeometry.obstacles(container, bounds);
    const valid = notes.filter(note => !score || !note.scoreFingerprint || note.scoreFingerprint === score);
    valid.forEach(note => { if (anchors.some(anchor => window.AnnotationGeometry.matches(note, anchor))) mapped.add(note.id); });
    const visible = valid.filter(note => selected === null || selected.includes(note.instrumentId));
    const plan = window.AnnotationGeometry.plan(anchors, visible, instruments, editing && member(), instrumentId);
    if (window.AnnotationGeometry.reserveSpace(plan.rows)) { reposition(); return; }
    const tops = new Map();
    plan.items.forEach(({ anchor }) => {
      const key = anchor.line || anchor.el.ownerSVGElement;
      if (!tops.has(key)) tops.set(key, window.AnnotationGeometry.chordTop(anchor, bounds));
    });
    plan.items.forEach(item => place(container, bounds, item.anchor, item.found, {
      occupied, obstacles, row: item.row, top: tops.get(item.anchor.line || item.anchor.el.ownerSVGElement)
    }));
    unplaced = notes.filter(note => !mapped.has(note.id)).map(note => note.id);
    updatePanel();
  }
  function clickAfterTap(node, callback) {
    // Keep the gesture outside individual badges: resize can replace a badge mid-scroll.
    node.addEventListener('pointerdown', event => { gestureStart = { x: event.clientX, y: event.clientY }; gestureMoved = false; });
    node.addEventListener('click', event => { event.stopPropagation(); if (!gestureMoved || event.detail === 0) callback(); });
  }
  function place(container, bounds, anchor, found, layout) {
    const rect = anchor.el.getBoundingClientRect();
    const button = document.createElement('button'); button.type = 'button';
    button.className = found ? 'ano-dot' : 'ano-dot-btn';
    button.dataset.measureIdx = anchor.measureIdx; button.dataset.staffIdx = anchor.staffIdx; button.dataset.noteIdx = anchor.noteIdx;
    if (found) {
      const name = instruments.find(item => item.id === found[0].instrumentId)?.name || found[0].instrumentId;
      button.textContent = found.length > 1 ? `${found.length} ghi chú · Ô ${anchor.measureIdx + 1}` : `${found[0].icon || ''} ${name} · ${found[0].text}`.trim();
      button.dataset.instrumentId = found[0].instrumentId;
      button.dataset.noteId = found[0].id; window.AnnotationPanel.decorate(button, found[0].instrumentId, found[0].customColor);
      button.title = found.map(note => `${instruments.find(item => item.id === note.instrumentId)?.name || note.instrumentId}: ${note.text}`).join('\n');
      button.setAttribute('aria-label', `${button.title} · Ô ${anchor.measureIdx + 1}, khuông ${anchor.staffIdx + 1}. Mở bảng ghi chú`);
      clickAfterTap(button, () => editing && canEditNote(found[0]) ? openEditor(found[0], button) : window.AnnotationPanel.show(found[0].id));
    } else {
      button.textContent = '+'; button.setAttribute('aria-label', `Thêm ghi chú ô ${anchor.measureIdx + 1}, khuông ${anchor.staffIdx + 1}, vị trí ${anchor.noteIdx + 1}`);
      clickAfterTap(button, () => openEditor({ ...(relocating || {}), ...anchor, el: undefined, line: undefined,
        instrumentId: relocating?.instrumentId || instrumentId, scoreFingerprint: currentFingerprint() || undefined }, button));
    }
    container.append(button);
    window.AnnotationGeometry.position(button, { bounds, rect, anchor, ...layout });
  }
  function openEditor(note, target) {
    if (!loaded || saving || (note.id ? !canEditNote(note) : !member())) return;
    window.AnnotationPanel.hide(); window.AnnotationPanel.editor(note, target);
  }
  async function save(note, remove) {
    if (!member() || !loaded || saving || songId !== current()) throw new Error('Chưa thể lưu. Hãy tải lại ghi chú.');
    saving = true;
    const token = generation, id = songId;
    try {
      const next = notes.filter(item => item.id !== note.id);
      if (!remove) {
        const { el, line, ...record } = note;
        // Record IDs are not credentials; keep authoring usable on HTTP LAN hosts too.
        const suffix = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
        next.push({ ...record, id: note.id || `note-${suffix}` });
      }
      const data = await window.ApiService.annotations.save(id, next, revision);
      if (token !== generation || id !== current()) return;
      accept(data); relocating = null; build();
      window.App?.showToast?.('Đã lưu ghi chú', 'success');
    } finally { saving = false; updatePanel(); }
  }
  async function saveBand(next) {
    if (!member() || !loaded || saving || songId !== current()) throw new Error('Chưa thể lưu. Hãy tải lại ghi chú.');
    saving = true; updatePanel();
    const token = generation, id = songId;
    try {
      const data = await window.ApiService.annotations.saveBandNote(id, next, revision);
      if (token !== generation || id !== current()) return;
      accept(data); build();
      window.App?.showToast?.('Đã lưu ghi chú cho ban nhạc', 'success');
    } finally { saving = false; updatePanel(); }
  }
  async function saveInstrumentColor(id, color) {
    if (!admin() || saving) throw new Error('Chưa thể sửa màu.');
    const instrument = instruments.find(item => item.id === id), token = generation;
    saving = true;
    try {
      const data = await window.ApiService.annotations.saveInstrument({ instrumentId: id, name: instrument.name, color, registryRevision });
      if (token !== generation) return;
      instruments = data.instruments; registryRevision = data.registryRevision; error = ''; updatePanel(); build();
    } catch (e) { error = e.message; throw e; }
    finally { saving = false; updatePanel(); }
  }
  async function createInstrument(name) {
    if (!admin() || saving) throw new Error('Chưa thể sửa danh mục.');
    const token = generation;
    const data = await window.ApiService.annotations.saveInstrument({ name, registryRevision });
    if (token !== generation) return;
    instruments = data.instruments; registryRevision = data.registryRevision; updatePanel(); build();
  }
  function reposition() { clearTimeout(renderTimer); renderTimer = setTimeout(build, 150); }
  function onOSMDRendered() { reposition(); }
  return { init, loadSong, clearSong, setAddMode, toggleAddMode, onOSMDRendered, reposition,
    open: () => { revealed = true; window.AnnotationPanel?.show(); ensureLoaded(); } };
})();
window.AnnotationCanvas = AnnotationCanvas;
