const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    sessionStorage.setItem('sheetapp_guest_chosen', '1');
    localStorage.setItem('sheetapp_guest_toast_shown', '1');
    localStorage.setItem('sheetapp_instrument_role', 'guitar');
  });

  await page.goto('http://localhost/sheetapp2/?song=thanh-ca-001', { waitUntil: 'networkidle' });
  await page.waitForSelector('#osmd-container svg', { timeout: 10000 });

  const testTranspose = await page.evaluate(async () => {
    const osmd = window.OSMDRenderer.getInstance();
    
    // Check key signature instruction before
    const keyBefore = osmd.Sheet.SourceMeasures[0].FirstInstructionsOfTypeKeyInstruction?.[0]?.Key;

    // Transpose Sheet by +2
    osmd.TransposeCalculator = new window.opensheetmusicdisplay.TransposeCalculator();
    osmd.Sheet.Transpose = 2;
    await osmd.render();

    const keyAfter = osmd.Sheet.SourceMeasures[0].FirstInstructionsOfTypeKeyInstruction?.[0]?.Key;

    // Check SVG notes or clef/key sharps/flats in first measure
    const svg1 = document.querySelector('#osmd-container svg');
    const sharpSymbols = svg1.querySelectorAll('path[d*="sharp"], path[id*="sharp"]')?.length;

    return { keyBefore, keyAfter, sharpSymbols };
  });

  console.log('Key before & after transpose:', JSON.stringify(testTranspose, null, 2));
  await browser.close();
})();
