<?php
/**
 * api/controllers/ImportController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ImportService.php';

class ImportController {
    /**
     * Tải bài lên: Admin hệ thống (mọi danh mục) hoặc Quản trị Hội Thánh (CHỈ vào danh mục riêng của HT mình).
     * Danh mục riêng luôn ép quyền "private" nên bài không lộ ra ngoài HT. Các thao tác lấy bài từ web vẫn chỉ Admin.
     */
    public static function authorizeUpload(int $categoryId): void {
        Auth::requireLogin();
        if (Auth::isAdmin()) return;
        require_once __DIR__ . '/../core/ChurchAccessGuard.php';
        require_once __DIR__ . '/../core/DB.php';
        $churchId = $categoryId > 0 && DB::hasColumn('categories', 'church_id')
            ? (int)DB::run('SELECT church_id FROM categories WHERE id = ?', [$categoryId])->fetchColumn() : 0;
        if ($churchId > 0 && ChurchAccessGuard::canManageChurch($churchId)) return;
        Response::abort(403, 'Chỉ Admin, hoặc quản trị Hội Thánh (vào danh mục riêng của Hội Thánh mình), mới được thêm bài');
    }

    public function handleRequest(string $method): void {
        if ($method === 'POST' && ($_GET['type'] ?? '') === 'upload') {
            self::authorizeUpload((int)($_POST['category_id'] ?? 0));
        } else {
            Auth::requireAdmin();
        }

        try {
            if ($method === 'POST') {
                $type = $_GET['type'] ?? '';
                
                $body = [];
                if ($type !== 'upload') {
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                }
                if (empty($type)) {
                    $type = $body['type'] ?? ($_POST['type'] ?? '');
                }

                if ($type === 'search') {
                    $url = $body['url'] ?? '';
                    if (empty($url)) { Response::error('Missing URL'); return; }
                    $title = trim((string)($body['title'] ?? ''));
                    Response::ok(ImportService::search($url, $title, $body));
                } 
                elseif ($type === 'fetch') {
                    $url = $body['url'] ?? '';
                    if (empty($url)) { Response::error('Missing URL'); return; }
                    $title = trim((string)($body['title'] ?? ''));
                    Response::ok(ImportService::fetch($url, $title, $body));
                } 
                elseif ($type === 'upload') {
                    if (empty($_FILES['file'])) { Response::error('Missing file'); return; }
                    $opts = [
                        'title'       => trim((string)($_POST['title'] ?? '')),
                        'category_id' => !empty($_POST['category_id']) ? (int)$_POST['category_id'] : 1,
                        'visibility'  => trim((string)($_POST['visibility'] ?? 'public')),
                        'composer'    => trim((string)($_POST['composer'] ?? '')),
                        'httlvnId'    => !empty($_POST['httlvnId']) ? (int)$_POST['httlvnId'] : null,
                    ];
                    if (isset($_POST['is_public'])) {
                        $opts['is_public'] = (int)$_POST['is_public'];
                    }
                    Response::ok(ImportService::upload($_FILES['file'], $opts));
                } 
                elseif ($type === 'save') {
                    // Logic from old save action
                    Response::ok(ImportService::save($body));
                } 
                else {
                    Response::error('Invalid import type');
                }
            } else {
                Response::methodNotAllowed();
            }
        } catch (Throwable $e) {
            Response::serverError($e, 'Import');
        }
    }
}
