const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let total = 0;

function check(cond, msg) {
  total++;
  if (!cond) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  }
  console.log('PASS: ' + msg);
}

(async () => {
  const corePath = path.join(root, 'assets/js/core/OSMDRenderCore.js');
  check(fs.existsSync(corePath), 'M3-1: assets/js/core/OSMDRenderCore.js exists');

  let loadErrorShown = null;
  let errorReported = null;

  const container = {
    id: 'osmd-container',
    clientWidth: 800,
    classList: { contains: () => false },
    closest: () => null,
    style: { display: 'block', visibility: 'visible' },
  };

  const win = {
    document: {
      getElementById: (id) => (id === 'osmd-container' ? container : null),
    },
    getComputedStyle: (el) => el.style || { display: 'block', visibility: 'visible' },
    Store: {
      get: (k) => (k === 'currentSong' ? { id: 'thanh-ca-001', title: 'Thánh Ca 1' } : null),
    },
    AppUI: {
      showLoadError: (song, opts) => {
        loadErrorShown = { song, opts };
      },
    },
    ErrorReporter: {
      report: (ctxName, err) => {
        errorReported = { ctxName, err };
      },
    },
  };
  win.window = win;

  const ctx = vm.createContext({
    window: win,
    document: win.document,
    setTimeout,
    clearTimeout,
    Promise,
    Object,
    Math,
    Error,
    String,
    Number,
    Boolean,
    console,
  });

  vm.runInContext(fs.readFileSync(corePath, 'utf8'), ctx);
  check(
    Boolean(win.OSMDRenderCore) &&
      typeof win.OSMDRenderCore.canRender === 'function' &&
      typeof win.OSMDRenderCore.scheduleResize === 'function' &&
      typeof win.OSMDRenderCore.enqueueRender === 'function',
    'M3-1: OSMDRenderCore exposes canRender, scheduleResize, enqueueRender',
  );

  // 1. 10 resize events within 200ms -> exactly 1 render call
  let resizeRenderCount = 0;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 15));
    win.OSMDRenderCore.scheduleResize(
      'osmd-container',
      async () => {
        resizeRenderCount++;
      },
      80, // scaled debounce in VM test; default is 250ms
    );
  }
  await new Promise((r) => setTimeout(r, 140));
  check(
    resizeRenderCount === 1,
    `M3-1: 10 resize events within 200ms coalesce into exactly 1 render (actual=${resizeRenderCount})`,
  );

  // 2. Skip render when width is 0 or container is hidden, and mark pending
  container.clientWidth = 0;
  let hiddenRenderCount = 0;
  const skipped = await win.OSMDRenderCore.enqueueRender('osmd-container', async () => {
    hiddenRenderCount++;
  });
  check(
    skipped.rendered === false && skipped.pending === true && hiddenRenderCount === 0,
    'M3-1: OSMDRenderCore skips render when container width is 0 and marks pending',
  );
  container.clientWidth = 800;

  // 3. Render error is caught and reported to M2-4 panel (AppUI.showLoadError)
  const failed = await win.OSMDRenderCore.enqueueRender('osmd-container', async () => {
    throw new Error('SkyBottomLineCalculator error');
  });
  check(
    failed.rendered === false && Boolean(loadErrorShown) && Boolean(errorReported),
    'M3-1: OSMDRenderCore catches render failure and reports to AppUI.showLoadError panel + ErrorReporter',
  );

  console.log('\nSUITE_COMPLETE total=' + total);
})();
