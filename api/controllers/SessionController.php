<?php
/**
 * api/controllers/SessionController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/SessionService.php';

class SessionController {
    public function handleRequest(string $method): void {
        if ($method === 'GET') {
            $songId = $_GET['songId'] ?? '';
            if (!$songId) { Response::error('Missing songId'); return; }
            // Anonymous users receive defaults; persisted settings are private per account.
            Response::ok(SessionService::load($songId, Auth::userId() ?? 0));
        } elseif ($method === 'POST') {
            Auth::requireLogin();
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $songId = $body['songId'] ?? '';
            if (!$songId) { Response::error('Missing songId'); return; }

            $result = [];
            $userId = Auth::userId() ?? 0;
            if (isset($body['userSettings'])) {
                $result['userSettings'] = SessionService::saveUserSettings($songId, $userId, $body['userSettings']);
            }
            if (isset($body['perfNotes'])) {
                $result['perfNotes'] = SessionService::savePerfNotes($songId, $userId, $body['perfNotes']);
            }
            Response::ok($result);
        } else {
            Response::methodNotAllowed();
        }
    }
}
