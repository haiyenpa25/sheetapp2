/**
 * display-settings.js
 * Quản lý cấu hình hiển thị bản nhạc (Hợp âm & Compact Mode) lưu theo thiết bị (localStorage).
 */
const DisplaySettings = (() => {
  'use strict';

    const CHORD_PREFS_KEY = 'sheetapp_chord_prefs';
    const COMPACT_PREFS_KEY = 'sheetapp_compact_prefs';
    const CHORD_PRESET_KEY = 'sheetapp_chord_preset';

    const CHORD_PRESETS = {
        standard: {
            id: 'standard',
            name: 'Chuẩn',
            label: 'Chuẩn',
            size: 2.85,
            yOffset: 1.2,
            color: '#dc2626',
            fontWeight: 'normal',
            highContrast: false,
            desc: 'Cỡ chuẩn 1.35x, màu đỏ'
        },
        stage: {
            id: 'stage',
            name: 'Sân khấu lớn',
            label: 'Sân khấu',
            size: 4.56,
            yOffset: 1.5,
            color: '#ea580c',
            fontWeight: '800',
            highContrast: false,
            desc: 'Cỡ lớn 1.6x, chữ đậm cho giá nhạc'
        },
        high_contrast: {
            id: 'high_contrast',
            name: 'Tương phản cao',
            label: 'Tương phản',
            size: 3.8,
            yOffset: 1.4,
            color: '#fbbf24',
            fontWeight: '800',
            highContrast: true,
            desc: 'Nền pill tối, chữ hổ phách sáng'
        }
    };

    let currentPreset = 'standard';

    // Giá trị chuẩn ban đầu
    let chordPrefs = {
        size: 2.85,    // Tăng lên 2.85: đảm bảo tỉ lệ hợp âm/lời >= 1.35
        yOffset: 1.2,  // Tăng từ 0.8 → 1.2: cao hơn trên khuông nhạc
        color: '#dc2626',
        preset: 'standard'
    };

    function _applyPresetDOMClasses(preset) {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('osmd-container');
        document.body?.classList.remove('chord-preset-standard', 'chord-preset-stage', 'chord-preset-high-contrast');
        document.body?.classList.add(`chord-preset-${preset.id.replace('_', '-')}`);
        if (container) {
            container.classList.remove('chord-preset-standard', 'chord-preset-stage', 'chord-preset-high-contrast');
            container.classList.add(`chord-preset-${preset.id.replace('_', '-')}`);
        }
    }

    function _updatePresetUI() {
        if (typeof document === 'undefined') return;
        const btn = document.getElementById('btn-chord-preset');
        const lbl = document.getElementById('chord-preset-label');
        const p = CHORD_PRESETS[currentPreset] || CHORD_PRESETS.standard;
        if (lbl) lbl.textContent = p.label || p.name;
        if (btn) {
            btn.setAttribute('title', `Preset hiển thị hợp âm: ${p.name} (${p.desc}). Bấm để đổi (Aa)`);
            btn.setAttribute('data-preset', currentPreset);
        }
    }

    function _applyPreset(presetId, save = true) {
        if (!CHORD_PRESETS[presetId]) presetId = 'standard';
        currentPreset = presetId;
        const p = CHORD_PRESETS[presetId];
        chordPrefs.size = p.size;
        chordPrefs.yOffset = p.yOffset;
        chordPrefs.color = p.color;
        chordPrefs.preset = presetId;

        if (save) {
            try {
                localStorage.setItem(CHORD_PRESET_KEY, presetId);
                localStorage.setItem(CHORD_PREFS_KEY, JSON.stringify(chordPrefs));
            } catch(e) { console.warn(e); }
        }

        _updatePresetUI();
        _applyPresetDOMClasses(p);

        if (typeof window !== 'undefined' && window.OSMDRenderer && window.OSMDRenderer.getIsLoaded?.()) {
            window.OSMDRenderer.refreshRules?.();
            if (save && window.App?.reloadCurrentXML) {
                window.App.reloadCurrentXML().catch(() => {});
            } else if (window.ChordCanvas?.reposition) {
                window.ChordCanvas.reposition();
            }
        }
    }

    function cyclePreset() {
        const keys = ['standard', 'stage', 'high_contrast'];
        const idx = keys.indexOf(currentPreset);
        const nextPreset = keys[(idx + 1) % keys.length];
        _applyPreset(nextPreset, true);
        const p = CHORD_PRESETS[nextPreset];
        if (typeof window !== 'undefined' && window.AppUI?.showToast) {
            window.AppUI.showToast(`🎸 Preset hợp âm: ${p.name}`, 'info');
        }
        return nextPreset;
    }

    function setChordPreset(presetId) {
        _applyPreset(presetId, true);
        return currentPreset;
    }

    function getChordPreset() {
        return currentPreset;
    }

    function getChordPresets() {
        return CHORD_PRESETS;
    }


    let compactPrefs = {
        hideBass: true,
        hideVoices: true,
        hideChordNotes: true,
        hideText: true,
        hideTitle: false,
        hideLyrics: false,
        hideMeasureNumbers: false
    };


    let previewOsmd = null;
    let previewTimeout = null;

    // Một bản nhạc siêu nhỏ để test hợp âm
    const dummyXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <harmony>
        <root><root-step>C</root-step></root>
        <kind>major</kind>
      </harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <harmony>
        <root><root-step>D</root-step></root>
        <kind>minor</kind>
      </harmony>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <harmony>
        <root><root-step>F</root-step></root>
        <kind>major</kind>
      </harmony>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

    function init() {
        _loadPrefs();

        // 0. Gắn sự kiện cho Toolbar Chord Preset (Aa) (Ticket L1-2)
        const btnChordPreset = document.getElementById('btn-chord-preset');
        if (btnChordPreset && !btnChordPreset.dataset.boundPreset) {
            btnChordPreset.dataset.boundPreset = 'true';
            btnChordPreset.addEventListener('click', (e) => {
                e.preventDefault();
                cyclePreset();
            });
        }

        // 1. Gắn sự kiện cho Toolbar Compact Dropdown
        const btnCompactSettings = document.getElementById('btn-compact-settings');
        const compactPanel = document.getElementById('compact-settings-panel');
        if (btnCompactSettings && compactPanel) {
            btnCompactSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = compactPanel.classList.contains('hidden');
                if (isHidden) {
                    if (compactPanel.parentNode !== document.body) {
                        document.body.appendChild(compactPanel);
                    }
                    compactPanel.classList.remove('hidden');
                    // Positioning Fixed for mobile/tablet escape
                    const rect = btnCompactSettings.getBoundingClientRect();
                    const menuW = compactPanel.offsetWidth || 220;
                    let left = rect.right - menuW;
                    if (left < 8) left = 8;
                    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
                    
                    compactPanel.style.position = 'fixed';
                    compactPanel.style.top = (rect.bottom + 8) + 'px';
                    compactPanel.style.left = left + 'px';
                    compactPanel.style.right = 'auto';
                    compactPanel.style.zIndex = '99999';
                } else {
                    compactPanel.classList.add('hidden');
                }
            });
            // Click ra ngoài để ẩn
            document.addEventListener('click', (e) => {
                if (!btnCompactSettings.contains(e.target) && !compactPanel.contains(e.target)) {
                    compactPanel.classList.add('hidden');
                }
            });
            
            // Xử lý scroll để menu trôi theo hoặc tắt (Throttled)
            let _ticking = false;
            window.addEventListener('scroll', () => {
                if (!_ticking) {
                    window.requestAnimationFrame(() => {
                        if (!compactPanel.classList.contains('hidden')) {
                            compactPanel.classList.add('hidden');
                        }
                        _ticking = false;
                    });
                    _ticking = true;
                }
            }, { passive: true });
        }

        // Gắn sự kiện cho Audio Settings Dropdown
        const btnAudioSettings = document.getElementById('btn-audio-settings');
        const audioPanel = document.getElementById('audio-settings-panel');
        if (btnAudioSettings && audioPanel) {
            btnAudioSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = audioPanel.classList.contains('hidden');
                if (isHidden) {
                    if (audioPanel.parentNode !== document.body) {
                        document.body.appendChild(audioPanel);
                    }
                    audioPanel.classList.remove('hidden');
                    // Position under the button
                    const rect = btnAudioSettings.getBoundingClientRect();
                    const menuW = audioPanel.offsetWidth || 240;
                    let left = rect.right - menuW;
                    if (left < 8) left = 8;
                    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
                    
                    audioPanel.style.position = 'fixed';
                    audioPanel.style.top = (rect.bottom + 8) + 'px';
                    audioPanel.style.left = left + 'px';
                    audioPanel.style.right = 'auto';
                    audioPanel.style.zIndex = '99999';
                } else {
                    audioPanel.classList.add('hidden');
                }
            });
            // Click ra ngoài để ẩn
            document.addEventListener('click', (e) => {
                if (!btnAudioSettings.contains(e.target) && !audioPanel.contains(e.target)) {
                    audioPanel.classList.add('hidden');
                }
            });
            // Ẩn khi scroll
            window.addEventListener('scroll', () => {
                if (!audioPanel.classList.contains('hidden')) {
                    audioPanel.classList.add('hidden');
                }
            }, { passive: true });
        }

        const chkBass = document.getElementById('chk-compact-bass');
        const chkVoices = document.getElementById('chk-compact-voices');
        const chkChordNotes = document.getElementById('chk-compact-chordnotes');
        const chkText = document.getElementById('chk-compact-texts');
        const chkTitle = document.getElementById('chk-compact-title');
        const chkLyrics = document.getElementById('chk-compact-lyrics');
        const chkMeasures = document.getElementById('chk-compact-measures');

        if (chkBass) {
            chkBass.checked = compactPrefs.hideBass;
            chkBass.addEventListener('change', _onCompactPrefChanged);
        }
        [
            [chkVoices, 'hideVoices'], [chkChordNotes, 'hideChordNotes'],
            [chkLyrics, 'hideLyrics'], [chkMeasures, 'hideMeasureNumbers'],
            [chkText, 'hideText'], [chkTitle, 'hideTitle']
        ].forEach(([el, key]) => {
            if (el) { el.checked = compactPrefs[key]; el.addEventListener('change', _onCompactPrefChanged); }
        });


        // 2. Gắn sự kiện cho Admin Tab
        document.getElementById('chord-size-slider')?.addEventListener('input', _onChordPrefPreview);
        document.getElementById('chord-y-slider')?.addEventListener('input', _onChordPrefPreview);
        document.getElementById('chord-color-picker')?.addEventListener('input', _onChordPrefPreview);

        document.getElementById('btn-reset-chord-settings')?.addEventListener('click', resetChordPrefs);
        document.getElementById('btn-save-chord-settings')?.addEventListener('click', saveChordPrefs);

        // Lắng nghe khi Admin Tab mở để vẽ preview, đóng thì dọn rác
        const tabs = document.querySelectorAll('.admin-tab-btn');
        tabs.forEach(t => {
            t.addEventListener('click', () => {
                if (t.dataset.target === 'admin-tab-chords') {
                    // Update UI form with current loaded values
                    _updateChordAdminUI();
                    _renderPreviewCanvas();
                } else {
                    if (previewOsmd && previewOsmd.clear) previewOsmd.clear();
                }
            });
        });

        // 3. Logic bật/tắt Giao diện Lời Nhạc
        const btnLyricView = document.getElementById('btn-lyric-view');
        if (btnLyricView) {
            btnLyricView.addEventListener('click', () => {
                const lyricContainer = document.getElementById('lyric-view-container');
                const btnText = btnLyricView.querySelector('.btn-text');

                if (lyricContainer.classList.contains('hidden')) {
                    // Mở chế độ Lời / Band
                    lyricContainer.classList.remove('hidden');
                    const osmd = document.getElementById('osmd-container');
                    if(osmd) osmd.style.display = 'none';
                    btnLyricView.classList.add('active');
                    if (btnText) btnText.textContent = 'Bản Nhạc';
                    // Cập nhật URL & lưu lựa chọn thiết bị
                    window.URLState?.update?.({ v: 'lyric' });
                    localStorage.setItem('sheetapp_view_mode', 'band');
                    try {
                        _renderLyricView();
                        setTimeout(() => window.PageNav?.computePages?.(), 100);
                    } catch(e) { console.error('Lỗi render LyricView', e); }
                } else {
                    // Quay lại bản nhạc
                    const scrollY = window.scrollY;
                    lyricContainer.classList.add('hidden');
                    const osmd = document.getElementById('osmd-container');
                    if(osmd) osmd.style.display = 'block';
                    btnLyricView.classList.remove('active');
                    if (btnText) btnText.textContent = 'Lời Nhạc';
                    // Cập nhật URL & lưu lựa chọn thiết bị
                    window.URLState?.update?.({ v: 'sheet' });
                    localStorage.setItem('sheetapp_view_mode', 'sheet');
                    // Re-render OSMD
                    if (window.App?.reloadCurrentXML) {
                        window.App.reloadCurrentXML().then(() => {
                            window.scrollTo(0, scrollY);
                            setTimeout(() => window.PageNav?.computePages?.(), 150);
                        }).catch(() => {});
                    } else if (window.ChordCanvas) {
                        window.ChordCanvas.reposition();
                        setTimeout(() => window.PageNav?.computePages?.(), 150);
                    }
                }
            });
        }

    }

    function _loadPrefs() {
        try {
            const savedPreset = localStorage.getItem(CHORD_PRESET_KEY);
            if (savedPreset && CHORD_PRESETS[savedPreset]) {
                currentPreset = savedPreset;
            } else {
                currentPreset = 'standard';
            }

            const cp = localStorage.getItem(CHORD_PREFS_KEY);
            if (cp) {
                const saved = JSON.parse(cp);
                if (saved.preset && CHORD_PRESETS[saved.preset]) {
                    currentPreset = saved.preset;
                }
                chordPrefs = { ...chordPrefs, ...saved };
            }
            _applyPreset(currentPreset, false);

            const comp = localStorage.getItem(COMPACT_PREFS_KEY);
            if (comp) compactPrefs = { ...compactPrefs, ...JSON.parse(comp) };
        } catch(e) {
            console.error(e);
        }
    }

    function _onCompactPrefChanged() {
        compactPrefs.hideBass = document.getElementById('chk-compact-bass')?.checked ?? true;
        compactPrefs.hideVoices = document.getElementById('chk-compact-voices')?.checked ?? true;
        compactPrefs.hideChordNotes = document.getElementById('chk-compact-chordnotes')?.checked ?? true;
        compactPrefs.hideText = document.getElementById('chk-compact-texts')?.checked ?? true;
        compactPrefs.hideTitle = document.getElementById('chk-compact-title')?.checked ?? false;
        compactPrefs.hideLyrics = document.getElementById('chk-compact-lyrics')?.checked ?? false;
        compactPrefs.hideMeasureNumbers = document.getElementById('chk-compact-measures')?.checked ?? false;

        
        localStorage.setItem(COMPACT_PREFS_KEY, JSON.stringify(compactPrefs));

        // Báo cho OSMD Renderer tải lại liền nếu đang bật Gọn Nhẹ
        if (window.OSMDRenderer && OSMDRenderer.getIsLoaded() && OSMDRenderer.getCompactMode()) {
            if (window.App && window.App.showToast) App.showToast('Áp dụng tuỳ chọn thu gọn...', 'info');
            App.reloadCurrentXML();
        }
    }

    function getChordPrefs() {
        return chordPrefs;
    }

    function getCompactPrefs() {
        return compactPrefs;
    }

    // --- LOGIC PREVIEW ADMIN ---
    
    function _updateChordAdminUI() {
        const sizeInput = document.getElementById('chord-size-slider');
        const yInput = document.getElementById('chord-y-slider');
        const colorInput = document.getElementById('chord-color-picker');
        
        if (sizeInput) sizeInput.value = chordPrefs.size;
        if (yInput) yInput.value = chordPrefs.yOffset;
        if (colorInput) colorInput.value = chordPrefs.color;

        document.getElementById('lbl-chord-size').textContent = chordPrefs.size;
        document.getElementById('lbl-chord-y').textContent = chordPrefs.yOffset;
    }

    function _onChordPrefPreview() {
        const sizeInput = document.getElementById('chord-size-slider');
        const size = sizeInput ? parseFloat(sizeInput.value) : 3.0;
        const yInput = document.getElementById('chord-y-slider');
        const y = yInput ? parseFloat(yInput.value) : 1.5;
        const colorInput = document.getElementById('chord-color-picker');
        const color = colorInput ? colorInput.value : '#dc2626';

        const sizeLabel = document.getElementById('lbl-chord-size');
        const yLabel = document.getElementById('lbl-chord-y');
        if (sizeLabel) sizeLabel.textContent = size;
        if (yLabel) yLabel.textContent = y;

        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            _renderPreviewCanvas(size, y, color);
        }, 150);
    }

    async function _renderPreviewCanvas(s = chordPrefs.size, y = chordPrefs.yOffset, c = chordPrefs.color) {
        const container = document.getElementById('osmd-chord-preview-container');
        if (!container) return;

        if (!previewOsmd) {
            previewOsmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
                backend: 'svg',
                drawTitle: false,
                drawComposer: false,
                drawSubtitle: false,
                drawLyricist: false,
                drawPartNames: false,
                coloringEnabled: true
            });
        }

        if (previewOsmd.rules) {
            previewOsmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif";
            previewOsmd.rules.ChordSymbolTextHeight = s;
            previewOsmd.rules.ChordSymbolYOffset = y;
            previewOsmd.rules.DefaultColorChordSymbol = c;
        }

        try {
            await previewOsmd.load(dummyXML);
            await previewOsmd.render();
        } catch(e) {
            console.error('Preview error', e);
        }
    }

    function saveChordPrefs() {
        const sizeInput = document.getElementById('chord-size-slider');
        chordPrefs.size = sizeInput ? parseFloat(sizeInput.value) : 3.0;
        const yInput = document.getElementById('chord-y-slider');
        chordPrefs.yOffset = yInput ? parseFloat(yInput.value) : 1.5;
        const colorInput = document.getElementById('chord-color-picker');
        chordPrefs.color = colorInput ? colorInput.value : '#dc2626';

        localStorage.setItem(CHORD_PREFS_KEY, JSON.stringify(chordPrefs));

        if (window.AppUI) window.AppUI.showToast('✅ Đã lưu cấu hình thiết bị hiện tại', 'success');
        
        // Cập nhật màn hình chính ngay lập tức
        if (window.OSMDRenderer && OSMDRenderer.getIsLoaded()) {
            App.reloadCurrentXML();
        }
    }

    function resetChordPrefs() {
        chordPrefs = { size: 3.0, yOffset: 1.5, color: '#dc2626' };
        _updateChordAdminUI();
        _onChordPrefPreview();
    }

    /**
     * Build XML đúng với chord set hiện tại.
     * - Nếu đang dùng custom set (VD: Hoài Dinh): lấy customChords inject vào XML gốc
     * - Nếu default: dùng XML gốc (có harmony tag sẵn)
     */
    function _buildLyricXml() {
        const rawXml = window.App?.getOriginalXml?.();
        if (!rawXml) return rawXml;

        const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';

        if (currentSet !== 'default') {
            const customChords = window.ChordCanvas?.getCustomChords?.() || {};

            // Core Rule 1 Fallback: Nếu bộ tùy biến (HD) rỗng, không xóa XML gốc mà giữ nguyên TLH
            if (Object.keys(customChords).length > 0) {
                // Apply transpose và capo vào custom chords trước khi inject
                const trOffset = window.App?.getCurrentTranspose?.() || 0;
                const capo = window.Store?.get?.('capoLevel') || 0;
                const chordShift = trOffset - capo;
                let transposedChords = customChords;
                if (chordShift !== 0 && window.TransposeEngine) {
                    transposedChords = {};
                    for (const [k, chord] of Object.entries(customChords)) {
                        transposedChords[k] = window.TransposeEngine.transposeChord(chord, chordShift);
                    }
                }

                if (window.ChordCanvasXML?.cloneAndInjectChords) {
                    return window.ChordCanvasXML.cloneAndInjectChords(rawXml, transposedChords);
                }
            }
        }

        // Default: trả về XML gốc (LyricExtractor sẽ parse harmony tag có sẵn)
        return rawXml;
    }

    function _renderLyricView() {
        const xml = _buildLyricXml();
        const trOffset = window.App?.getCurrentTranspose?.() || 0;
        const capo = window.Store?.get?.('capoLevel') || 0;
        const chordShift = trOffset - capo;
        const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
        const customChords = window.ChordCanvas?.getCustomChords?.() || {};
        const hasCustomChords = currentSet !== 'default' && Object.keys(customChords).length > 0;
        // Nếu custom set có hợp âm riêng: đã transpose trong _buildLyricXml
        // Nếu default hoặc custom rỗng (fallback TLH): truyền chordShift để LyricExtractor dịch hợp âm gốc thành thế bấm
        const renderOffset = hasCustomChords ? 0 : chordShift;
        window.LyricExtractor?.render?.('lyric-view-container', xml, renderOffset);
    }

    return {
        init,
        getChordPrefs,
        getCompactPrefs,
        renderLyricViewIfActive: _renderLyricView,
        setChordPreset,
        getChordPreset,
        getChordPresets,
        cyclePreset
    };
})();

window.DisplaySettings = DisplaySettings;
