<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require_once __DIR__ . '/../api/core/DB.php';
require_once __DIR__ . '/../api/services/SetlistService.php';

$action = $argv[1] ?? 'bpm';

if ($action === 'cleanup') {
    $id = isset($argv[2]) ? (int)$argv[2] : 0;
    if ($id > 0) {
        SetlistService::delete($id);
        echo json_encode(['success' => true, 'cleaned' => $id]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing ID']);
    }
    exit;
}

if ($action === 'bpm') {
    $title = 'E2E Test Setlist BPM 90 - ' . time();
    $date = date('Y-m-d');
    $slId = SetlistService::create($title, $date, 1);
    
    // Thêm bài thanh-ca-001 với BPM = 90 (XML gốc bài 001 là 104 hoặc 80)
    SetlistService::addItem($slId, 'thanh-ca-001', 'HD', 0, 90, 4);
    
    echo json_encode([
        'success' => true,
        'setlist_id' => $slId,
        'title' => $title,
        'expected_bpm' => 90
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'nav') {
    $title = 'E2E Test Setlist 5 Songs - ' . time();
    $date = date('Y-m-d');
    $slId = SetlistService::create($title, $date, 1);
    
    $songs = [
        ['id' => 'thanh-ca-001', 'key' => 0, 'bpm' => 90, 'title' => 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI'],
        ['id' => 'thanh-ca-002', 'key' => 1, 'bpm' => 95, 'title' => 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG'],
        ['id' => 'thanh-ca-003', 'key' => -1, 'bpm' => 80, 'title' => 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ'],
        ['id' => 'thanh-ca-004', 'key' => 2, 'bpm' => 100, 'title' => 'HA-LÊ-LU-GIA !  VINH DANH NGÀI !'],
        ['id' => 'thanh-ca-005', 'key' => 0, 'bpm' => 88, 'title' => 'MUÔN DÂN TRÊN HOÀN CẦU NÊN CA XƯỚNG']
    ];
    
    foreach ($songs as $s) {
        SetlistService::addItem($slId, $s['id'], 'HD', $s['key'], $s['bpm'], 4);
    }
    
    echo json_encode([
        'success' => true,
        'setlist_id' => $slId,
        'title' => $title,
        'songs_count' => count($songs),
        'last_song' => $songs[4]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
