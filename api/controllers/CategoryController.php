<?php
/**
 * api/controllers/CategoryController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/CategoryService.php';

class CategoryController {
    /** Danh mục chung: chỉ Admin hệ thống. Danh mục riêng của HT: Admin hệ thống hoặc quản trị HT đó. */
    private function authorizeWrite(int $churchId): void {
        require_once __DIR__ . '/../core/ChurchAccessGuard.php';
        if ($churchId > 0 && ChurchAccessGuard::canManageChurch($churchId)) return;
        Auth::requireAdmin();
    }

    /** HT sở hữu danh mục (0 = danh mục chung hoặc chưa có cột church_id). */
    private function ownerChurchOf(int $categoryId): int {
        if ($categoryId <= 0 || !DB::hasColumn('categories', 'church_id')) return 0;
        return (int)DB::run('SELECT church_id FROM categories WHERE id = ?', [$categoryId])->fetchColumn();
    }

    public function handleRequest(string $method): void {
        try {
            switch ($method) {
                case 'GET':
                    $categories = CategoryService::getAll();
                    // INTENTIONAL: Trả raw array (không bọc Response::ok()) vì
                    // ApiService.categories.list() và LibraryUI expect Array.isArray() trực tiếp.
                    // Để đổi: cần sửa đồng thời ApiService + library-ui.js + admin-ui.js.
                    echo json_encode($categories, JSON_UNESCAPED_UNICODE);
                    break;

                case 'POST':
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $churchId = (int)($body['church_id'] ?? 0);
                    $this->authorizeWrite($churchId);
                    if (empty($body['name'])) {
                        Response::error('Missing name');
                        return;
                    }
                    $result = CategoryService::create((string)$body['name'], (string)($body['visibility'] ?? 'public'), $churchId > 0 ? $churchId : null);
                    Response::ok($result);
                    break;

                case 'PUT':
                    $id   = $_GET['id'] ?? null;
                    $this->authorizeWrite($this->ownerChurchOf((int)$id));
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (!$id || (empty($body['name']) && empty($body['visibility']))) {
                        Response::error('Missing id, name or visibility');
                        return;
                    }
                    $result = CategoryService::update(
                        (int)$id,
                        isset($body['name']) ? (string)$body['name'] : null,
                        isset($body['visibility']) ? (string)$body['visibility'] : null
                    );
                    Response::ok($result);
                    break;

                case 'DELETE':
                    $id = $_GET['id'] ?? null;
                    $this->authorizeWrite($this->ownerChurchOf((int)$id));
                    if (!$id) { Response::error('Missing id'); return; }
                    $result = CategoryService::delete((int)$id);
                    Response::ok($result);
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Throwable $e) {
            Response::serverError($e, 'Category');
        }
    }
}
