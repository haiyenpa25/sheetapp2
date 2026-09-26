const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  process.env.SHEETAPP_E2E = '1';
  const root = path.resolve(__dirname, '..');
  const snapshotDir = path.join(root, 'test-results', 'snapshot');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const dbPath = path.join(root, 'storage', 'data', 'app.sqlite');
  if (fs.existsSync(dbPath)) {
    try {
      const fd = fs.openSync(dbPath, 'r+');
      fs.closeSync(fd);
    } catch (err) {
      console.warn('Warning: app.sqlite may be locked or read-only:', err.message);
    }

    fs.copyFileSync(dbPath, path.join(snapshotDir, 'app.sqlite'));
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, path.join(snapshotDir, 'app.sqlite-wal'));
    }
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, path.join(snapshotDir, 'app.sqlite-shm'));
    }
  }

  const liveSyncDir = path.join(root, 'storage', 'data', 'live_sync');
  const snapLiveSync = path.join(snapshotDir, 'live_sync');
  if (fs.existsSync(liveSyncDir)) {
    if (!fs.existsSync(snapLiveSync)) fs.mkdirSync(snapLiveSync, { recursive: true });
    for (const f of fs.readdirSync(liveSyncDir)) {
      fs.copyFileSync(path.join(liveSyncDir, f), path.join(snapLiveSync, f));
    }
  }

  console.log('✅ [Playwright E2E] Snapshot CSDL & storage đã được sao lưu an toàn tại test-results/snapshot/');
};
