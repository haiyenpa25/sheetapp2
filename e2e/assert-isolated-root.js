const fs = require('fs');
const path = require('path');

module.exports = function assertIsolatedRoot(root, config) {
  const markerPath = path.join(root, '.sheetapp-e2e-isolated.json');
  if (!fs.existsSync(markerPath)) throw new Error('E2E requires an isolated copy outside the source workspace');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  const source = fs.realpathSync(marker.sourceRoot);
  const target = fs.realpathSync(root);
  const relative = path.relative(source, target);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
    throw new Error('E2E copy must be outside the source workspace');
  }
  const baseURL = process.env.SHEETAPP_E2E_BASE_URL;
  if (!baseURL || baseURL !== marker.baseURL) throw new Error('E2E base URL must match the isolated server marker');
  if (config?.projects?.some(project => project.use.baseURL !== baseURL)) throw new Error('E2E project points at another server');
  return marker;
};
