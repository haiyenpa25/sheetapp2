<?php
declare(strict_types=1);

/**
 * tools/cleanup_expired_rooms.php
 * 
 * CLI Job dọn dẹp các phòng Live Sync & Projector đã hết hạn (> 24 giờ).
 * Chặn truy cập web trực tiếp (HTTP 403 Forbidden).
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "403 Forbidden: CLI only\n";
    exit(1);
}

require_once __DIR__ . '/../api/services/LiveSyncService.php';

echo "[" . date('Y-m-d H:i:s') . "] Bat dau don dep phong Live Sync het han (> 24h)...\n";

$dir = dirname(__DIR__) . '/storage/data/live_sync';
if (!is_dir($dir)) {
    echo "Thu muc live_sync khong ton tai.\n";
    exit(0);
}

$files = glob($dir . '/*.*') ?: [];
$cutoff = time() - (24 * 3600);
$closedCutoff = time() - 300; // Đóng quá 5 phút
$deleted = 0;
$kept = 0;

// Bước 1: Quét các file json phòng chính
$roomJsonFiles = glob($dir . '/*.json') ?: [];
foreach ($roomJsonFiles as $f) {
    if (str_ends_with($f, '.presence.json')) continue;

    $baseName = basename($f, '.json');
    $shouldDelete = false;

    if (filemtime($f) < $cutoff) {
        $shouldDelete = true;
    } else {
        $content = @file_get_contents($f);
        $data = $content ? json_decode($content, true) : null;
        if (is_array($data)) {
            if (isset($data['expiresAt']) && time() > $data['expiresAt']) {
                $shouldDelete = true;
            } elseif (isset($data['active']) && $data['active'] === false && filemtime($f) < $closedCutoff) {
                $shouldDelete = true;
            }
        }
    }

    if ($shouldDelete) {
        // Xóa file chính và các file vệ tinh liên quan (.lock, .presence.json, .presence.lock)
        $related = [
            $f,
            $dir . '/' . $baseName . '.lock',
            $dir . '/' . $baseName . '.presence.json',
            $dir . '/' . $baseName . '.presence.lock'
        ];
        foreach ($related as $rf) {
            if (file_exists($rf) && @unlink($rf)) {
                $deleted++;
            }
        }
    }
}

// Bước 2: Dọn dẹp các file mồ côi (.lock, .presence.* không còn file room .json gốc)
$allRemaining = glob($dir . '/*.*') ?: [];
foreach ($allRemaining as $f) {
    $fname = basename($f);
    $baseName = preg_replace('/(\.presence)?(\.lock|\.json)$/', '', $fname);
    $parentJson = $dir . '/' . $baseName . '.json';
    if (!file_exists($parentJson)) {
        if (@unlink($f)) {
            $deleted++;
        }
    } else {
        $kept++;
    }
}

echo "Ket qua don dep: Da xoa {$deleted} file het han/dong phong, giu lai {$kept} file con hoat dong.\n";
exit(0);
