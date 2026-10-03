const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const score = `<?xml version="1.0" encoding="utf-8"?>
<score-partwise version="3.1"><work><work-title>Shared voices</work-title></work>
<movement-title>Shared voices</movement-title><identification><creator type="composer">Test</creator></identification>
<defaults><scaling><millimeters>7</millimeters><tenths>40</tenths></scaling></defaults>
<part-list><score-part id="P1"><part-name>Voice</part-name><part-abbreviation>V</part-abbreviation><score-instrument id="I1"><instrument-name>Voice</instrument-name></score-instrument></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><stem>up</stem><tie type="start"/><notations><tied type="start"/><slur number="1" type="start"/></notations><lyric number="1"><syllabic>single</syllabic><text>Xin</text></lyric></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><stem>up</stem><notations><slur number="1" type="stop"/></notations><lyric number="1"><syllabic>single</syllabic><text>chào</text></lyric></note>
<backup><duration>4</duration></backup>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice><type>half</type><stem>down</stem><tie type="start"/><notations><tied type="start"/></notations><lyric number="1"><syllabic>single</syllabic><text>Xin</text></lyric><lyric number="2"><syllabic>single</syllabic><text>Chung</text></lyric></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>2</voice><type>half</type><stem>down</stem><lyric number="2"><syllabic>single</syllabic><text>bè</text></lyric></note>
</measure></part></score-partwise>`;

test('Tối giản giữ tuyến chính, nốt chung, lời và dấu luyến hợp lệ', async ({ page }) => {
  await page.setContent('<div id="score" style="width:800px;height:800px"></div>');
  await page.evaluate(() => {
    window.ResizeObserver = class { observe() {} };
    window.opensheetmusicdisplay = { OpenSheetMusicDisplay: class {
      constructor() { this.rules = {}; this.Sheet = { Instruments: [] }; }
      async load(xml) { this.loadedXml = xml; }
      async render() {}
      setOptions() {}
    } };
    window.DisplaySettings = {
      getCompactPrefs: () => ({ hideBass: true, hideVoices: true, hideChordNotes: true, hideText: true, hideTitle: false, hideLyrics: false, hideMeasureNumbers: false }),
      getChordPrefs: () => ({ size: 2.85, yOffset: 1.4, color: '#dc2626' })
    };
  });
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/osmd-renderer.js') });
  const result = await page.evaluate(async xml => {
    const renderer = window.OSMDRenderer;
    renderer.init('score');
    renderer.setCompactMode(true);
    await renderer.load(xml);
    const doc = new DOMParser().parseFromString(renderer.getInstance().loadedXml, 'application/xml');
    const notes = [...doc.querySelectorAll('part note')].filter(note => note.querySelector('pitch'));
    const pitch = note => `${note.querySelector('step')?.textContent}${note.querySelector('octave')?.textContent}`;
    return {
      pitches: notes.map(pitch),
      shared: notes.filter(note => pitch(note) === 'C4').length,
      lyrics: [...doc.querySelectorAll('lyric text')].map(el => el.textContent),
      ties: doc.querySelectorAll('note > tie, notations tied').length,
      slurs: doc.querySelectorAll('notations slur').length,
      forwards: doc.querySelectorAll('forward duration').length,
    };
  }, score);
  expect(result.pitches).toContain('D4');
  expect(result.pitches).not.toContain('E4');
  expect(result.shared).toBe(1);
  expect(result.lyrics).toEqual(expect.arrayContaining(['Xin', 'Chung', 'chào', 'bè']));
  expect(result.ties).toBe(0);
  expect(result.slurs).toBe(2);
  expect(result.forwards).toBe(2);
});

test('Tối giản chọn nốt cao trong chùm và không chuyển dấu nối khác cao độ', async ({ page }) => {
  await page.setContent('<div id="score" style="width:800px;height:800px"></div>');
  await page.evaluate(() => {
    window.ResizeObserver = class { observe() {} };
    window.opensheetmusicdisplay = { OpenSheetMusicDisplay: class {
      constructor() { this.rules = {}; this.Sheet = { Instruments: [] }; }
      async load(xml) { this.loadedXml = xml; }
      async render() {}
      setOptions() {}
    } };
    window.DisplaySettings = {
      getCompactPrefs: () => ({ hideBass: true, hideVoices: false, hideChordNotes: true, hideText: true, hideTitle: false, hideLyrics: false, hideMeasureNumbers: false }),
      getChordPrefs: () => ({ size: 2.85, yOffset: 1.4, color: '#dc2626' })
    };
  });
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/osmd-renderer.js') });
  const result = await page.evaluate(async xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const first = doc.querySelector('part note');
    const chord = first.cloneNode(true);
    chord.querySelector('pitch step').textContent = 'G';
    chord.insertBefore(doc.createElement('chord'), chord.firstChild);
    chord.querySelectorAll('tie, notations, lyric').forEach(el => el.remove());
    first.after(chord);
    const renderer = window.OSMDRenderer;
    renderer.init('score');
    renderer.setCompactMode(true);
    await renderer.load(new XMLSerializer().serializeToString(doc));
    const processed = new DOMParser().parseFromString(renderer.getInstance().loadedXml, 'application/xml');
    return {
      firstPitch: processed.querySelector('part note pitch step')?.textContent,
      chordPitches: [...processed.querySelectorAll('note[chord], note > chord')].map(el => el.parentElement?.querySelector('pitch step')?.textContent),
      tieCount: processed.querySelectorAll('note > tie, notations tied').length,
      allPitches: [...processed.querySelectorAll('part note pitch step')].map(el => el.textContent),
    };
  }, score);
  expect(result.firstPitch).toBe('G');
  expect(result.allPitches).toContain('G');
  expect(result.tieCount).toBe(0);
});

test('Tối giản không bật lại khóa Fa khi phát hiện lời chồng', async ({ page }) => {
  await page.setContent('<div id="score" style="width:800px;height:800px"></div>');
  await page.evaluate(() => {
    window.ResizeObserver = class { observe() {} };
    const lyrics = Array.from({ length: 5 }, () => ({
      getBoundingClientRect: () => ({ left: 0, right: 40, top: 0, bottom: 20, width: 40, height: 20 })
    }));
    window.OSMDSvgText = { getLyricTextNodes: () => new Set(lyrics) };
    window.opensheetmusicdisplay = { OpenSheetMusicDisplay: class {
      constructor() {
        this.rules = {};
        this.Sheet = { Instruments: [
          { Visible: true, Staves: [{ Visible: true }], Voices: [] },
          { Visible: true, Staves: [{ Visible: true }], Voices: [] }
        ] };
        this.rendered = 0;
      }
      async load() {}
      async render() { this.rendered++; }
      updateGraphic() {}
      setOptions() {}
    } };
    window.DisplaySettings = {
      getCompactPrefs: () => ({ hideBass: true, hideVoices: true, hideChordNotes: true, hideText: true, hideTitle: false, hideLyrics: false, hideMeasureNumbers: false }),
      getChordPrefs: () => ({ size: 2.85, yOffset: 1.4, color: '#dc2626' })
    };
  });
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/osmd-renderer.js') });
  const result = await page.evaluate(async xml => {
    const renderer = OSMDRenderer;
    renderer.init('score');
    renderer.setCompactMode(true);
    await renderer.load(xml);
    return {
      bassVisible: renderer.getInstance().Sheet.Instruments[1].Visible,
      renderCount: renderer.getInstance().rendered,
      overlap: document.getElementById('score').hasAttribute('data-compact-lyrics-overlap')
    };
  }, score);
  expect(result).toEqual({ bassVisible: false, renderCount: 2, overlap: true });
});

test('Nốt chung ở đầu chùm chỉ xuất hiện trên tuyến giai điệu', async ({ page }) => {
  await page.setContent('<div id="score" style="width:800px;height:800px"></div>');
  await page.evaluate(() => {
    window.ResizeObserver = class { observe() {} };
    window.opensheetmusicdisplay = { OpenSheetMusicDisplay: class {
      constructor() { this.rules = {}; this.Sheet = { Instruments: [] }; }
      async load(xml) { this.loadedXml = xml; }
      async render() {}
      setOptions() {}
    } };
    window.DisplaySettings = {
      getCompactPrefs: () => ({ hideBass: true, hideVoices: true, hideChordNotes: true, hideText: true, hideTitle: false, hideLyrics: false, hideMeasureNumbers: false }),
      getChordPrefs: () => ({ size: 2.85, yOffset: 1.4, color: '#dc2626' })
    };
  });
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/osmd-renderer.js') });
  const result = await page.evaluate(async xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const shared = [...doc.querySelectorAll('note')].find(note => note.querySelector('voice')?.textContent === '2');
    const secondPitch = shared.cloneNode(true);
    secondPitch.insertBefore(doc.createElement('chord'), secondPitch.firstChild);
    secondPitch.querySelector('pitch step').textContent = 'G';
    secondPitch.querySelectorAll('tie, notations, lyric').forEach(el => el.remove());
    shared.after(secondPitch);
    OSMDRenderer.init('score');
    OSMDRenderer.setCompactMode(true);
    await OSMDRenderer.load(new XMLSerializer().serializeToString(doc));
    const output = new DOMParser().parseFromString(OSMDRenderer.getInstance().loadedXml, 'application/xml');
    const notes = [...output.querySelectorAll('part note')];
    return {
      sharedCount: notes.filter(note => note.querySelector('pitch step')?.textContent === 'C').length,
      promoted: notes.some(note => note.querySelector('voice')?.textContent === '2'
        && note.querySelector('pitch step')?.textContent === 'G' && !note.querySelector('chord')),
      ties: output.querySelectorAll('note > tie, notations tied').length,
      lyrics: [...output.querySelectorAll('lyric text')].map(el => el.textContent)
    };
  }, score);
  expect(result.sharedCount).toBe(1);
  expect(result.promoted).toBe(false);
  expect(result.ties).toBe(0);
  expect(result.lyrics).toContain('Chung');
});

test('Dấu nối và luyến lấy từ bè chung giữ đúng thứ tự MusicXML', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const result = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const notes = [...doc.querySelectorAll('note')];
    notes[0].querySelector(':scope > tie').remove();
    notes[0].querySelector(':scope > notations').remove();
    notes[1].querySelector('pitch step').textContent = 'C';
    const tieStop = doc.createElement('tie');
    tieStop.setAttribute('type', 'stop');
    notes[1].insertBefore(tieStop, notes[1].querySelector(':scope > voice'));
    const tiedStop = doc.createElement('tied');
    tiedStop.setAttribute('type', 'stop');
    notes[1].querySelector(':scope > notations').insertBefore(tiedStop, notes[1].querySelector(':scope > notations > slur'));
    const slur = doc.createElement('slur');
    slur.setAttribute('type', 'start');
    slur.setAttribute('number', '1');
    notes[2].querySelector('notations').appendChild(slur);
    const output = window.CompactScore.preprocessXML(new XMLSerializer().serializeToString(doc), {
      hideVoices: true, hideChordNotes: true
    });
    const merged = new DOMParser().parseFromString(output, 'application/xml').querySelector('part note');
    return {
      tags: [...merged.children].map(node => node.tagName),
      ties: merged.querySelectorAll(':scope > tie, :scope > notations tied').length,
      slurs: merged.querySelectorAll(':scope > notations slur').length
    };
  }, score);
  expect(result.ties).toBe(2);
  expect(result.slurs).toBe(1);
  expect(result.tags.indexOf('tie')).toBeLessThan(result.tags.indexOf('voice'));
  expect(result.tags.indexOf('notations')).toBeLessThan(result.tags.indexOf('lyric'));
});

test('Một nốt ghi một lần vẫn thuộc cả hai bè khi hai bè nhập lại', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const result = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const measure = doc.querySelector('part measure');
    const notes = [...measure.querySelectorAll(':scope > note')];
    const shared = notes[0].cloneNode(true);
    shared.querySelector('pitch step').textContent = 'F';
    shared.querySelectorAll('tie, notations, lyric').forEach(el => el.remove());
    const backup = doc.createElement('backup');
    const duration = doc.createElement('duration');
    duration.textContent = '4';
    backup.appendChild(duration);
    measure.replaceChildren(measure.querySelector('attributes').cloneNode(true),
      notes[0].cloneNode(true), shared, backup, notes[2].cloneNode(true));
    const source = new XMLSerializer().serializeToString(doc);
    const events = window.CompactScore.getVoiceEvents(source);
    const processed = window.CompactScore.preprocessXML(source, { hideVoices: true, hideChordNotes: true });
    const output = new DOMParser().parseFromString(processed, 'application/xml');
    return {
      shared: events.find(event => event.pitch === 'F/0/4')?.voices,
      split1: events.filter(event => event.voices.includes('1')).map(event => event.pitch),
      split2: events.filter(event => event.voices.includes('2')).map(event => event.pitch),
      renderedF: [...output.querySelectorAll('part note')].filter(note => note.querySelector('pitch step')?.textContent === 'F').length,
      annotation: [...output.querySelectorAll('part note')].find(note => note.querySelector('pitch step')?.textContent === 'F')?.getAttribute('data-sheetapp-voices')
    };
  }, score);
  expect(result.shared).toEqual(['1', '2']);
  expect(result.split1).toContain('F/0/4');
  expect(result.split2).toContain('F/0/4');
  expect(result.renderedF).toBe(1);
  expect(result.annotation).toBe('1,2');
});

test('OSMD nạp và vẽ MusicXML có thông tin nốt dùng chung', async ({ page }) => {
  await page.setContent('<div id="score" style="width:800px;height:800px"></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/vendor/opensheetmusicdisplay.min.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const result = await page.evaluate(async xml => {
    const compact = window.CompactScore.preprocessXML(xml, { hideVoices: true, hideChordNotes: true });
    const osmd = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(document.getElementById('score'), {
      autoResize: false, backend: 'svg'
    });
    await osmd.load(compact);
    await osmd.render();
    return { notes: [...document.querySelectorAll('#score svg')].length, shared: compact.includes('data-sheetapp-voices="1,2"') };
  }, score);
  expect(result).toEqual({ notes: 1, shared: true });
});

test('Không gán nốt cho bè đang nghỉ rõ ràng', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const result = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const measure = doc.querySelector('part measure');
    const voice2 = [...measure.querySelectorAll(':scope > note')].filter(note => note.querySelector('voice')?.textContent === '2');
    const rest = voice2[1].cloneNode(true);
    rest.querySelector('pitch').replaceWith(doc.createElement('rest'));
    rest.querySelectorAll('lyric').forEach(el => el.remove());
    rest.querySelector('duration').textContent = '2';
    voice2[1].replaceWith(rest);
    const events = window.CompactScore.getVoiceEvents(new XMLSerializer().serializeToString(doc));
    return events.find(event => event.pitch === 'D/0/4')?.voices;
  }, score);
  expect(result).toEqual(['1']);
});

test('Bài 021 giữ lời khóa Sol và XML khóa Fa sau khi lọc giai điệu', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const song = fs.readFileSync(path.resolve('storage/Thanh ca/021 CỨU CHÚA SIÊU VIỆT.xml'), 'utf8');
  const result = await page.evaluate(xml => {
    const source = new DOMParser().parseFromString(xml, 'application/xml');
    const compact = new DOMParser().parseFromString(window.CompactScore.preprocessXML(xml, {
      hideVoices: true, hideChordNotes: true
    }), 'application/xml');
    const values = doc => ({
      treblePitches: [...doc.querySelectorAll('part[id="P1"] note pitch')].map(pitch => pitch.textContent.trim()),
      bassPitches: [...doc.querySelectorAll('part[id="P2"] note pitch')].map(pitch => pitch.textContent.trim()),
      trebleLyrics: [...doc.querySelectorAll('part[id="P1"] note lyric text')].map(item => item.textContent).sort(),
      trebleChords: doc.querySelectorAll('part[id="P1"] note > chord').length
    });
    return { source: values(source), compact: values(compact), parseError: compact.querySelector('parsererror')?.textContent || null };
  }, song);
  expect(result.parseError).toBeNull();
  expect(result.compact.treblePitches.length).toBeLessThan(result.source.treblePitches.length);
  expect(result.compact.bassPitches).toEqual(result.source.bassPitches);
  expect(result.compact.trebleLyrics).toEqual(result.source.trebleLyrics);
  expect(result.compact.trebleChords).toBe(0);
});

test('Tối giản bài 021 chỉ giữ tuyến giai điệu khóa Sol và chuyển lời lên nốt được giữ', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const song = fs.readFileSync(path.resolve('storage/Thanh ca/021 CỨU CHÚA SIÊU VIỆT.xml'), 'utf8');
  const result = await page.evaluate(xml => {
    const compact = window.CompactScore.preprocessXML(xml, { hideVoices: true, hideChordNotes: true });
    const doc = new DOMParser().parseFromString(compact, 'application/xml');
    const first = doc.querySelector('part[id="P1"] measure');
    const notes = [...first.querySelectorAll(':scope > note')].filter(note => note.querySelector('pitch'));
    return {
      pitches: notes.map(note => `${note.querySelector('pitch step').textContent}${note.querySelector('pitch octave').textContent}`),
      lyrics: notes.map(note => [...note.querySelectorAll('lyric text')].map(item => item.textContent)),
      chords: doc.querySelectorAll('part[id="P1"] note > chord').length
    };
  }, song);
  expect(result.pitches).toEqual(['G4', 'A4']);
  expect(result.lyrics[0]).toContain('1.Jê');
  expect(result.lyrics[1]).toContain('sus,');
  expect(result.chords).toBe(0);
});

test('Tối giản bỏ nốt hòa âm khác cao độ nhưng giữ nốt chung một lần', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  const result = await page.evaluate(xml => {
    const compact = window.CompactScore.preprocessXML(xml, { hideVoices: true, hideChordNotes: true });
    const doc = new DOMParser().parseFromString(compact, 'application/xml');
    const notes = [...doc.querySelectorAll('part note')].filter(note => note.querySelector('pitch'));
    return {
      pitches: notes.map(note => note.querySelector('pitch step')?.textContent),
      lyrics: notes.map(note => [...note.querySelectorAll('lyric text')].map(item => item.textContent)),
      sharedVoices: notes[0]?.getAttribute('data-sheetapp-voices')
    };
  }, score);
  expect(result.pitches).toEqual(['C', 'D']);
  expect(result.lyrics[0]).toEqual(expect.arrayContaining(['Xin', 'Chung']));
  expect(result.sharedVoices).toBe('1,2');
});

for (const [width, songNumber] of [[320, '011'], [390, '021'], [1366, '021']]) {
  test(`Tối giản bài ${songNumber} ở ${width}px: một khuông, lời không chồng`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent('<div class="sheet-viewer-wrapper" style="width:100%;height:900px"><div id="score" class="osmd-container"></div></div>');
    await page.addStyleTag({ path: path.resolve('assets/css/sheet.css') });
    await page.evaluate(() => {
      window.DisplaySettings = {
        getCompactPrefs: () => ({ hideBass: true, hideVoices: true, hideChordNotes: true, hideText: true,
          hideTitle: false, hideLyrics: false, hideMeasureNumbers: false }),
        getChordPrefs: () => ({ size: 2.85, yOffset: 1.4, color: '#dc2626' })
      };
    });
    for (const file of ['assets/js/vendor/opensheetmusicdisplay.min.js', 'assets/js/core/XmlDocCache.js',
      'assets/js/osmd-svg-text.js', 'assets/js/compact-score.js', 'assets/js/osmd-renderer.js']) {
      await page.addScriptTag({ path: path.resolve(file) });
    }
    const songFile = fs.readdirSync(path.resolve('storage/Thanh ca')).find(name => name.startsWith(`${songNumber} `) && name.endsWith('.xml'));
    const song = fs.readFileSync(path.resolve('storage/Thanh ca', songFile), 'utf8');
    const metrics = await page.evaluate(async xml => {
      window.OSMDRenderer.init('score');
      window.OSMDRenderer.setCompactMode(true);
      await window.OSMDRenderer.load(xml);
      const osmd = window.OSMDRenderer.getInstance();
      const lyrics = [...window.OSMDSvgText.getLyricTextNodes(osmd)]
        .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      let overlapPairs = 0;
      for (let i = 0; i < lyrics.length; i++) for (let j = i + 1; j < lyrics.length; j++) {
        if (Math.min(lyrics[i].right, lyrics[j].right) - Math.max(lyrics[i].left, lyrics[j].left) > 3
            && Math.min(lyrics[i].bottom, lyrics[j].bottom) - Math.max(lyrics[i].top, lyrics[j].top) > 3) overlapPairs++;
      }
      return {
        bassVisible: osmd.Sheet.Instruments[1].Visible,
        overlapPairs,
        scoreWidth: document.getElementById('score').clientWidth,
        scrollable: window.getComputedStyle(document.querySelector('.sheet-viewer-wrapper')).overflowX === 'auto',
        svgCount: document.querySelectorAll('#score svg').length
      };
    }, song);
    expect(metrics.bassVisible).toBe(false);
    expect(metrics.overlapPairs).toBe(0);
    expect(metrics.svgCount).toBe(1);
    if (width === 320) {
      expect(metrics.scoreWidth).toBeGreaterThanOrEqual(370);
      expect(metrics.scrollable).toBe(true);
    }
  });
}

test('Trang Thư viện bật và tắt Tối giản khôi phục bản nhạc gốc', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('sheetapp_guest_chosen', '1');
    localStorage.setItem('sheetapp_guest_toast_shown', '1');
  });
  const base = process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost/sheetapp2/';
  await page.goto(new URL('?song=thanh-ca-021&v=sheet', base).toString(), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  const normalBass = await page.evaluate(() => window.OSMDRenderer.getInstance().Sheet.Instruments[1].Visible);
  expect(normalBass).toBe(true);
  await page.evaluate(() => {
    const osmd = window.OSMDRenderer.getInstance();
    const load = osmd.load.bind(osmd);
    osmd.load = async xml => { window.__compactLoadedXml = xml; return load(xml); };
  });
  await page.locator('#btn-more-options').click();
  await page.locator('#btn-compact-mode').click();
  await expect.poll(() => page.evaluate(() => window.OSMDRenderer.getCompactMode())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.OSMDRenderer.getInstance().Sheet.Instruments[1].Visible)).toBe(false);
  const compact = await page.evaluate(() => {
    const doc = new DOMParser().parseFromString(window.__compactLoadedXml, 'application/xml');
    return {
      melodyNotes: doc.querySelectorAll('part[id="P1"] note pitch').length,
      chords: doc.querySelectorAll('part[id="P1"] note > chord').length,
      bassHidden: !window.OSMDRenderer.getInstance().Sheet.Instruments[1].Visible
    };
  });
  expect(compact).toEqual({ melodyNotes: 79, chords: 0, bassHidden: true });
  await page.locator('#btn-more-options').click();
  await page.locator('#btn-compact-mode').click();
  await expect.poll(() => page.evaluate(() => window.OSMDRenderer.getCompactMode())).toBe(false);
  await expect.poll(() => page.evaluate(() => window.OSMDRenderer.getInstance().Sheet.Instruments[1].Visible)).toBe(true);
});

test('Tối giản giữ đủ lời nhiều phiên khúc trên nốt chùm', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve('assets/js/compact-score.js') });
  for (const songNumber of ['820', '901']) {
    const songFile = fs.readdirSync(path.resolve('storage/Thanh ca')).find(name => name.startsWith(`${songNumber} `) && name.endsWith('.xml'));
    const song = fs.readFileSync(path.resolve('storage/Thanh ca', songFile), 'utf8');
    const result = await page.evaluate(xml => {
      const source = new DOMParser().parseFromString(xml, 'application/xml');
      const compact = new DOMParser().parseFromString(window.CompactScore.preprocessXML(xml, {
        hideVoices: true, hideChordNotes: true
      }), 'application/xml');
      const lyrics = doc => [...doc.querySelectorAll('part[id="P1"] note lyric text')].map(node => node.textContent).sort();
      return { source: lyrics(source), compact: lyrics(compact) };
    }, song);
    expect(result.compact).toEqual(result.source);
  }
});
