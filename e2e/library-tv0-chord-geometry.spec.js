const { test, expect } = require('@playwright/test');
const path = require('path');
for (const classic of [false, true]) for (const scale of [0.75, 1, 1.5]) {
  test(`${classic ? 'Classic' : 'Modern'} chord boxes avoid notes and each other at scale ${scale}`, async ({ page }) => {
    await page.setContent('<div id="osmd-container" style="position:relative;width:900px;height:500px"><svg width="900" height="400"><g class="vf-stave"><rect x="0" y="200" width="800" height="40"/></g><g class="vf-stavenote"><rect x="100" y="170" width="12" height="50"/></g><g class="vf-stavenote"><rect x="200" y="180" width="12" height="40"/></g></svg></div>');
    await page.evaluate(zoom => { window.ChordCanvasUI = { getScale: () => zoom }; }, scale);
    await page.addScriptTag({ path: path.resolve(__dirname, classic ? '../old/assets/js/chord-canvas-dots.js' : '../assets/js/chord-canvas-dots.js') });
    const boxes = await page.evaluate(zoom => {
      const container = document.getElementById('osmd-container');
      for (const left of [106, 110, 116]) {
        const badge = document.createElement('span');
        badge.className = 'cc-custom-chord-text';
        badge.textContent = 'F#m7/C#';
        badge.dataset.noteTop = '170';
        badge.style.cssText = `position:absolute;left:${left}px;top:140px;transform:translateX(-50%);font-size:${18 * zoom}px;line-height:1`;
        container.appendChild(badge);
      }
      ChordCanvasDots.alignDOMChords();
      const rect = element => { const box = element.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }; };
      return { badges: [...container.querySelectorAll('.cc-custom-chord-text')].map(rect), notes: [...container.querySelectorAll('.vf-stavenote')].map(rect) };
    }, scale);
    const clearance = Math.max(4, Math.round(6 * scale));
    for (const badge of boxes.badges) for (const note of boxes.notes) expect(badge.bottom).toBeLessThanOrEqual(note.top - clearance + 1);
    for (let i = 1; i < boxes.badges.length; i++) expect(boxes.badges[i].left - boxes.badges[i - 1].right).toBeGreaterThanOrEqual(clearance - 1);
  });
}

test('Modern chord font follows the selected preset and remains bounded across zoom', async ({ page }) => {
  await page.setContent('<div id="osmd-container" style="position:relative;width:900px;height:500px"></div><span id="note">♪</span>');
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/chord-canvas-dots.js') });
  const sizes = await page.evaluate(() => {
    const note = document.getElementById('note');
    let scale = 1, preset = 'standard';
    window.ChordCanvasUI = { getScale: () => scale, getDotSize: () => 10 };
    window.DisplaySettings = { getChordPreset: () => preset };
    return [0.4, 1, 2].map(zoom => {
      scale = zoom;
      return ['standard', 'high_contrast', 'stage'].map(name => {
        preset = name;
        ChordCanvasDots.placeDot({ el: note, rect: note.getBoundingClientRect(), measureIdx: 0, noteIdx: 0, chord: 'G' }, new Map());
        return parseFloat(document.querySelector('.cc-custom-chord-text:last-child').style.fontSize);
      });
    });
  });
  for (const [standard, contrast, stage] of sizes) {
    expect(standard).toBeGreaterThanOrEqual(11);
    expect(contrast).toBeGreaterThanOrEqual(standard);
    expect(stage).toBeGreaterThanOrEqual(contrast);
    expect(stage).toBeLessThanOrEqual(34);
  }
});
