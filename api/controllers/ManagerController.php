<?php
/**
 * api/controllers/ManagerController.php
 * Controller tiếp nhận các yêu cầu cho phân hệ Quản lý & Cộng tác người dùng (/manager/)
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ManagerService.php';

class ManagerController {

    public function handleRequest(string $method): void {
        try {
            $action = $_GET['action'] ?? '';

            if ($method === 'GET') {
                switch ($action) {
                    case 'stats':
                        Response::ok(ManagerService::getStats());
                        return;

                    case 'repertoire':
                        $filters = [
                            'category_id' => !empty($_GET['category_id']) ? (int)$_GET['category_id'] : null,
                            'keyword'     => trim($_GET['q'] ?? ''),
                            'limit'       => !empty($_GET['limit']) ? (int)$_GET['limit'] : 60,
                            'offset'      => !empty($_GET['offset']) ? (int)$_GET['offset'] : 0,
                        ];
                        Response::ok(ManagerService::getRepertoire($filters));
                        return;

                    case 'community_chords':
                        $filters = [
                            'song_id'         => trim($_GET['song_id'] ?? ''),
                            'user_id'         => !empty($_GET['user_id']) ? (int)$_GET['user_id'] : null,
                            'username'        => trim($_GET['username'] ?? ''),
                            'instrument_type' => trim($_GET['instrument'] ?? ''),
                            'category_id'     => !empty($_GET['category_id']) ? (int)$_GET['category_id'] : null,
                            'recommended_only'=> !empty($_GET['recommended']) ? 1 : 0,
                            'keyword'         => trim($_GET['q'] ?? ''),
                            'limit'           => !empty($_GET['limit']) ? (int)$_GET['limit'] : 60,
                            'offset'          => !empty($_GET['offset']) ? (int)$_GET['offset'] : 0,
                        ];
                        Response::ok(['sets' => ManagerService::getCommunityChordSets($filters)]);
                        return;

                    case 'categories':
                        Response::ok(['categories' => ManagerService::manageCategory('list', [])]);
                        return;

                    case 'users':
                        Auth::requireAdmin();
                        Response::ok(['users' => ManagerService::getUsersList()]);
                        return;

                    case 'current_user':
                        Response::ok([
                            'logged_in' => Auth::isLoggedIn(),
                            'user_id'   => Auth::userId(),
                            'username'  => Auth::username(),
                            'role'      => Auth::role()
                        ]);
                        return;

                    default:
                        Response::error('Action GET không hợp lệ');
                        return;
                }
            } elseif ($method === 'POST') {
                $body = json_decode(file_get_contents('php://input'), true) ?? [];

                switch ($action) {
                    case 'fork_song':
                        // Nhân bản bài hát sang bản cá nhân
                        $res = ManagerService::forkSong($body);
                        if ($res['success']) {
                            Response::ok($res['data'] ?? [], $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    case 'save_chord_set':
                        $setId = (int)($body['set_id'] ?? 0);
                        if (!$setId) {
                            Response::error('Thiếu set_id');
                            return;
                        }
                        $res = ManagerService::saveUserChordSet($setId, $body);
                        if ($res['success']) {
                            Response::ok($res['data'] ?? [], $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    case 'delete_chord_set':
                        $setId = (int)($body['set_id'] ?? 0);
                        if (!$setId) {
                            Response::error('Thiếu set_id');
                            return;
                        }
                        $res = ManagerService::deleteUserChordSet($setId);
                        if ($res['success']) {
                            Response::ok([], $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    case 'toggle_recommend':
                        $setId = (int)($body['set_id'] ?? 0);
                        if (!$setId) {
                            Response::error('Thiếu set_id');
                            return;
                        }
                        $res = ManagerService::toggleRecommend($setId);
                        if ($res['success']) {
                            Response::ok($res, $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    case 'manage_user':
                        $subAction = trim($body['sub_action'] ?? '');
                        $res = ManagerService::manageUser($subAction, $body);
                        if ($res['success']) {
                            Response::ok([], $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    case 'manage_category':
                        $subAction = trim($body['sub_action'] ?? '');
                        $res = ManagerService::manageCategory($subAction, $body);
                        if ($res['success']) {
                            Response::ok([], $res['message']);
                        } else {
                            Response::error($res['message']);
                        }
                        return;

                    default:
                        Response::error('Action POST không hợp lệ');
                        return;
                }
            } else {
                Response::methodNotAllowed();
            }

        } catch (Throwable $e) {
            Response::error('Lỗi hệ thống Manager: ' . $e->getMessage(), 500);
        }
    }
}
