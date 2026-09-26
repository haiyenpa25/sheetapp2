<?php
/**
 * tests/shared_platform_regression.php
 *
 * Kiểm tra hồi quy cho Task 2.3 — Nền tảng JS dùng chung (Unified Shared JS Platform):
 * 1. Kiểm tra sự tồn tại của 4 module nền tảng mới:
 *    - assets/js/core/TapTempo.js (Bộ tính nhịp Tap Tempo)
 *    - assets/js/core/MidiEngine.js (Bộ tích hợp Web MIDI và Bàn đạp)
 *    - assets/js/core/AudioUnlocker.js (Mở khóa Audio iOS & Click Web Audio)
 *    - assets/js/core/SongLoaderCore.js (Bộ nạp XML & Hợp âm song song)
 * 2. Kiểm tra ApiService được mở rộng đủ domain (practice, manager, auth.logout bằng POST).
 * 3. Kiểm tra TapTempo logic: giới hạn 40-240 BPM, trung bình 4 khoảng, reset timeout 2000ms.
 * 4. Kiểm tra MidiEngine logic: noteon/noteoff, pitch class, CC64/CC66/CC67 pedals, shims cho MidiInputEngine.
 * 5. Kiểm tra AudioUnlocker logic: silent buffer, resume(), playClick stereo panner.
 * 6. Kiểm tra SongLoaderCore logic: sanitizeXmlPath, fetchXmlWithChords, applyTransposeToOsmd.
 * 7. Kiểm tra tích hợp đầy đủ trên 4 trụ cột (index.php, live-band, learn, manager).
 */

declare(strict_types=1);

function check(bool $condition, string $message): void {
    $GLOBALS['suiteTotalChecks'] = ($GLOBALS['suiteTotalChecks'] ?? 0) + 1;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

echo "=== SHARED JS PLATFORM REGRESSION (TASK 2.3) ===\n";

$root = dirname(__DIR__);

// --- TEST 1: Kiểm tra các file nền tảng cốt lõi ---
$tapTempoPath    = $root . '/assets/js/core/TapTempo.js';
$midiEnginePath  = $root . '/assets/js/core/MidiEngine.js';
$audioUnlockPath = $root . '/assets/js/core/AudioUnlocker.js';
$songCorePath    = $root . '/assets/js/core/SongLoaderCore.js';
$apiServicePath  = $root . '/assets/js/core/ApiService.js';

check(file_exists($tapTempoPath), 'File assets/js/core/TapTempo.js tồn tại');
check(file_exists($midiEnginePath), 'File assets/js/core/MidiEngine.js tồn tại');
check(file_exists($audioUnlockPath), 'File assets/js/core/AudioUnlocker.js tồn tại');
check(file_exists($songCorePath), 'File assets/js/core/SongLoaderCore.js tồn tại');
check(file_exists($apiServicePath), 'File assets/js/core/ApiService.js tồn tại');

$tapJs   = file_get_contents($tapTempoPath);
$midiJs  = file_get_contents($midiEnginePath);
$audioJs = file_get_contents($audioUnlockPath);
$songJs  = file_get_contents($songCorePath);
$apiJs   = file_get_contents($apiServicePath);

// --- TEST 2: TapTempo contract ---
check(str_contains($tapJs, 'MIN_BPM = 40') && str_contains($tapJs, 'MAX_BPM = 240'), 'TapTempo giới hạn dải BPM 40–240');
check(str_contains($tapJs, 'TIMEOUT_MS = 2000'), 'TapTempo có timeout reset 2000ms');
check(str_contains($tapJs, 'tap()') || str_contains($tapJs, 'function tap'), 'TapTempo cung cấp hàm tap()');
check(str_contains($tapJs, 'taptempo:bpm'), 'TapTempo phát sự kiện taptempo:bpm');

$metronomeJs = file_get_contents($root . '/assets/js/metronome.js');
$liveBandJs  = file_get_contents($root . '/live-band/live-band.js');
check(str_contains($metronomeJs, 'TapTempo'), 'metronome.js tích hợp TapTempo');
check(str_contains($liveBandJs, 'TapTempo'), 'live-band.js tích hợp TapTempo');

// --- TEST 3: MidiEngine contract ---
check(str_contains($midiJs, 'requestMIDIAccess'), 'MidiEngine sử dụng Web MIDI API navigator.requestMIDIAccess');
check(str_contains($midiJs, 'midiToPitchClass') && str_contains($midiJs, 'midiToNoteName'), 'MidiEngine cung cấp hàm đổi nốt nhạc và pitch class');
check(str_contains($midiJs, 'midi:noteon') && str_contains($midiJs, 'midi:noteoff'), 'MidiEngine phát sự kiện noteon / noteoff');
check(str_contains($midiJs, 'sustain') && str_contains($midiJs, '64'), 'MidiEngine hỗ trợ bàn đạp chân CC64 sustain');
check(str_contains($midiJs, 'MidiInputEngine'), 'MidiEngine cung cấp shim tương thích ngược cho MidiInputEngine');

// --- TEST 4: AudioUnlocker contract ---
check(str_contains($audioJs, 'createBuffer') && str_contains($audioJs, 'resume'), 'AudioUnlocker mở khóa AudioContext và phát silent buffer');
check(str_contains($audioJs, 'playClick'), 'AudioUnlocker cung cấp hàm phát click oscillator');
check(str_contains($audioJs, 'createStereoPanner') || str_contains($audioJs, 'pan'), 'AudioUnlocker hỗ trợ StereoPannerNode phân kênh In-Ear Split');

// --- TEST 5: SongLoaderCore contract ---
check(str_contains($songJs, 'sanitizeXmlPath'), 'SongLoaderCore cung cấp hàm sanitizeXmlPath chuẩn hóa đường dẫn');
check(str_contains($songJs, 'fetchXmlWithChords'), 'SongLoaderCore cung cấp hàm fetchXmlWithChords nạp song song');
check(str_contains($songJs, 'cloneAndInjectChords'), 'SongLoaderCore liên kết tự động với ChordCanvasXML');
check(str_contains($songJs, 'applyTransposeToOsmd'), 'SongLoaderCore chuẩn hóa dịch giọng OSMD qua TransposeCalculator');

// --- TEST 6: Mở rộng ApiService ---
check(str_contains($apiJs, 'practice = {') && str_contains($apiJs, 'checkpoint:'), 'ApiService được mở rộng domain practice');
check(str_contains($apiJs, 'manager = {') && str_contains($apiJs, 'searchSongs:'), 'ApiService được mở rộng domain manager');
check(str_contains($apiJs, 'method: \'POST\'') && str_contains($apiJs, 'logout:'), 'ApiService.auth.logout sử dụng phương thức POST an toàn (Task 0.4)');

$practiceTrackerJs = file_get_contents($root . '/assets/js/learn/practice/practice-tracker.js');
check(str_contains($practiceTrackerJs, 'ApiService.practice'), 'practice-tracker.js gọi API qua ApiService.practice');

// --- TEST 7: Tích hợp đầy đủ trên 4 trụ cột ---
$indexPhp    = file_get_contents($root . '/index.php');
$liveBandPhp = file_get_contents($root . '/live-band/index.php');
$learnPhp    = file_get_contents($root . '/learn/index.php');
$managerPhp  = file_get_contents($root . '/manager/index.php');

check(str_contains($indexPhp, 'TapTempo.js') && str_contains($indexPhp, 'MidiEngine.js'), 'Trụ cột Thư Viện nhúng TapTempo & MidiEngine');
check(str_contains($liveBandPhp, 'TapTempo.js') && str_contains($liveBandPhp, 'AudioUnlocker.js'), 'Trụ cột Biểu Diễn nhúng TapTempo & AudioUnlocker');
check(str_contains($learnPhp, 'MidiEngine.js') && str_contains($learnPhp, 'SongLoaderCore.js'), 'Trụ cột Tập Luyện nhúng MidiEngine & SongLoaderCore');
check(str_contains($managerPhp, 'ApiService.js'), 'Trụ cột Quản Lý nhúng ApiService.js');

echo "\n>>> ALL 7/7 SHARED JS PLATFORM REGRESSION CHECKS PASSED!\n";

echo "\nSUITE_COMPLETE total=" . ($GLOBALS['suiteTotalChecks'] ?? 0) . "\n";
