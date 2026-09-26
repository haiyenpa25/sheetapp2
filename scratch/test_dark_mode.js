const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.addInitScript(() => sessionStorage.setItem('sheetapp_guest_chosen', '1'));
  await page.goto('http://localhost/sheetapp2/?song=thanh-ca-001');
  await page.waitForSelector('.cc-custom-chord-text');
  await page.waitForTimeout(500);

  // Apply new real dark mode CSS
  await page.evaluate(() => {
    document.body.classList.add('dark-mode');
    const style = document.createElement('style');
    style.id = 'test-real-dark-mode';
    style.textContent = `
      body.dark-mode {
        background-color: #0B0B0C !important;
        color: #E8E2D0 !important;
      }
      body.dark-mode .sheet-viewer-wrapper,
      body.dark-mode .sheet-area,
      body.dark-mode .osmd-container,
      body.dark-mode #osmd-container,
      body.dark-mode #osmd-container svg {
        background-color: #0B0B0C !important;
        filter: none !important;
      }
      body.dark-mode #osmd-container svg path:not([fill="none"]),
      body.dark-mode #osmd-container svg rect:not([fill="none"]),
      body.dark-mode #osmd-container svg ellipse,
      body.dark-mode #osmd-container svg polygon {
        fill: #E8E2D0 !important;
      }
      body.dark-mode #osmd-container svg path[fill="none"][stroke],
      body.dark-mode #osmd-container svg line[stroke] {
        stroke: #E8E2D0 !important;
      }
      body.dark-mode #osmd-container svg text:not(.osmd-chord-text):not(.cc-custom-chord-text) {
        fill: #E8E2D0 !important;
      }
      body.dark-mode #osmd-container svg .osmd-chord-text {
        fill: #FBBF24;
      }
      body.dark-mode .cc-custom-chord-text {
        fill: #FBBF24 !important;
        color: #FBBF24 !important;
      }
      body.dark-mode .cc-dot-btn {
        background: rgba(251, 191, 36, 0.15) !important;
        border-color: #FBBF24 !important;
      }
    `;
    document.head.appendChild(style);

    // Ensure cc-custom-style has body prefix so transparent !important takes precedence
    const ccStyle = document.getElementById('cc-custom-style');
    if (ccStyle && ccStyle.textContent) {
      ccStyle.textContent = 'body ' + ccStyle.textContent;
    }
  });

  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/real-dark-mode-test2.png' });
  console.log('Screenshot saved to test-results/real-dark-mode-test2.png');
  await browser.close();
})();
