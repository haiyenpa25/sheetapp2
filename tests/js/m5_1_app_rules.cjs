'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let passed = 0;
let failed = 0;

function check(cond, label) {
  if (cond) {
    passed++;
    console.log(`[PASS:B] ${label}`);
  } else {
    failed++;
    console.error(`[FAIL:B] ${label}`);
  }
}

const appRulesPath = path.join(root, 'assets/js/core/AppRules.js');
check(fs.existsSync(appRulesPath), 'assets/js/core/AppRules.js exists');

function runUiVm(appRelPath) {
  const storeMap = new Map([
    ['originalXml', '<score-partwise/>'],
    ['currentTranspose', 0],
    ['currentSong', { id: 'thanh-ca-001', title: 'Test Song', defaultKey: 'G' }],
  ]);
  const toasts = [];
  const sandbox = {
    console,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    document: {
      readyState: 'complete',
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  sandbox.window = sandbox;
  sandbox.Store = {
    get: (k) => storeMap.get(k),
    set: (k, v) => storeMap.set(k, v),
    reset: () => storeMap.clear(),
  };
  sandbox.AppUI = {
    showToast: (msg, type) => toasts.push({ msg, type }),
    updateTransposeDisplay: () => {},
    updateSongInfo: () => {},
  };
  sandbox.URLState = { update: () => {} };
  sandbox.EventBus = { emit: () => {}, on: () => {} };
  sandbox.SongLoader = { commitTranspose: async () => {} };
  sandbox.SessionTracker = { setTranspose: () => {} };

  const ctx = vm.createContext(sandbox);
  if (fs.existsSync(appRulesPath)) {
    vm.runInContext(fs.readFileSync(appRulesPath, 'utf8'), ctx, { filename: 'AppRules.js' });
  }
  const appCode = fs.readFileSync(path.join(root, appRelPath), 'utf8') + '\nwindow.App = App;';
  vm.runInContext(appCode, ctx, { filename: appRelPath });
  return { sandbox, storeMap, toasts };
}

if (fs.existsSync(appRulesPath)) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(appRulesPath, 'utf8'), ctx);
  const R = ctx.AppRules;
  check(Boolean(R), 'window.AppRules is defined');
  check(R?.MAX_TRANSPOSE === 12 && R?.MIN_TRANSPOSE === -12, 'AppRules defines ±12 transpose bounds (Q-M4)');
  check(R?.DEFAULT_CHORD_SET === 'HD' && R?.FALLBACK_CHORD_SET === 'default', 'AppRules defines Core Rule 1 HD/default chord set names');
  check(R?.isLockedChordSet?.('HD') === true && R?.isLockedChordSet?.('default') === true && R?.isLockedChordSet?.('custom') === false, 'AppRules.isLockedChordSet enforces Core Rule 3 lock on HD & default');
  check(R?.isTransposeValid?.(9) === true && R?.isTransposeValid?.(12) === true && R?.isTransposeValid?.(13) === false, 'AppRules.isTransposeValid validates ±12 range');
} else {
  check(false, 'window.AppRules is defined');
}

for (const [label, relPath] of [['Modern', 'assets/js/app.js'], ['Classic', 'old/assets/js/app.js']]) {
  const { sandbox, storeMap, toasts } = runUiVm(relPath);
  for (let i = 0; i < 9; i++) {
    sandbox.App.transposeBy(1);
  }
  check(storeMap.get('currentTranspose') === 9, `${label} (${relPath}) allows transpose +9 semitones under unified ±12 limit`);
  for (let i = 0; i < 3; i++) {
    sandbox.App.transposeBy(1);
  }
  check(storeMap.get('currentTranspose') === 12, `${label} (${relPath}) reaches +12 semitones`);
  sandbox.App.transposeBy(1);
  check(storeMap.get('currentTranspose') === 12 && toasts.length > 0, `${label} (${relPath}) blocks +13 semitones at ±12 limit`);
  sandbox.App.resetTranspose();
  check(storeMap.get('currentTranspose') === 0, `${label} (${relPath}) resetTranspose returns to 0 (Core Rule 2)`);
}

console.log(`SUITE_COMPLETE total=${passed + failed} passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
