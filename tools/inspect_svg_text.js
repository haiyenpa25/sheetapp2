const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem('sheetapp_guest_chosen', '1'));
  await page.goto('http://localhost/sheetapp2/?song=thanh-ca-002');
  await page.waitForSelector('#osmd-container svg');
  await page.waitForTimeout(1000);
  const details = await page.evaluate(() => {
    const svg = document.querySelector('#osmd-container svg');
    const texts = Array.from(svg.querySelectorAll('text'));
    const chordText = texts.find(t => t.textContent.trim() === 'Em');
    const lyricText = texts.find(t => t.textContent.trim().includes('Thờ') || t.textContent.trim() === 'lạy');
    const titleText = texts.find(t => t.classList.contains('osmd-title-text') || t.textContent.trim().includes('THỜ LẠY'));
    
    function dump(el) {
      if (!el) return null;
      return {
        text: el.textContent.trim(),
        tagName: el.tagName,
        attributes: Array.from(el.attributes).map(a => a.name + '=' + a.value),
        parentTag: el.parentElement.tagName,
        parentAttributes: Array.from(el.parentElement.attributes).map(a => a.name + '=' + a.value),
        fontFamily: window.getComputedStyle(el).fontFamily,
        fontSize: window.getComputedStyle(el).fontSize,
        fill: window.getComputedStyle(el).fill
      };
    }
    return {
      chord: dump(chordText),
      lyric: dump(lyricText),
      title: dump(titleText)
    };
  });
  console.log(JSON.stringify(details, null, 2));
  await browser.close();
})();
