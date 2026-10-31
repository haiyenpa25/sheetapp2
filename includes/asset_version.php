<?php
// includes/asset_version.php — Phiên bản tài nguyên JS cho các module NẠP LƯỜI (ScriptLoader).
//
// Các script này không có thẻ <script> trong HTML nên trước đây được tải bằng URL trần (không ?v=): máy chủ/CDN
// giữ file .js rất lâu nên sau mỗi lần cập nhật người dùng vẫn chạy module cũ. Giá trị trả về là mốc sửa MỚI NHẤT
// của mọi file JS dùng chung → đổi bất kỳ file nào là URL đổi, không phải nhớ nâng số tay.

if (!function_exists('sheetapp_asset_version')) {
    function sheetapp_asset_version(string $entryFile = ''): int {
        $root = dirname(__DIR__);
        $latest = $entryFile !== '' ? (int)@filemtime($entryFile) : 0;
        foreach (['assets/js', 'assets/js/core', 'assets/js/modals', 'assets/js/performance'] as $dir) {
            foreach (glob($root . '/' . $dir . '/*.js') ?: [] as $file) {
                $latest = max($latest, (int)@filemtime($file));
            }
        }
        return $latest;
    }
}
