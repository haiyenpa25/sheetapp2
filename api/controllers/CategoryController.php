<?php
/**
 * api/controllers/CategoryController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/CategoryService.php';

class CategoryController {
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
                    Auth::requireAdmin();
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (empty($body['name'])) { 
                        Response::error('Missing name'); 
                        return; 
                    }
                    $result = CategoryService::create((string)$body['name'], (string)($body['visibility'] ?? 'public'));
                    Response::ok($result);
                    break;

                case 'PUT':
                    Auth::requireAdmin();
                    $id   = $_GET['id'] ?? null;
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
                    Auth::requireAdmin();
                    $id = $_GET['id'] ?? null;
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
