const { execFileSync } = require('child_process');
const path = require('path');
const assertIsolatedRoot = require('../assert-isolated-root');

exports.php = function php(args, options = {}) {
  const cwd = options.cwd || path.resolve(__dirname, '../..');
  assertIsolatedRoot(cwd);
  return execFileSync(process.env.SHEETAPP_PHP_BINARY || 'php', args, {
    ...options,
    cwd,
    env: { ...process.env, ...(options.env || {}), SHEETAPP_E2E: '1' }
  });
};
exports.run = (args, options) => exports.php(['tools/create_test_session.php', ...args], options);
