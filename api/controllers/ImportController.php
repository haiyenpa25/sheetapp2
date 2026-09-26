<?php
/**
 * api/controllers/ImportController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ImportService.php';

class ImportController {
    public function handleRequest(string $method): void {
        Auth::requireAdmin();

        try {
            if ($method === 'POST') {
                $type = $_GET['type'] ?? '';
                
                // Nếu không có tham số type trên URL thì tìm trong body
                if (empty($type)) {
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $type = $body['type'] ?? '';
                }

                if ($type === 'search') {
                    $url = $body['url'] ?? '';
                    if (empty($url)) { Response::error('Missing URL'); return; }
                    Response::ok(ImportService::search($url));
                } 
                elseif ($type === 'fetch') {
                    $url = $body['url'] ?? '';
                    if (empty($url)) { Response::error('Missing URL'); return; }
                    Response::ok(ImportService::fetch($url));
                } 
                elseif ($type === 'upload') {
                    if (empty($_FILES['file'])) { Response::error('Missing file'); return; }
                    Response::ok(ImportService::upload($_FILES['file']));
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
