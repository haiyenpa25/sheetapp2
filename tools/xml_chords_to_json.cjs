// tools/xml_chords_to_json.cjs — trích hợp âm TLH trong MusicXML thành bản đồ HD, dùng CHÍNH mã sản phẩm
// (assets/js/chord-canvas-xml.js → readXmlChords) chạy trong Chromium để khoá `measureIdx_noteIdx` khớp tuyệt đối
// với cách giao diện đánh chỉ số nốt (kể cả bài nhiều bè <backup>).
//
//   node tools/xml_chords_to_json.cjs <targets.json> <plan.json>
//
// targets.json: [{ "id": "<songId>", "path": "<đường dẫn tuyệt đối tới file xml>" }]  (do clone_tlh_to_hd.php --export-targets sinh)
// plan.json:    { "<songId>": [{ "measureIdx": 0, "noteIdx": 0, "chord": "Am" }, ...] }  (chỉ gồm bài có hợp âm)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [, , targetsFile, planFile] = process.argv;
if (!targetsFile || !planFile) { console.error('Usage: node tools/xml_chords_to_json.cjs <targets.json> <plan.json>'); process.exit(2); }

(async () => {
  const targets = JSON.parse(fs.readFileSync(targetsFile, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/chord-canvas-xml.js') });
  await page.evaluate(() => { window.__xml = ''; window.Store = { get: () => window.__xml }; });

  const plan = {};
  let withChords = 0, noChords = 0, failed = 0;
  for (const t of targets) {
    try {
      const xml = fs.readFileSync(t.path, 'utf8');
      const chords = await page.evaluate((x) => {
        window.__xml = x;
        return Object.entries(ChordCanvasXML.readXmlChords()).map(([key, chord]) => {
          const [measureIdx, noteIdx] = key.split('_').map(Number);
          return { measureIdx, noteIdx, chord };
        });
      }, xml);
      if (chords.length) { plan[t.id] = chords; withChords++; } else noChords++;
    } catch (err) {
      failed++;
      console.error(`[skip] ${t.id}: ${String(err.message).split('\n')[0]}`);
    }
  }
  await browser.close();
  fs.writeFileSync(planFile, JSON.stringify(plan));
  console.log(`Đã xử lý ${targets.length} bài: ${withChords} có hợp âm trong XML, ${noChords} không có (giữ HD rỗng), ${failed} lỗi đọc.`);
})();
