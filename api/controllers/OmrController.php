<?php
/**
 * api/controllers/OmrController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/OmrService.php';

class OmrController {
    public function handleRequest(string $method): void {
        Auth::requireAdmin();
        OmrService::initWorkspace();

        try {
            switch ($method) {
                case 'GET':
                    $jobs = OmrService::getAll();
                    Response::ok(['jobs' => $jobs]);
                    break;

                case 'POST':
                    if (!isset($_FILES['file'])) {
                        Response::error('Không có file'); return;
                    }
                    $file = $_FILES['file'];
                    if ($file['error'] !== UPLOAD_ERR_OK) {
                        Response::error('Lỗi upload: ' . $file['error']); return;
                    }

                    $originalName = $file['name'];
                    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                    if (!in_array($ext, ['pdf', 'png', 'jpg', 'jpeg'])) {
                        Response::error('Chỉ nhận PDF hoặc Hình ảnh'); return;
                    }

                    $id = uniqid('omr_');
                    $filename = $id . '.' . $ext;
                    $path = OmrService::WORKSPACE_DIR . $filename;
                    
                    move_uploaded_file($file['tmp_name'], $path);
                    OmrService::createJob($id, $originalName);

                    if (!OmrService::checkEngineHealth()) {
                        OmrService::updateStatus($id, 'error');
                        Response::error('OMR Engine chưa sẵn sàng. Kiểm tra Docker container sheetapp-omr.', 503);
                        return;
                    }

                    OmrService::startWorker($id);
                    Response::ok(['id' => $id]);
                    break;

                case 'DELETE':
                    $id = $_GET['id'] ?? null;
                    if (!$id) { Response::error('Missing id'); return; }
                    OmrService::deleteJob($id);
                    Response::ok();
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (Throwable $e) {
            Response::serverError($e, 'OMR');
        }
    }
}
