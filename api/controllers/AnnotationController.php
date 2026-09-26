<?php
/**
 * api/controllers/AnnotationController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/AnnotationService.php';

class AnnotationController {
    public function handleRequest(string $method): void {
        if ($method === 'GET') {
            $action = $_GET['action'] ?? '';
            $songId = trim($_GET['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'load') {
                $annotations = AnnotationService::load($songId);
                Response::ok(['annotations' => $annotations]);
                return;
            }

            Response::error('action không hợp lệ');
        } elseif ($method === 'POST') {
            Auth::requireAdmin();
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body) { Response::error('Body không hợp lệ'); return; }

            $action = $body['action'] ?? '';
            $songId = trim($body['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'save') {
                $annotations = $body['annotations'] ?? [];
                $ok = AnnotationService::save($songId, $annotations);
                $ok ? Response::ok() : Response::error('Lỗi lưu annotation');
                return;
            }

            Response::error('action không hợp lệ');
        } else {
            Response::methodNotAllowed();
        }
    }
}
