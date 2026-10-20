<?php
/**
 * api/controllers/SongController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/SongService.php';

class SongController {
    public function handleRequest(string $method): void {
        try {
            switch ($method) {
                case 'HEAD':
                case 'GET':
                    $action = $_GET['action'] ?? '';
                    if ($action === 'get_versions' || $action === 'versions') {
                        $songId = $_GET['song_id'] ?? '';
                        if (!$songId) {
                            Response::error('Thiếu tham số song_id');
                            return;
                        }
                        $versions = SongService::getVersions($songId);
                        Response::ok(['data' => $versions]);
                        return;
                    }

                    if ($action === 'get' || (!empty($_GET['id']) && $action === '')) {
                        $songId = trim($_GET['id'] ?? ($_GET['song_id'] ?? ''));
                        if (!$songId) {
                            Response::error('Thiếu tham số song_id');
                            return;
                        }
                        $song = SongService::getById($songId);
                        if ($song) {
                            Response::ok(['data' => $song] + $song);
                            return;
                        }
                        Response::error('Không tìm thấy bài hát', 404);
                        return;
                    }

                    if ($action === 'taxonomy') {
                        $taxonomy = SongService::getTaxonomy();
                        Response::ok(['data' => $taxonomy] + $taxonomy);
                        return;
                    }

                    if ($action === 'search' || isset($_GET['q']) || isset($_GET['season']) || isset($_GET['theme']) || isset($_GET['category'])) {
                        $q = trim($_GET['q'] ?? ($_GET['lyric_search'] ?? ''));
                        $filters = [
                            'season'      => trim($_GET['season'] ?? ''),
                            'theme'       => trim($_GET['theme'] ?? ''),
                            'category'    => trim($_GET['category'] ?? ''),
                            'category_id' => isset($_GET['category_id']) && $_GET['category_id'] !== '' ? (int)$_GET['category_id'] : null,
                            'mode'        => trim($_GET['mode'] ?? 'title'),
                            'key'         => trim($_GET['key'] ?? ''),
                            'sort'        => trim($_GET['sort'] ?? 'num'),
                            'limit'       => isset($_GET['limit']) ? min(200, max(1, (int)$_GET['limit'])) : 200,
                            'offset'      => max(0, (int)($_GET['offset'] ?? 0))
                        ];
                        Response::ok(SongService::searchPage($q, $filters));
                        return;
                    }

                    $lyric = trim($_GET['lyric_search'] ?? '');
                    if ($lyric !== '') {
                        $data = SongService::searchByLyric($lyric);
                        Response::ok(['data' => $data]);
                        break;
                    }

                    // ApiService unwraps data for LibraryUI; hash and body use the same public cache snapshot.
                    $isGuest = !Auth::isBanhat() && !Auth::isAdmin();
                    if ($isGuest) {
                        $cacheFile = SongService::cachePath();
                        if (!file_exists($cacheFile) || (time() - filemtime($cacheFile) >= 3600)) {
                            SongService::writePublicCache();
                        }

                        if (file_exists($cacheFile)) {
                            $cachedJson = (string)file_get_contents($cacheFile);
                            $rawEtag = hash('sha256', $cachedJson);
                            $etag = '"' . $rawEtag . '"';

                            header('ETag: ' . $etag);
                            header('Cache-Control: no-cache, must-revalidate');

                            $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
                            if ($ifNoneMatch !== '') {
                                $clientEtags = array_map(function($tag) {
                                    $tag = trim($tag);
                                    if (strpos($tag, 'W/') === 0) $tag = substr($tag, 2);
                                    return trim($tag, '"');
                                }, explode(',', $ifNoneMatch));

                                if (in_array('*', $clientEtags, true) || in_array($rawEtag, $clientEtags, true)) {
                                    if (ob_get_level() > 0) {
                                        ob_end_clean();
                                    }
                                    http_response_code(304);
                                    exit;
                                }
                            }

                            if ($method === 'HEAD') {
                                if (ob_get_level() > 0) ob_end_clean();
                                exit;
                            }

                            echo '{"success":true,"data":';
                            echo $cachedJson;
                            echo '}';
                            exit;
                        }
                    }

                    header('Cache-Control: private, no-cache');
                    $data = SongService::getAll();
                    Response::ok(['data' => $data]);
                    break;

                case 'POST':
                    $action = $_GET['action'] ?? '';
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];

                    // 1. Lưu phiên bản người dùng
                    if ($action === 'save_version') {
                        Auth::requireBanhat();
                        if (empty($body['song_id']) || empty($body['xml'])) {
                            Response::error('Lỗi: Thiếu tham số song_id hoặc xml.');
                            return;
                        }
                        $versionName = trim($body['version_name'] ?? '');
                        $versionId   = !empty($body['version_id']) ? (int)$body['version_id'] : null;
                        $description = $body['description'] ?? null;

                        $result = SongService::saveVersion($body['song_id'], $body['xml'], $versionName, $versionId, $description);
                        if (!$result['success']) {
                            Response::error($result['message']);
                        } else {
                            Response::ok(['data' => $result['data'] ?? []] + ($result['data'] ?? []), $result['message']);
                        }
                        return;
                    }

                    // 2. Xóa phiên bản người dùng
                    if ($action === 'delete_version') {
                        Auth::requireBanhat();
                        $versionId = !empty($body['version_id']) ? (int)$body['version_id'] : (int)($_GET['version_id'] ?? 0);
                        if (!$versionId) {
                            Response::error('Lỗi: Thiếu version_id.');
                            return;
                        }
                        $result = SongService::deleteVersion($versionId);
                        if (!$result['success']) {
                            Response::error($result['message']);
                        } else {
                            Response::ok(['data' => []], $result['message']);
                        }
                        return;
                    }

                    if ($action === 'save_xml') {
                        // Lưu hợp âm vào XML gốc — Ban Hát và Admin đều có quyền
                        Auth::requireBanhat();
                        if (empty($body['filepath']) || empty($body['xml'])) {
                            Response::error('Lỗi: Thiếu tham số filepath hoặc xml.');
                            return;
                        }
                        $result = SongService::saveXml($body['filepath'], $body['xml']);
                        if (!$result['success']) {
                            Response::error($result['message'], ($result['code'] ?? '') === 'forbidden' ? 403 : 400);
                        } else {
                            Response::ok(['data' => [], 'message' => $result['message']]);
                        }
                        return;
                    }

                    if ($action === 'restore_xml') {
                        Auth::requireBanhat();
                        if (empty($body['filepath'])) {
                            Response::error('Lỗi: Thiếu tham số filepath.');
                            return;
                        }
                        $result = SongService::restoreXmlBackup($body['filepath']);
                        if (!$result['success']) {
                            Response::error($result['message'], ($result['code'] ?? '') === 'forbidden' ? 403 : 400);
                        } else {
                            Response::ok(['data' => [], 'message' => $result['message']]);
                        }
                        return;
                    }

                    if ($action === 'rebuild_fts') {
                        Auth::requireAdmin();
                        $count = SongService::rebuildFtsIndex();
                        Response::ok(['data' => ['indexed' => $count], 'indexed' => $count], "Đã tái tạo thành công chỉ mục FTS5 cho {$count} bài hát.");
                        return;
                    }

                    // Thêm bài hát mới — chỉ Admin
                    Auth::requireAdmin();
                    $result = SongService::add($body);
                    if (!$result['success']) Response::error($result['message'], 400);
                    else Response::ok(['data' => $result] + $result);
                    break;

                case 'PUT':
                    Auth::requireLeader();
                    $id   = $_GET['id'] ?? null;
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (!$id) { Response::error('Missing id'); return; }
                    $result = SongService::update($id, $body);
                    if (!$result['success']) Response::error($result['message'], ($result['code'] ?? '') === 'not_found' ? 404 : 400);
                    else Response::ok(['data' => $result] + $result);
                    break;

                case 'DELETE':
                    Auth::requireAdmin();
                    $id = $_GET['id'] ?? null;
                    if (!$id) { Response::error('Missing id'); return; }
                    $result = SongService::delete($id);
                    if (!$result['success']) Response::error($result['message'], 400);
                    else Response::ok(['data' => $result] + $result);
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (Throwable $e) {
            Response::serverError($e, 'Song');
        }
    }
}
