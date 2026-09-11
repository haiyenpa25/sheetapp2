<?php
/**
 * api/controllers/ChordSetController.php
 * FIX: Thêm require_once Auth.php — thiếu dòng này gây HTTP 500 khi gọi Auth::requireBanhat()
 */
require_once __DIR__ . '/../core/Response.php';
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
                    $names = ChordSetService::listSets($songId);
                    Response::ok(['sets' => $names]);
                    return;
                }

                if ($action === 'load') {
                    $name = trim($_GET['name'] ?? '');
                    if (!$name) { Response::error('Thiếu name'); return; }
                    $chords = ChordSetService::loadSet($songId, $name);
                    Response::ok(['chords' => $chords]);
                    return;
                }

                Response::error('action không hợp lệ');

            } elseif ($method === 'POST') {
                // Yêu cầu ít nhất quyền Ban Hát để lưu/xóa hợp âm
                Auth::requireBanhat();

                $body = json_decode(file_get_contents('php://input'), true);
                if (!$body) { Response::error('Body không hợp lệ'); return; }

                $action = trim($body['action'] ?? '');
                $songId = trim($body['songId'] ?? '');
                $name   = trim($body['name']   ?? $body['target'] ?? $body['targetName'] ?? '');

                if (!$songId) { Response::error('Thiếu songId'); return; }
                if ($action !== 'clone' && !$name) { Response::error('Thiếu name'); return; }

                if ($action === 'save') {
                    $chords = $body['chords'] ?? [];
                    if (!is_array($chords)) { Response::error('chords phải là array'); return; }

                    if ($name === 'default' || $name === 'TLH') {
                        Response::forbidden('Hợp âm bản gốc TLH là bất biến, không thể chỉnh sửa!');
                        return;
                    }

                    // Ownership Guard:
                    // Admin có toàn quyền chỉnh sửa bất kỳ bộ nào.
                    // Nếu là banhat thường: Chỉ được sửa nếu $name khớp với mã hợp âm của mình (hoặc username của mình)
                    if (!Auth::isAdmin()) {
                        $myChordCode = Auth::chordCode();
                        $myUsername  = Auth::username();
                        $isOwner = false;
                        if ($myChordCode && strcasecmp($name, $myChordCode) === 0) {
                            $isOwner = true;
                        } elseif ($myUsername && strcasecmp($name, $myUsername) === 0) {
                            $isOwner = true;
                        }

                        if (!$isOwner) {
                            Response::forbidden("Bạn chỉ có quyền chỉnh sửa bộ hợp âm cá nhân của riêng mình (" . ($myChordCode ?: $myUsername) . ")!");
                            return;
                        }
                    }

                    $ok = ChordSetService::saveSet($songId, $name, $chords);
                    $ok ? Response::ok(['message' => 'Đã lưu ' . count($chords) . ' hợp âm vào bộ ' . $name])
                        : Response::error('Lỗi ghi file — kiểm tra quyền thư mục data/chord_sets');
                    return;
                }

                if ($action === 'clone') {
                    $source = trim($body['source'] ?? $body['sourceName'] ?? 'HD');
                    $target = trim($body['target'] ?? $body['targetName'] ?? $name ?? Auth::chordCode());
                    if (!$target) {
                        Response::error('Thiếu tên bộ hợp âm đích');
                        return;
                    }

                    if (!Auth::isAdmin()) {
                        $myChordCode = Auth::chordCode();
                        $myUsername  = Auth::username();
                        if (strcasecmp($target, $myChordCode) !== 0 && strcasecmp($target, $myUsername) !== 0) {
                            Response::forbidden('Chỉ có thể nhân bản sang bộ hợp âm cá nhân của chính bạn!');
                            return;
                        }
                    }

                    $ok = ChordSetService::cloneSet($songId, $source, $target);
                    $chords = ChordSetService::loadSet($songId, $target);
                    $ok ? Response::ok([
                        'message' => "Đã nhân bản hợp âm từ {$source} sang {$target}",
                        'set'     => $target,
                        'chords'  => $chords
                    ]) : Response::error('Lỗi khi sao chép bộ hợp âm');
                    return;
                }

                if ($action === 'delete') {
                    if ($name === 'default' || $name === 'TLH' || $name === 'HD') {
                        Response::forbidden('Bộ hợp âm này được bảo vệ, không thể xóa!');
                        return;
                    }

                    if (!Auth::isAdmin()) {
                        $myChordCode = Auth::chordCode();
                        $myUsername  = Auth::username();
                        if (strcasecmp($name, $myChordCode) !== 0 && strcasecmp($name, $myUsername) !== 0) {
                            Response::forbidden('Bạn không thể xóa bộ hợp âm của người khác!');
                            return;
                        }
                    }

                    ChordSetService::deleteSet($songId, $name);
                    Response::ok(['message' => "Đã xóa bộ hợp âm {$name}"]);
                    return;
                }

                Response::error('action không hợp lệ');

            } else {
                Response::methodNotAllowed();
            }
        } catch (Throwable $e) {
            Response::error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }
}
