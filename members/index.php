<?php
/**
 * members/index.php — Hợp nhất vào Manager Portal (Task 2.5)
 * Tự động chuyển hướng an toàn về /manager/#tab-users
 */
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$appBase = rtrim(dirname($scriptDir), '/');
if ($appBase === '/' || $appBase === '\\') $appBase = '';
$target = ($appBase ? $appBase : '') . '/manager/#tab-users';

if (!headers_sent()) {
    header('Location: ' . $target, true, 302);
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($target, ENT_QUOTES) ?>">
  <title>Chuyển hướng sang Manager — SheetApp</title>
  <script>
    if (window.location.pathname.indexOf('/members') !== -1) {
      const appBase = <?= json_encode($appBase, JSON_UNESCAPED_SLASHES) ?>;
      window.location.replace((appBase ? appBase : '') + '/manager/#tab-users');
    }
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #f8fafc; margin: 0; padding: 1.5rem; text-align: center;">
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="font-size: 2.5rem; margin-bottom: 1rem;">👥</div>
    <h2 style="margin: 0 0 0.75rem; font-size: 1.25rem;">Hợp Nhất Quản Lý Thành Viên</h2>
    <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">
      Không gian quản lý nhạc công và mã hợp âm cá nhân đã được chuyển về thẻ <strong>Thành Viên & Phân Quyền</strong> trong Cổng Quản Lý (Manager Portal).
    </p>
    <a href="<?= htmlspecialchars($target, ENT_QUOTES) ?>" style="display: inline-block; background: #0284c7; color: white; padding: 0.6rem 1.25rem; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Đi Đến Manager Portal →
    </a>
  </div>
  <script src="<?= $appBase ?>/assets/js/core/SafeHtml.js"></script>
</body>
</html>
