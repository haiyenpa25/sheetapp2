const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');
module.exports = async function globalSetup(config) {
  assertIsolatedRoot(path.resolve(__dirname, '..'), config);
  process.env.SHEETAPP_E2E = '1';
  console.log('[E2E] Isolated copy verified; no snapshot of application DB is needed.');
};
