const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
  const root = path.resolve(__dirname, '..');
  const snapshotDir = path.join(root, 'test-results', 'snapshot');
  const snapDb = path.join(snapshotDir, 'app.sqlite');
  const realDb = path.join(root, 'storage', 'data', 'app.sqlite');

  if (fs.existsSync(snapDb)) {
    fs.copyFileSync(snapDb, realDb);
    const snapWal = path.join(snapshotDir, 'app.sqlite-wal');
    const realWal = realDb + '-wal';
    if (fs.existsSync(snapWal)) {
      try { fs.copyFileSync(snapWal, realWal); } catch (_) {}
    } else if (fs.existsSync(realWal)) {
      try { fs.unlinkSync(realWal); } catch (_) {}
    }
    const snapShm = path.join(snapshotDir, 'app.sqlite-shm');
    const realShm = realDb + '-shm';
    if (fs.existsSync(snapShm)) {
      try { fs.copyFileSync(snapShm, realShm); } catch (_) {}
    } else if (fs.existsSync(realShm)) {
      try { fs.unlinkSync(realShm); } catch (_) {}
    }
    console.log('✅ [Playwright E2E] Đã khôi phục hoàn toàn CSDL thật từ snapshot.');
  }

  const liveSyncDir = path.join(root, 'storage', 'data', 'live_sync');
  const snapLiveSync = path.join(snapshotDir, 'live_sync');
  if (fs.existsSync(liveSyncDir) && fs.existsSync(snapLiveSync)) {
    for (const f of fs.readdirSync(liveSyncDir)) {
      if (!fs.existsSync(path.join(snapLiveSync, f))) {
        try { fs.unlinkSync(path.join(liveSyncDir, f)); } catch (_) {}
      }
    }
  }

  const chordSetsDir = path.join(root, 'storage', 'data', 'chord_sets');
  const snapChordSets = path.join(snapshotDir, 'chord_sets');
  if (fs.existsSync(chordSetsDir) && fs.existsSync(snapChordSets)) {
    try {
      fs.rmSync(chordSetsDir, { recursive: true, force: true });
      fs.cpSync(snapChordSets, chordSetsDir, { recursive: true, force: true });
    } catch (_) {}
  }
};
