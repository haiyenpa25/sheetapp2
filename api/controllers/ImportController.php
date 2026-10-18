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
