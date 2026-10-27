'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const coreSrc = fs.readFileSync(path.join(root, 'assets/js/core/ChordCanvasCore.js'), 'utf8');
const editSrc = fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8');
const canvasSrc = fs.readFileSync(path.join(root, 'assets/js/chord-canvas.js'), 'utf8');
const oldCanvasSrc = fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas.js'), 'utf8');

let total = 0;
let failed = 0;

function check(ok, msg) {
  total++;
  if (!ok) {
    failed++;
    console.log(`[FAIL:B] ${msg}`);
  } else {
    console.log(`[PASS:B] ${msg}`);
  }
}

function makeSandbox() {
  const toasts = [];
  let saveCalls = 0;
  let loadShouldFail = true;
  const elements = {};
  const getEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        disabled: false,
        textContent: '',
        innerHTML: '',
        style: {},
        classList: {
          _set: new Set(),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          toggle(c, force) {
            const on = force === undefined ? !this._set.has(c) : !!force;
            if (on) this._set.add(c); else this._set.delete(c);
          },
          contains(c) { return this._set.has(c); },
        },
        setAttribute(k, v) { if (k === 'disabled') this.disabled = true; this[k] = v; },
        removeAttribute(k) { if (k === 'disabled') this.disabled = false; delete this[k]; },
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild() {},
      };
    }
    return elements[id];
  };

  const sandbox = {
    console,
    setTimeout: (fn) => { try { fn(); } catch (_) {} return 1; },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { try { fn(); } catch (_) {} return 1; },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { onLine: true },
    document: {
      body: {
        classList: { contains: () => false, add() {}, remove() {} },
        contains: () => true,
        appendChild() {},
      },
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => getEl('created_' + tag),
      addEventListener() {},
    },
    window: null,
    addEventListener: () => {},
  };
  sandbox.window = sandbox;
  sandbox.App = {
    getCurrentSongId: () => 'thanh-ca-001',
    getCurrentTranspose: () => 0,
    showToast: (msg, type) => toasts.push({ msg: String(msg), type }),
  };
  sandbox.AppUI = {
    showToast: (msg, type) => toasts.push({ msg: String(msg), type }),
  };
  sandbox.Auth = {
    isAdmin: () => true,
    isBanhat: () => true,
    canEditChords: () => true,
    getChordCode: () => 'HD',
    getUser: () => 'admin',
  };
  sandbox.TransposeEngine = {
    transposeChord: (c) => c,
  };
  sandbox.ApiService = {
    chordSets: {
      load: async () => {
        if (loadShouldFail) {
          throw new Error('Network error while loading HD');
        }
        return {
          success: true,
          chords: [{ measureIdx: 0, noteIdx: 0, chord: 'G' }],
          checksum: 'valid-checksum-123',
        };
      },
      save: async () => {
        saveCalls++;
        return { success: true, checksum: 'saved-checksum' };
      },
      list: async () => ({ sets: ['HD'] }),
    },
  };

  return {
    sandbox,
    toasts,
    getSaveCalls: () => saveCalls,
    setLoadShouldFail: (v) => { loadShouldFail = v; },
    getEl,
  };
}

(async () => {
  // 1. Modern UI: loadSong('thanh-ca-001', 'HD') fails -> toast shown, executeSave / saveChord blocked (0 save calls)
  {
    const env = makeSandbox();
    vm.createContext(env.sandbox);
    vm.runInContext(coreSrc, env.sandbox);
    vm.runInContext(editSrc, env.sandbox);
    vm.runInContext(canvasSrc, env.sandbox);

    env.setLoadShouldFail(true);
    await env.sandbox.ChordCanvas.loadSong('thanh-ca-001', 'HD');

    const hasErrorToast = env.toasts.some((t) => t.msg.includes('Không tải được bộ hợp âm'));
    check(hasErrorToast, 'Modern loadSong shows toast "Không tải được bộ hợp âm" when chord_sets.load fails');

    await env.sandbox.ChordCanvasEdit.saveChord(0, 0, 'Am', false);
    await env.sandbox.ChordCanvasEdit.flushSave();
    await env.sandbox.ChordCanvasEdit.executeSave();

    check(
      env.getSaveCalls() === 0,
      `Modern executeSave blocks ApiService.chordSets.save when chord set load failed (saveCalls=${env.getSaveCalls()})`,
    );

    // After reload succeeds, saving works again
    env.setLoadShouldFail(false);
    await env.sandbox.ChordCanvas.loadSong('thanh-ca-001', 'HD');
    await env.sandbox.ChordCanvasEdit.saveChord(0, 1, 'D7', false);
    await env.sandbox.ChordCanvasEdit.executeSave();
    check(
      env.getSaveCalls() >= 1,
      `Modern executeSave allows ApiService.chordSets.save after subsequent loadSong succeeds (saveCalls=${env.getSaveCalls()})`,
    );
  }

  // 2. Classic UI: loadSong('thanh-ca-001', 'HD') fails -> toast shown, add/save blocked
  {
    const env = makeSandbox();
    vm.createContext(env.sandbox);
    vm.runInContext(coreSrc, env.sandbox);
    vm.runInContext(oldCanvasSrc, env.sandbox);

    env.setLoadShouldFail(true);
    await env.sandbox.ChordCanvas.loadSong('thanh-ca-001', 'HD');

    const hasErrorToast = env.toasts.some((t) => t.msg.includes('Không tải được bộ hợp âm'));
    check(hasErrorToast, 'Classic loadSong shows toast "Không tải được bộ hợp âm" when chord_sets.load fails');

    const coreSaveRes = await env.sandbox.ChordCanvasCore.saveChordSet('thanh-ca-001', 'HD', { '0_0': 'C' }, '');
    check(
      coreSaveRes && coreSaveRes.success === false && env.getSaveCalls() === 0,
      `ChordCanvasCore.saveChordSet blocks saving failed chord set (saveCalls=${env.getSaveCalls()})`,
    );
  }

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exit(failed > 0 ? 1 : 0);
})();
