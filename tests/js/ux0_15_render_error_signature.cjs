/**
 * tests/js/ux0_15_render_error_signature.cjs
 * UX0-15: Verify OSMDRenderCore.reportRenderError passes flat (song, message, onRetry, onViewLyric)
 * to AppUI.showLoadError and object { type: 'render_error', source: 'OSMDRenderCore', message, stack }
 * to ErrorReporter.report, so #sheet-load-error shows the message (never "[object Object]") and
 * clicking Retry invokes SongLoader.load(song, currentTranspose).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const renderCoreSrc = fs.readFileSync(path.join(root, 'assets/js/core/OSMDRenderCore.js'), 'utf8');
const appUiSrc = fs.readFileSync(path.join(root, 'assets/js/app-ui.js'), 'utf8');

let checks = 0;
function pass(msg) {
  checks++;
  console.log(`[PASS:B] ${msg}`);
}

(async () => {
  const elements = new Map();
  let retryListener = null;
  let viewLyricListener = null;
  let panelHtml = '';

  function makeEl(id) {
    return {
      id,
      style: { cssText: '' },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) { this._set.delete(c); return false; }
            this._set.add(c); return true;
          }
          if (force) this._set.add(c); else this._set.delete(c);
          return !!force;
        },
        contains(c) { return this._set.has(c); },
      },
      setAttribute() {},
      appendChild(child) {
        if (child && child.id) elements.set(child.id, child);
      },
      set innerHTML(val) { panelHtml = String(val); },
      get innerHTML() { return panelHtml; },
      querySelector(sel) {
        if (sel === '#btn-sheet-retry') {
          return { addEventListener: (evt, fn) => { if (evt === 'click') retryListener = fn; } };
        }
        if (sel === '#btn-sheet-view-lyric') {
          return { addEventListener: (evt, fn) => { if (evt === 'click') viewLyricListener = fn; } };
        }
        return null;
      },
    };
  }

  ['welcome-screen', 'loading-screen', 'sheet-area', 'song-title', 'song-key'].forEach(id => {
    elements.set(id, makeEl(id));
  });
  const containerEl = {
    id: 'osmd-container',
    clientWidth: 800,
    style: { display: 'block', visibility: 'visible' },
    classList: { contains: () => false },
    closest: () => null,
  };
  elements.set('osmd-container', containerEl);

  const reportedErrors = [];
  const loadedCalls = [];
  let lyricSwitched = false;

  const currentSong = { id: 'thanh-ca-001', title: 'Thánh Ca 001', key: 'G' };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    document: {
      body: makeEl('body'),
      getElementById: (id) => elements.get(id) || null,
      querySelector: (sel) => (sel === '.sheet-viewer-wrapper' ? makeEl('wrapper') : null),
      querySelectorAll: () => [],
      createElement: (tag) => makeEl(tag),
      addEventListener: () => {},
    },
    window: null,
    Store: {
      get: (k) => {
        if (k === 'currentSong') return currentSong;
        if (k === 'currentTranspose') return 2;
        return null;
      },
    },
    SafeHtml: {
      escape: (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    },
    ErrorReporter: {
      report: (payload) => { reportedErrors.push(payload); },
    },
    SongLoader: {
      load: (song, t) => { loadedCalls.push({ song, t }); },
    },
    LyricView: {
      switchMode: (mode) => { if (mode === 'lyric') lyricSwitched = true; },
    },
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(appUiSrc, sandbox);
  vm.runInContext(renderCoreSrc, sandbox);

  // Force osmd.render() inside enqueueRender to throw
  const res = await sandbox.window.OSMDRenderCore.enqueueRender('osmd-container', async () => {
    throw new Error('SVG measure layout failed');
  });

  assert.strictEqual(res.rendered, false, 'enqueueRender should return rendered: false on error');
  assert.ok(res.error instanceof Error, 'enqueueRender should return the thrown Error');

  // 1. ErrorReporter.report receives structured object { type: 'render_error', source: 'OSMDRenderCore', message, stack }
  assert.strictEqual(reportedErrors.length, 1, 'ErrorReporter.report must be called once');
  const rep = reportedErrors[0];
  assert.strictEqual(typeof rep, 'object', 'ErrorReporter.report argument must be an object, not a string');
  assert.strictEqual(rep.type, 'render_error', 'ErrorReporter.report type must be render_error');
  assert.strictEqual(rep.source, 'OSMDRenderCore', 'ErrorReporter.report source must be OSMDRenderCore');
  assert.ok(String(rep.message).includes('SVG measure layout failed'), 'ErrorReporter.report message must include error text');
  pass('OSMDRenderCore.reportRenderError calls ErrorReporter.report({ type: "render_error", source: "OSMDRenderCore", message, stack })');

  // 2. #sheet-load-error displays readable message and never "[object Object]"
  assert.ok(!panelHtml.includes('[object Object]'), `#sheet-load-error must NOT contain [object Object], got: ${panelHtml}`);
  assert.ok(panelHtml.includes('Không vẽ được bản nhạc'), `#sheet-load-error must show "Không vẽ được bản nhạc", got: ${panelHtml}`);
  pass('#sheet-load-error panel renders "Không vẽ được bản nhạc" without "[object Object]"');

  // 3. Clicking #btn-sheet-retry invokes SongLoader.load(currentSong, 2)
  assert.strictEqual(typeof retryListener, 'function', '#btn-sheet-retry click listener must be bound');
  retryListener();
  assert.strictEqual(loadedCalls.length, 1, 'Clicking #btn-sheet-retry must call SongLoader.load once');
  assert.strictEqual(loadedCalls[0].song.id, 'thanh-ca-001');
  assert.strictEqual(loadedCalls[0].t, 2);
  pass('Clicking #btn-sheet-retry calls SongLoader.load(currentSong, currentTranspose)');

  console.log(`SUITE_COMPLETE total=${checks}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
