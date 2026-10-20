/** Instrument-specific annotations, shared by Modern and Classic. */
const AnnotationCanvas = (() => {
  'use strict';
  const STORAGE_KEY = 'sheetapp_annotation_layers';
  let initialized = false, songId = null, generation = 0, pending = null;
  let notes = [], instruments = [], revision = '', registryRevision = '';
  let loaded = false, loading = false, saving = false, error = '', editing = false;
  let instrumentId = 'general', relocating = null, selected = null, hasPreference = false;
  let renderTimer, observer, unplaced = [], fingerprint = '', fingerprintXml = null;
  let gestureStart = null, gestureMoved = false;
  const admin = () => !!window.Auth?.isAdmin?.();
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
    window.AnnotationPanel.init({ activate: ensureLoaded, reload, filter, filterAll,
      edit: setAddMode, instrument: id => { instrumentId = id; updatePanel(); },
      openEditor, relocate: note => { relocating = note; setAddMode(true); },
      save, createInstrument });
    document.getElementById('btn-add-annotate-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-annotate')?.addEventListener('click', () => setAddMode(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.querySelector('.ano-editor[open]')) setAddMode(false);
    });
    document.addEventListener('pointermove', event => {
      if (gestureStart && Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y) > 8) gestureMoved = true;
    }, { passive: true });
    document.addEventListener('pointercancel', () => { gestureMoved = true; }, { passive: true });
    window.EventBus?.on?.('auth:changed', () => { if (!admin()) setAddMode(false); updatePanel(); });
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
    updatePanel();
  }
  function updatePanel() {
    window.AnnotationPanel?.render({ songId, notes, instruments, selected, loading, loaded,
      saving, error, editing: editing && admin(), admin: admin(), instrumentId, unplaced, relocating: !!relocating });
  }
  function accept(data) {
    if (!Array.isArray(data?.annotations) || typeof data.revision !== 'string') throw new Error('Không đọc được dữ liệu ghi chú. Hãy tải lại.');
    notes = data.annotations; revision = data.revision;
    instruments = data.instruments || instruments; registryRevision = data.registryRevision || registryRevision;
    if (!instruments.some(item => item.id === instrumentId)) instrumentId = instruments[0]?.id || 'general';
    loaded = true; error = '';
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
    if (force || window.AnnotationPanel?.isOpen() || (hasPreference && (selected === null || selected.length))) await ensureLoaded();
  }
  function clearSong() {
    ++generation; songId = null; pending = null; notes = []; revision = '';
    loaded = false; loading = false; editing = false; relocating = null; error = '';
    fingerprint = ''; fingerprintXml = null; unplaced = [];
    window.AnnotationPanel?.closeEditor(); clearDots(); updatePanel();
  }
  function setAddMode(on) {
    if (on && !admin()) return;
    editing = !!on;
    if (!on) { relocating = null; window.AnnotationPanel?.closeEditor(); }
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('active', editing);
    if (editing) {
      window.ChordCanvas?.setAddMode?.(false);
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
    if (!notes.length && !editing) { unplaced = []; updatePanel(); return; }
    const anchors = window.AnnotationGeometry.anchors().filter(anchor => container.contains(anchor.el));
    const score = currentFingerprint(), mapped = new Set(), occupied = [];
    const bounds = container.getBoundingClientRect();
    const obstacles = window.AnnotationGeometry.obstacles(container, bounds);
    anchors.forEach(anchor => {
      const found = notes.filter(note => (!score || !note.scoreFingerprint || note.scoreFingerprint === score)
        && window.AnnotationGeometry.matches(note, anchor));
      found.forEach(note => mapped.add(note.id));
      const visible = found.filter(note => selected === null || selected.includes(note.instrumentId));
      if (visible.length) place(container, bounds, anchor, visible, { occupied, obstacles });
      if (editing && admin()) place(container, bounds, anchor, null, { occupied, obstacles });
    });
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
      button.textContent = found.length > 1 ? `${found.length} ghi chú · Ô ${anchor.measureIdx + 1}` : `${name} · ${found[0].text}`;
      button.title = found.map(note => `${instruments.find(item => item.id === note.instrumentId)?.name || note.instrumentId}: ${note.text}`).join('\n');
      button.setAttribute('aria-label', `${button.title} · Ô ${anchor.measureIdx + 1}, khuông ${anchor.staffIdx + 1}. Mở bảng ghi chú`);
      clickAfterTap(button, () => window.AnnotationPanel.show());
    } else {
      button.textContent = '+'; button.setAttribute('aria-label', `Thêm ghi chú ô ${anchor.measureIdx + 1}, khuông ${anchor.staffIdx + 1}, vị trí ${anchor.noteIdx + 1}`);
      clickAfterTap(button, () => openEditor({ ...(relocating || {}), ...anchor, el: undefined,
        instrumentId: relocating?.instrumentId || instrumentId, scoreFingerprint: currentFingerprint() || undefined }));
    }
    container.append(button);
    window.AnnotationGeometry.position(button, { bounds, rect, ...layout });
  }
  function openEditor(note) {
    if (!admin() || !loaded || saving) return;
    window.AnnotationPanel.editor(note);
  }
  async function save(note, remove) {
    if (!admin() || !loaded || saving || songId !== current()) throw new Error('Chưa thể lưu. Hãy tải lại ghi chú.');
    saving = true;
    const token = generation, id = songId;
    const next = notes.filter(item => item.id !== note.id);
    if (!remove) {
      const { el, ...record } = note;
      next.push({ ...record, id: note.id || `note-${crypto.randomUUID()}` });
    }
    try {
      const data = await window.ApiService.annotations.save(id, next, revision);
      if (token !== generation || id !== current()) return;
      accept(data); relocating = null; build();
      window.App?.showToast?.('Đã lưu ghi chú', 'success');
    } finally { saving = false; updatePanel(); }
  }
  async function createInstrument(name) {
    if (!admin() || saving) throw new Error('Chưa thể sửa danh mục.');
    const token = generation;
    const data = await window.ApiService.annotations.saveInstrument({ name, registryRevision });
    if (token !== generation) return;
    instruments = data.instruments; registryRevision = data.registryRevision; build();
  }
  function reposition() { clearTimeout(renderTimer); renderTimer = setTimeout(build, 150); }
  function onOSMDRendered() { reposition(); }
  return { init, loadSong, clearSong, setAddMode, toggleAddMode, onOSMDRendered, reposition };
})();
window.AnnotationCanvas = AnnotationCanvas;
