const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let total = 0;
let passed = 0;
let failed = 0;

function check(cond, label, type = 'B') {
  total++;
  if (cond) {
    passed++;
    console.log(`[PASS:${type}] ${label}`);
  } else {
    failed++;
    console.log(`[FAIL:${type}] ${label}`);
  }
}

function makeDomEnv(opts = {}) {
  const elements = new Map();
  const bodyClasses = new Set();

  function makeClassList(set) {
    return {
      add: (...cls) => cls.forEach(c => set.add(c)),
      remove: (...cls) => cls.forEach(c => set.delete(c)),
      contains: (c) => set.has(c),
      toggle: (c, force) => {
        const shouldHave = force !== undefined ? Boolean(force) : !set.has(c);
        if (shouldHave) set.add(c);
        else set.delete(c);
        return shouldHave;
      },
    };
  }

  function getEl(id) {
    if (opts.throwOnId && opts.throwOnId === id) {
      throw new Error(`Simulated DOM error on #${id}`);
    }
    if (!elements.has(id)) {
      const cls = new Set();
      const listeners = {};
      elements.set(id, {
        id,
        tagName: id === 'zoom-slider' || id === 'capo-select' ? 'SELECT' : 'BUTTON',
        value: '100',
        style: {},
        classList: makeClassList(cls),
        listeners,
        addEventListener(evt, fn) {
          if (!listeners[evt]) listeners[evt] = [];
          listeners[evt].push(fn);
        },
        click() {
          (listeners.click || []).forEach(fn => fn({ currentTarget: this, target: this, stopPropagation() {}, preventDefault() {} }));
        },
        blur() {},
        setAttribute() {},
      });
    }
    return elements.get(id);
  }

  const storageMap = new Map();
  const localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
  };

  let fullscreenToggled = 0;
  let printCalled = 0;
  let helpOpened = 0;
  let highlightToggled = 0;
  let addModeToggled = 0;
  let newSetOpened = 0;
  let pinToggled = 0;
  let sessionToggled = 0;
  let compactSet = null;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    localStorage,
    URLSearchParams,
    ResizeObserver: undefined,
    MutationObserver: function () { return { observe() {} }; },
    document: {
      body: {
        classList: makeClassList(bodyClasses),
        appendChild() {},
      },
      documentElement: {
        appendChild() {},
      },
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      addEventListener() {},
      createElement: () => getEl('created-' + Math.random()),
    },
    window: null,
    Store: {
      get: (k) => (k === 'currentSong' ? { id: 42 } : 0),
      set: () => {},
    },
    App: {
      showToast: () => {},
      transposeBy: () => {},
      resetTranspose: () => {},
      setZoom: () => {},
    },
    AppUI: {
      toggleFullscreen: () => { fullscreenToggled++; },
      updateCapoBadge: () => {},
      updateSessionPanel: () => {},
    },
    PerformanceNotes: {
      toggle: () => { sessionToggled++; },
    },
    ChordCanvas: {
      toggleHighlight: () => { highlightToggled++; },
      toggleAddMode: () => { addModeToggled++; },
      showNewSetModal: () => { newSetOpened++; },
    },
    LibraryUI: {
      togglePin: () => { pinToggled++; },
    },
    OSMDRenderer: {
      getCompactMode: () => false,
      setCompactMode: (v) => { compactSet = v; },
    },
    URLState: {
      update: () => {},
      interfaceUrl: () => '/sheetapp2/',
    },
    _helpModalOpen: () => { helpOpened++; },
    print: () => { printCalled++; },
  };
  sandbox.window = sandbox;
  sandbox.window.innerWidth = 1024;
  sandbox.window.addEventListener = () => {};

  return {
    sandbox,
    elements,
    bodyClasses,
    getStats: () => ({
      fullscreenToggled,
      printCalled,
      helpOpened,
      highlightToggled,
      addModeToggled,
      newSetOpened,
      pinToggled,
      sessionToggled,
      compactSet,
    }),
  };
}

// 1. Run SafeStorage + BootRunner + old/assets/js/toolbar-controller.js
{
  const env = makeDomEnv();
  vm.createContext(env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeStorage.js'), 'utf8'), env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/BootRunner.js'), 'utf8'), env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/toolbar-controller.js'), 'utf8'), env.sandbox);

  let initThrew = false;
  try {
    env.sandbox.ToolbarController.init();
  } catch (err) {
    initThrew = true;
  }

  const failures = env.sandbox.BootRunner.getFailures();
  check(!initThrew && failures.length === 0, 'UX0-1: Classic ToolbarController.init() runs with real SafeStorage without throwing or recording BootRunner failures', 'B');

  // Toggle dark mode via #btn-dark-mode
  env.elements.get('btn-dark-mode')?.click();
  check(
    env.bodyClasses.has('dark-mode') && env.sandbox.SafeStorage.get('sheetapp_dark_mode') === '1',
    'UX0-1: Clicking #btn-dark-mode toggles dark-mode class and persists via SafeStorage.get/set',
    'B'
  );

  // Verify misc buttons bound after _bindDarkMode
  const miscIds = [
    'btn-fullscreen',
    'btn-print',
    'btn-session-panel',
    'btn-help',
    'menu-instrument-annotations',
    'menu-chord-highlight',
    'menu-chord-notation',
    'menu-add-chord',
    'menu-new-chord-set',
    'menu-pin-song',
    'btn-compact-mode',
  ];
  const allHaveClickListeners = miscIds.every(id => {
    const el = env.elements.get(id);
    return el && Array.isArray(el.listeners.click) && el.listeners.click.length > 0;
  });
  check(allHaveClickListeners, 'UX0-1: All 11 misc/menu buttons in Classic ToolbarController have click listeners attached', 'B');

  env.elements.get('btn-fullscreen')?.click();
  env.elements.get('btn-help')?.click();
  env.elements.get('menu-chord-highlight')?.click();
  env.elements.get('menu-add-chord')?.click();
  env.elements.get('menu-new-chord-set')?.click();
  env.elements.get('menu-pin-song')?.click();
  env.elements.get('btn-session-panel')?.click();
  env.elements.get('btn-compact-mode')?.click();
  const st = env.getStats();
  check(
    st.fullscreenToggled === 1 &&
      st.helpOpened === 1 &&
      st.highlightToggled === 1 &&
      st.addModeToggled === 1 &&
      st.newSetOpened === 1 &&
      st.pinToggled === 1 &&
      st.sessionToggled === 1 &&
      st.compactSet === true,
    'UX0-1: Classic toolbar & menu ⋮ buttons invoke fullscreen, help, highlight, add-chord, new-set, pin, session, and compact handlers',
    'B'
  );
}

// 2. Verify fault isolation between _bindX steps in ToolbarController.init()
{
  const env = makeDomEnv({ throwOnId: 'zoom-slider' });
  vm.createContext(env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeStorage.js'), 'utf8'), env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/BootRunner.js'), 'utf8'), env.sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/toolbar-controller.js'), 'utf8'), env.sandbox);

  let initThrew = false;
  try {
    env.sandbox.ToolbarController.init();
  } catch (err) {
    initThrew = true;
  }
  env.elements.get('btn-fullscreen')?.click();
  env.elements.get('btn-dark-mode')?.click();
  const st = env.getStats();
  check(
    !initThrew && st.fullscreenToggled === 1 && env.bodyClasses.has('dark-mode'),
    'UX0-1: Fault in _bindZoom is isolated via safeInit so _bindDarkMode and _bindMisc still bind',
    'B'
  );
}

// 3. Static check: no SafeStorage.getItem or SafeStorage.setItem anywhere in JS files
{
  const jsFiles = [
    path.join(root, 'old/assets/js/toolbar-controller.js'),
    path.join(root, 'assets/js/toolbar-controller.js'),
  ];
  const hasWrongCall = jsFiles.some(f => {
    const src = fs.readFileSync(f, 'utf8');
    return /SafeStorage\.(getItem|setItem)\b/.test(src);
  });
  check(!hasWrongCall, 'UX0-1: No SafeStorage.getItem/setItem calls in toolbar-controller.js', 'S');
}

console.log(`SUITE_COMPLETE total=${total} passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
