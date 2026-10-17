/**
 * display-settings.js
 * Quản lý cấu hình hiển thị bản nhạc (Hợp âm & Compact Mode) lưu theo thiết bị (localStorage).
 */
const DisplaySettings = (() => {
  'use strict';

    const CHORD_PREFS_KEY = 'sheetapp_chord_prefs';
    const COMPACT_PREFS_KEY = 'sheetapp_compact_prefs';

    // Giá trị chuẩn ban đầu
    let chordPrefs = {
        size: 2.6,     // Tăng từ 2.2 → 2.6: to hơn, rõ ràng hơn
        yOffset: 1.2,  // Tăng từ 0.8 → 1.2: cao hơn trên khuông nhạc
        color: '#dc2626'
    };


    let compactPrefs = {
        hideBass: true,
        hideVoices: true,
        hideChordNotes: true,
        hideText: true,
        hideTitle: false
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

        if (chkBass) {
            chkBass.checked = compactPrefs.hideBass;
            chkBass.addEventListener('change', _onCompactPrefChanged);
        }
        if (chkVoices) {
            chkVoices.checked = compactPrefs.hideVoices;
            chkVoices.addEventListener('change', _onCompactPrefChanged);
        }
        if (chkChordNotes) {
            chkChordNotes.checked = compactPrefs.hideChordNotes;
            chkChordNotes.addEventListener('change', _onCompactPrefChanged);
        }
        if (chkText) {
            chkText.checked = compactPrefs.hideText;
            chkText.addEventListener('change', _onCompactPrefChanged);
        }
        if (chkTitle) {
            chkTitle.checked = compactPrefs.hideTitle;
            chkTitle.addEventListener('change', _onCompactPrefChanged);
        }

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
                    // Mở chế độ Lời
                    lyricContainer.classList.remove('hidden');
                    const osmd = document.getElementById('osmd-container');
                    if(osmd) osmd.style.display = 'none';
                    btnLyricView.classList.add('active');
                    if (btnText) btnText.textContent = 'Bản Nhạc';
                    // Cập nhật URL
                    window.URLState?.update?.({ v: 'lyric' });
                    try {
                        _renderLyricView();
                    } catch(e) { console.error('Lỗi render LyricView', e); }
                } else {
                    // Quay lại bản nhạc
                    const scrollY = window.scrollY;
                    lyricContainer.classList.add('hidden');
                    const osmd = document.getElementById('osmd-container');
                    if(osmd) osmd.style.display = 'block';
                    btnLyricView.classList.remove('active');
                    if (btnText) btnText.textContent = 'Lời Nhạc';
                    // Cập nhật URL
                    window.URLState?.update?.({ v: 'sheet' });
                    // Re-render OSMD
                    if (window.App?.reloadCurrentXML) {
                        window.App.reloadCurrentXML().then(() => {
                            window.scrollTo(0, scrollY);
                        }).catch(() => {});
                    } else if (window.ChordCanvas) {
                        window.ChordCanvas.reposition();
                    }
                }
            });
        }

    }

    function _loadPrefs() {
        try {
            const cp = localStorage.getItem(CHORD_PREFS_KEY);
            if (cp) {
                const saved = JSON.parse(cp);
                // Migration: nếu size <= 2.2 (giá trị cũ), nâng lên default mới 2.6
                if (saved.size !== undefined && saved.size <= 2.2) {
                    saved.size = 2.6;
                    saved.yOffset = Math.max(saved.yOffset ?? 0.8, 1.2);
                }
                chordPrefs = { ...chordPrefs, ...saved };
            }

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
            // Custom set: inject custom chords, xóa hết harmony gốc
            const customChords = window.ChordCanvas?.getCustomChords?.() || {};

            // Apply transpose vào custom chords trước khi inject
            const trOffset = window.App?.getCurrentTranspose?.() || 0;
            let transposedChords = customChords;
            if (trOffset !== 0 && window.TransposeEngine) {
                transposedChords = {};
                for (const [k, chord] of Object.entries(customChords)) {
                    transposedChords[k] = window.TransposeEngine.transposeChord(chord, trOffset);
                }
            }

            if (window.ChordCanvasXML?.cloneAndInjectChords) {
                // cloneAndInjectChords xóa harmony cũ và inject mới
                return window.ChordCanvasXML.cloneAndInjectChords(rawXml, transposedChords);
            }
        }

        // Default: trả về XML gốc (LyricExtractor sẽ parse harmony tag có sẵn)
        return rawXml;
    }

    function _renderLyricView() {
        const xml = _buildLyricXml();
        const trOffset = window.App?.getCurrentTranspose?.() || 0;
        const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
        // Nếu custom: đã transpose trong _buildLyricXml rồi, truyền 0 vào render
        const renderOffset = (currentSet !== 'default') ? 0 : trOffset;
        window.LyricExtractor?.render?.('lyric-view-container', xml, renderOffset);
    }

    return { init, getChordPrefs, getCompactPrefs, renderLyricViewIfActive: _renderLyricView };
})();

window.DisplaySettings = DisplaySettings;
