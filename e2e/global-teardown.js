const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');
module.exports = async function globalTeardown(config) {
  assertIsolatedRoot(path.resolve(__dirname, '..'), config);
  console.log('[E2E] Isolated copy retained for review; application DB is never restored from a snapshot.');
};
