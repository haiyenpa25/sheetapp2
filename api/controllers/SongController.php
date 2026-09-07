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
                    if ($action === 'get_versions') {
                        $songId = $_GET['song_id'] ?? '';
                        if (!$songId) {
                            Response::error('Thiếu tham số song_id');
                            return;
                        }
                        $versions = SongService::getVersions($songId);
                        Response::ok($versions);
                        return;
                    }

                    $lyric = trim($_GET['lyric_search'] ?? '');
                    if ($lyric !== '') {
                        $data = SongService::searchByLyric($lyric);
                        echo json_encode($data, JSON_UNESCAPED_UNICODE);
                        break;
                    }

                    // INTENTIONAL: Trả raw array vì LibraryUI.loadSongs() expect Array.isArray() trực tiếp.
                    // Tối ưu ETag + 304 Not Modified Caching và stream trực tiếp từ cache file
                    $cacheFile = __DIR__ . '/../../storage/data/songs_cache.json';
                    if (!file_exists($cacheFile) || (time() - filemtime($cacheFile) >= 3600)) {
                        SongService::getAll();
                    }

                    if (file_exists($cacheFile)) {
                        $mtime = filemtime($cacheFile);
                        $size = filesize($cacheFile);
                        $rawEtag = dechex($mtime) . '-' . dechex($size);
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

                        readfile($cacheFile);
                        exit;
                    }

                    $data = SongService::getAll();
                    echo json_encode($data, JSON_UNESCAPED_UNICODE);
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
                            Response::ok($result['data'] ?? [], $result['message']);
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
                            Response::ok([], $result['message']);
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
                            Response::error($result['message']);
                        } else {
                            Response::ok(['message' => $result['message']]);
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
                            Response::error($result['message']);
                        } else {
                            Response::ok(['message' => $result['message']]);
                        }
                        return;
                    }

                    // Thêm bài hát mới — chỉ Admin
                    Auth::requireAdmin();
                    echo json_encode(SongService::add($body), JSON_UNESCAPED_UNICODE);
                    break;

                case 'PUT':
                    Auth::requireAdmin();
                    $id   = $_GET['id'] ?? null;
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (!$id) { Response::error('Missing id'); return; }
                    echo json_encode(SongService::update($id, $body), JSON_UNESCAPED_UNICODE);
                    break;

                case 'DELETE':
                    Auth::requireAdmin();
                    $id = $_GET['id'] ?? null;
                    if (!$id) { Response::error('Missing id'); return; }
                    echo json_encode(SongService::delete($id), JSON_UNESCAPED_UNICODE);
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (PDOException $e) {
            Response::error('Lỗi Database: ' . $e->getMessage(), 500);
        }
    }
}
