<?php
/**
 * tests/library_l12_chord_presets_regression.php
 *
 * Kiểm tra chặn tái phát Ticket L1-2 (ROADMAP4.md):
 * 1. Nút Aa (btn-chord-preset) trên thanh công cụ: icon Aa, nhãn preset.
 * 2. Ba preset hiển thị hợp âm được định nghĩa đầy đủ trong DisplaySettings:
 *    - Chuẩn (standard): size = 2.85 (tỉ lệ 1.35x), color = #dc2626
 *    - Sân khấu lớn (stage): size >= 4.5 (1.6x chuẩn), đậm
 *    - Tương phản cao (high_contrast): chữ hổ phách #fbbf24, nền pill tối
 * 3. DisplaySettings cung cấp các hàm setChordPreset, getChordPreset, getChordPresets, cyclePreset.
 * 4. Lưu trạng thái preset theo thiết bị (localStorage key: sheetapp_chord_preset).
 * 5. CSS định nghĩa các class chord-preset-stage và chord-preset-high-contrast trong sheet.css.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/assert.php';

$root = dirname(__DIR__);

echo "========================================================\n";
echo "   Ticket L1-2: 3 Preset Hiển Thị Hợp Âm (Nút Aa)\n";
echo "========================================================\n\n";

$toolbarPhpPath = $root . '/includes/toolbar.php';
$toolbarPhp = file_get_contents($toolbarPhpPath);

$displaySettingsJsPath = $root . '/assets/js/display-settings.js';
$displaySettingsJs = file_get_contents($displaySettingsJsPath);

$sheetCssPath = $root . '/assets/css/sheet.css';
$sheetCss = file_get_contents($sheetCssPath);

// 1. Kiểm tra nút btn-chord-preset có mặt trên thanh công cụ
$hasPresetBtn = strpos($toolbarPhp, 'id="btn-chord-preset"') !== false
    && strpos($toolbarPhp, 'chord-preset-label') !== false
    && strpos($toolbarPhp, 'Aa') !== false;
checkStatic(
    'toolbar_has_btn_chord_preset_aa',
    $hasPresetBtn,
    'includes/toolbar.php có nút #btn-chord-preset với biểu tượng Aa và nhãn preset hiển thị'
);

// 2. Kiểm tra định nghĩa 3 preset trong display-settings.js
$hasStandardPreset = strpos($displaySettingsJs, 'standard:') !== false;
$hasStagePreset = strpos($displaySettingsJs, 'stage:') !== false;
$hasHighContrastPreset = strpos($displaySettingsJs, 'high_contrast:') !== false;
checkBehavior(
    'display_settings_defines_3_presets',
    $hasStandardPreset && $hasStagePreset && $hasHighContrastPreset,
    'display-settings.js định nghĩa đầy đủ 3 preset: standard (Chuẩn), stage (Sân khấu lớn), high_contrast (Tương phản cao)'
);

// 3. Kiểm tra thông số kỹ thuật của các preset
$hasStage16x = (bool)preg_match('/stage:\s*\{[^}]*size:\s*4\.\d+/s', $displaySettingsJs);
$hasAmberColor = strpos($displaySettingsJs, '#fbbf24') !== false;
checkBehavior(
    'display_settings_preset_specifications',
    $hasStage16x && $hasAmberColor,
    'Preset Sân khấu lớn có size >= 4.5 (1.6x chuẩn), preset Tương phản cao dùng màu hổ phách #fbbf24'
);

// 4. Kiểm tra lưu trữ thiết bị bằng localStorage sheetapp_chord_preset
$hasPresetStorage = strpos($displaySettingsJs, 'sheetapp_chord_preset') !== false;
checkStatic(
    'display_settings_preset_persisted',
    $hasPresetStorage,
    'display-settings.js lưu trữ preset hợp âm theo thiết bị qua localStorage (sheetapp_chord_preset)'
);

// 5. Kiểm tra các hàm API điều khiển preset được export
$hasExportedMethods = strpos($displaySettingsJs, 'setChordPreset') !== false
    && strpos($displaySettingsJs, 'getChordPreset') !== false
    && strpos($displaySettingsJs, 'cyclePreset') !== false;
checkStatic(
    'display_settings_exports_preset_api',
    $hasExportedMethods,
    'DisplaySettings export đầy đủ các hàm setChordPreset, getChordPreset, getChordPresets, cyclePreset'
);

// 6. Kiểm tra CSS cho các class preset
$hasStageCss = strpos($sheetCss, '.chord-preset-stage') !== false;
$hasHighContrastCss = strpos($sheetCss, '.chord-preset-high-contrast') !== false
    && strpos($sheetCss, '#0F172A') !== false;
checkStatic(
    'sheet_css_has_preset_classes',
    $hasStageCss && $hasHighContrastCss,
    'sheet.css định nghĩa đầy đủ lớp tạo kiểu cho .chord-preset-stage và .chord-preset-high-contrast (nền pill tối #0F172A)'
);

TestAssert::finish();
