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
            if ($action === 'instruments') { Response::ok(AnnotationService::instruments()); return; }
            $songId = trim($_GET['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'load') {
                Response::ok(AnnotationService::document($songId));
                return;
            }

            Response::error('action không hợp lệ');
        } elseif ($method === 'POST') {
            Auth::requireAdmin();
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body) { Response::error('Body không hợp lệ'); return; }

            $action = $body['action'] ?? '';
            if ($action === 'instrument_save') {
                if (!is_string($body['instrumentId'] ?? '') || !is_string($body['name'] ?? null) || !is_string($body['registryRevision'] ?? null)) {
                    Response::error('Dữ liệu nhạc cụ không hợp lệ', 422); return;
                }
                Response::ok(AnnotationService::saveInstrument($body['instrumentId'] ?? '', $body['name'], $body['registryRevision']));
                return;
            }
            $songId = trim($body['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'save') {
                if (!is_array($body['annotations'] ?? null) || !is_string($body['revision'] ?? null)) {
                    Response::error('Cần tải lại ghi chú trước khi lưu', 422); return;
                }
                Response::ok(AnnotationService::saveDocument($songId, $body['annotations'], $body['revision']));
                return;
            }

            Response::error('action không hợp lệ');
        } else {
            Response::methodNotAllowed();
        }
    }
}
