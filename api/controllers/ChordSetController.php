<?php
/**
 * api/controllers/ChordSetController.php
 * FIX: Thêm require_once Auth.php — thiếu dòng này gây HTTP 500 khi gọi Auth::requireBanhat()
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/HttpException.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ChordSetService.php';

class ChordSetController {
    public function handleRequest(string $method): void {
        try {
            if ($method === 'GET') {
                $action = $_GET['action'] ?? '';
                $songId = trim($_GET['songId'] ?? '');

                if (!$songId) { Response::error('Thiếu songId'); return; }

                if ($action === 'list') {
                    $userId = Auth::isLoggedIn() ? Auth::userId() : null;
                    $names = ChordSetService::listSets($songId, $userId);
                    Response::ok(['sets' => $names]);
                    return;
                }

                if ($action === 'load') {
                    $name = trim($_GET['name'] ?? '');
                    if (!$name) { Response::error('Thiếu name'); return; }
                    $chords = ChordSetService::loadSet($songId, $name);
                    $checksum = ChordSetService::getChecksum($songId, $name);
                    Response::ok(['chords' => $chords, 'checksum' => $checksum]);
                    return;
                }

                if ($action === 'details') {
                    $name = trim($_GET['name'] ?? '');
                    if (!$name) { Response::error('Thiếu name'); return; }
                    $details = ChordSetService::getSetDetails($songId, $name);
                    Response::ok(['details' => $details]);
                    return;
                }

                Response::error('action không hợp lệ');

            } elseif ($method === 'POST') {
                // Yêu cầu ít nhất quyền Ban Hát để lưu/xóa hợp âm
                Auth::requireBanhat();

                // R0-1 (ROADMAP5): gán MỘT LẦN DUY NHẤT ở đây cho mọi nhánh action bên dưới
                // (save/clone/fork/delete). Trước đây 2 biến này chỉ được gán bên trong nhánh
                // clone/delete, nên nhánh save luôn dùng biến chưa gán -> mọi người không phải
                // admin (kể cả chủ sở hữu HD thật) đều bị từ chối lưu hợp âm.
                $myChordCode = Auth::chordCode();
                $myUsername  = Auth::username();

                $body = json_decode(file_get_contents('php://input'), true);
                if (!$body) { Response::error('Body không hợp lệ'); return; }

                $action = trim($body['action'] ?? '');
                $songId = trim($body['songId'] ?? '');
                $name   = trim($body['name']   ?? $body['target'] ?? $body['targetName'] ?? '');

                if (!$songId) { Response::error('Thiếu songId'); return; }
                if ($action !== 'clone' && $action !== 'fork' && !$name) { Response::error('Thiếu name'); return; }

                if ($action === 'save') {
                    if (!Auth::isLoggedIn()) {
                        Response::unauthorized('Vui lòng đăng nhập để lưu hợp âm');
                        return;
                    }

                    if (!Auth::isBanhat() && !Auth::isAdmin()) {
                        Response::forbidden('Tài khoản khách chỉ được xem, không có quyền điền hoặc sửa hợp âm!');
                        return;
                    }

                    if ($name === 'default' || $name === 'TLH' || str_starts_with($name, '__')) {
                        Response::forbidden('Hợp âm bản gốc TLH là bất biến chuẩn mực hoặc tên bộ không hợp lệ!');
                        return;
                    }

                    // baseChecksum conflict detection (Ticket R2-3)
                    $baseChecksum = isset($body['baseChecksum']) ? trim((string)$body['baseChecksum']) : null;
                    if ($baseChecksum !== null && $baseChecksum !== '') {
                        $currentChecksum = ChordSetService::getChecksum($songId, $name);
                        if ($currentChecksum !== '' && $currentChecksum !== $baseChecksum) {
                            http_response_code(409);
                            echo json_encode([
                                'success' => false,
                                'error' => 'Dữ liệu trên máy chủ đã thay đổi bởi phiên làm việc khác (Conflict)',
                                'conflict' => true,
                                'baseChecksum' => $baseChecksum,
                                'currentChecksum' => $currentChecksum,
                                'serverChords' => ChordSetService::loadSet($songId, $name)
                            ], JSON_UNESCAPED_UNICODE);
                            return;
                        }
                    }

                    // Xử lý bộ HD chuẩn mực: D12 & B4
                    if (strcasecmp($name, 'HD') === 0) {
                        $canEditHd = Auth::isAdmin() || ($myChordCode && strcasecmp($myChordCode, 'HD') === 0);
                        if (!$canEditHd) {
                            Response::forbidden('Bạn không có quyền chỉnh sửa trực tiếp bộ hợp âm chuẩn HD. Vui lòng gửi Đề xuất (Review)!');
                            return;
                        }

                        $chords = $body['chords'] ?? [];
                        if (!is_array($chords) || empty($chords)) {
                            Response::error('chords phải là array và không được rỗng (Core Rule 1)');
                            return;
                        }

                        try {
                            $ok = ChordSetService::writeHd(
                                $songId,
                                $chords,
                                Auth::userId(),
                                Auth::username(),
                                "Cập nhật trực tiếp bộ HD bởi @" . (Auth::username() ?: 'system')
                            );
                            $newChecksum = ChordSetService::getChecksum($songId, $name);
                            $ok ? Response::ok(['message' => 'Đã lưu ' . count($chords) . ' hợp âm vào bộ HD và ghi nhận lịch sử', 'checksum' => $newChecksum])
                                : Response::error('Lỗi khi ghi bộ hợp âm HD');
                        } catch (Throwable $e) {
                            Response::error($e->getMessage());
                        }
                        return;
                    }

                    // STRICT OWNERSHIP RULE cho các bộ cá nhân khác:
                    // Mỗi người chỉ sửa bản phối của người đó (admin sửa ADMIN, tác giả sửa bộ của mình).
                    $isOwner = false;
                    if ($myChordCode && strcasecmp($name, $myChordCode) === 0) {
                        $isOwner = true;
                    } elseif ($myUsername && strcasecmp($name, $myUsername) === 0) {
                        $isOwner = true;
                    } elseif (Auth::isAdmin()) {
                        $isOwner = true;
                    }

                    if (!$isOwner) {
                        $ownerSet = $myChordCode ?: $myUsername;
                        Response::forbidden("Bản phối của người nào người đó sửa. Bạn chỉ có quyền chỉnh sửa bộ hợp âm cá nhân của mình ({$ownerSet})!");
                        return;
                    }

                    $chords = $body['chords'] ?? [];
                    if (!is_array($chords)) { Response::error('chords phải là array'); return; }

                    $ok = ChordSetService::saveSet($songId, $name, $chords, Auth::userId(), Auth::username());
                    $newChecksum = ChordSetService::getChecksum($songId, $name);
                    $ok ? Response::ok(['message' => 'Đã lưu ' . count($chords) . ' hợp âm vào bộ ' . $name, 'checksum' => $newChecksum])
                        : Response::error('Lỗi ghi file — kiểm tra quyền thư mục data/chord_sets');
                    return;
                }

                if ($action === 'clone') {
                    if (!Auth::isLoggedIn()) {
                        Response::unauthorized('Vui lòng đăng nhập để tạo hoặc sao chép bản phối');
                        return;
                    }

                    if (!Auth::isBanhat() && !Auth::isAdmin()) {
                        Response::forbidden('Tài khoản khách không có quyền tạo hoặc sao chép bản phối!');
                        return;
                    }

                    $source = trim($body['source'] ?? $body['sourceName'] ?? 'HD');
                    $target = trim($body['target'] ?? $body['targetName'] ?? $name ?? $myChordCode ?? $myUsername);

                    if (!$target) {
                        Response::error('Thiếu tên bộ hợp âm đích');
                        return;
                    }

                    // Nhạc công chỉ được tạo/clone sang bộ mang mã của chính mình
                    if (strcasecmp($target, $myChordCode) !== 0 && strcasecmp($target, $myUsername) !== 0) {
                        $ownerSet = $myChordCode ?: $myUsername;
                        Response::forbidden("Bạn chỉ có thể tạo hoặc sao chép sang bộ hợp âm cá nhân của chính mình ({$ownerSet})!");
                        return;
                    }

                    $ok = ChordSetService::cloneSet($songId, $source, $target, Auth::userId(), Auth::username());
                    $chords = ChordSetService::loadSet($songId, $target);
                    $ok ? Response::ok([
                        'message' => "Đã nhân bản hợp âm từ {$source} sang {$target}",
                        'set'     => $target,
                        'chords'  => $chords
                    ]) : Response::error('Lỗi khi sao chép bộ hợp âm');
                    return;
                }

                if ($action === 'fork') {
                    if (!Auth::isLoggedIn()) {
                        Response::unauthorized('Vui lòng đăng nhập để fork bản phối');
                        return;
                    }

                    if (!Auth::isBanhat() && !Auth::isAdmin()) {
                        Response::forbidden('Tài khoản khách không có quyền fork bản phối!');
                        return;
                    }

                    $source = trim($body['source'] ?? $body['sourceName'] ?? 'HD');
                    $target = trim($body['target'] ?? $body['targetName'] ?? $name ?? '');

                    if (!$target) {
                        Response::error('Thiếu tên bộ hợp âm đích');
                        return;
                    }

                    $res = ChordSetService::forkSet($songId, $source, $target, Auth::userId(), Auth::username(), $body);
                    if ($res['success']) {
                        Response::ok($res);
                    } else {
                        Response::error($res['message'] ?? 'Lỗi khi fork bộ hợp âm');
                    }
                    return;
                }

                if ($action === 'delete') {
                    if ($name === 'default' || $name === 'TLH' || $name === 'HD') {
                        Response::forbidden('Bộ hợp âm này được bảo vệ, không thể xóa!');
                        return;
                    }

                    if (!Auth::isAdmin()) {
                        if (strcasecmp($name, $myChordCode) !== 0 && strcasecmp($name, $myUsername) !== 0) {
                            Response::forbidden('Bạn không thể xóa bộ hợp âm của người khác!');
                            return;
                        }
                    }

                    $ok = ChordSetService::deleteSet($songId, $name, Auth::userId(), Auth::isAdmin());
                    $ok ? Response::ok(['message' => "Đã xóa bộ hợp âm {$name}"])
                        : Response::forbidden('Không thể xóa bộ hợp âm được bảo vệ');
                    return;
                }

                Response::error('action không hợp lệ');

            } else {
                Response::methodNotAllowed();
            }
        } catch (HttpException $httpEx) {
            // Phải bắt riêng TRƯỚC catch(Throwable) bên dưới: Auth::requireBanhat() (dòng 46)
            // ném HttpException(403) cho request không đủ quyền (vd. viewer). Nếu để lọt xuống
            // catch(Throwable), lỗi 403 rõ ràng bị biến thành 500 "Lỗi hệ thống" chung chung,
            // che mất lý do thật (phát hiện qua R0-1 test case viewer, ROADMAP5).
            Response::error($httpEx->getMessage(), $httpEx->getStatusCode());
        } catch (Throwable $e) {
            Response::serverError($e, 'ChordSet');
        }
    }
}
