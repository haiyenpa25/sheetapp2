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
            $songId = $this->songId($_GET['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'load') {
                Response::ok(AnnotationService::document($songId));
                return;
            }

            Response::error('action không hợp lệ');
        } elseif ($method === 'POST') {
            // Thành viên (Ban Hát trở lên) ghi chú trên bản nhạc; danh mục/màu nhạc cụ vẫn chỉ Admin.
            Auth::requireBanhat();
            $body = json_decode(file_get_contents('php://input'), true);
            if (!is_array($body)) { Response::error('Body không hợp lệ', 422); return; }

            $action = $body['action'] ?? '';
            if ($action === 'instrument_save') {
                Auth::requireAdmin();
                if (!is_string($body['instrumentId'] ?? '') || !is_string($body['name'] ?? null) || !is_string($body['registryRevision'] ?? null) || (isset($body['color']) && !is_string($body['color']))) {
                    Response::error('Dữ liệu nhạc cụ không hợp lệ', 422); return;
                }
                Response::ok(AnnotationService::saveInstrument($body['instrumentId'] ?? '', $body['name'], $body['registryRevision'], null, $body['color'] ?? null));
                return;
            }
            $songId = $this->songId($body['songId'] ?? '');

            if (!$songId) { Response::error('Thiếu songId'); return; }

            if ($action === 'save') {
                if (!is_array($body['annotations'] ?? null) || !is_string($body['revision'] ?? null)) {
                    Response::error('Cần tải lại ghi chú trước khi lưu', 422); return;
                }
                Response::ok(AnnotationService::saveDocument($songId, $body['annotations'], $body['revision'], null, $this->actor()));
                return;
            }

            if ($action === 'band_note_save') {
                if (!is_array($body['bandNote'] ?? null) || !is_string($body['revision'] ?? null)) {
                    Response::error('Cần tải lại ghi chú trước khi lưu', 422); return;
                }
                Response::ok(AnnotationService::saveBandNote($songId, $body['bandNote'], $body['revision'], null, $this->actor()));
                return;
            }

            Response::error('action không hợp lệ');
        } else {
            Response::methodNotAllowed();
        }
    }

    private function actor(): array {
        return ['id' => Auth::userId(), 'name' => Auth::username(), 'admin' => Auth::isAdmin()];
    }

    private function songId(mixed $value): string {
        if (!is_string($value)) throw new HttpException(422, 'Mã bài không hợp lệ.');
        return trim($value);
    }
}
