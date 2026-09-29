<?php
/**
 * api/controllers/ReviewController.php
 *
 * REST Controller quản lý Hàng đợi & Phê duyệt Đề xuất Hợp Âm / Bản Nhạc (Epic 4.2):
 * Route: /api/index.php?route=reviews
 *
 * Actions:
 * - GET  action=queue                    -> Danh sách đề xuất cần duyệt (Leader / Admin)
 * - GET  action=mine                     -> Đề xuất của tôi
 * - GET  action=detail&id={id}           -> Chi tiết đề xuất kèm Diff đầy đủ
 * - GET  action=hd_history&song_id={id}  -> Lịch sử phiên bản bộ HD để hoàn tác
 * - POST action=submit                   -> Gửi đề xuất phê duyệt
 * - POST action=approve                  -> Ca Trưởng duyệt đề xuất
 * - POST action=reject                   -> Ca Trưởng từ chối đề xuất kèm lý do
 * - POST action=withdraw                 -> Người gửi tự rút lại đề xuất
 * - POST action=rollback_hd              -> Ca Trưởng hoàn tác bộ HD về lịch sử
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ReviewService.php';
require_once __DIR__ . '/../services/ChordSetService.php';

class ReviewController {
    public function handleRequest(string $method): void {
        $action = trim($_GET['action'] ?? '');
        $userId = Auth::userId();

        try {
            // ── 1. GET Requests ──────────────────────────────────────
            if ($method === 'GET') {
                if ($action === 'hd_history') {
                    Auth::requireLogin();
                    $songId = trim($_GET['song_id'] ?? '');
                    if ($songId === '') {
                        Response::error('Thiếu mã bài hát (song_id)', 400);
                        return;
                    }
                    Response::ok(['data' => ReviewService::getHdHistory($songId)]);
                    return;
                }

                // Các action dưới đây yêu cầu đăng nhập
                Auth::requireLogin();

                if ($action === 'queue') {
                    if (!Auth::isLeader() && !Auth::isAdmin()) {
                        Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền xem hàng đợi phê duyệt');
                        return;
                    }

                    $filters = [
                        'status'      => $_GET['status'] ?? 'pending',
                        'target_type' => $_GET['target_type'] ?? '',
                        'review_type' => $_GET['review_type'] ?? '',
                        'song_id'     => $_GET['song_id'] ?? ''
                    ];
                    $page = max(1, (int)($_GET['page'] ?? 1));
                    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));

                    $data = ReviewService::getQueue($filters, $page, $limit);
                    Response::ok(['data' => $data]);
                    return;
                }

                if ($action === 'mine') {
                    $data = ReviewService::getMyRequests((int)$userId);
                    Response::ok(['data' => $data]);
                    return;
                }

                if ($action === 'detail') {
                    $id = (int)($_GET['id'] ?? 0);
                    if ($id <= 0) {
                        Response::error('Thiếu ID đề xuất', 400);
                        return;
                    }
                    $detail = ReviewService::getDetail($id);
                    if (!$detail) {
                        Response::notFound('Không tìm thấy đề xuất');
                        return;
                    }

                    // Chỉ người gửi hoặc Ca Trưởng/Admin mới được xem chi tiết
                    if ((int)$detail['submitted_by'] !== $userId && !Auth::isLeader() && !Auth::isAdmin()) {
                        Response::forbidden('Bạn không có quyền xem chi tiết đề xuất này');
                        return;
                    }

                    Response::ok(['data' => $detail]);
                    return;
                }

                Response::error('Action không hợp lệ', 400);
                return;
            }

            // ── 2. POST Requests (Yêu cầu đăng nhập) ───────────────────
            Auth::requireLogin();
            $rawInput = file_get_contents('php://input');
            $body = !empty($rawInput) ? (json_decode($rawInput, true) ?? []) : [];

            if ($action === 'submit') {
                $targetType = trim($body['target_type'] ?? ($_POST['target_type'] ?? 'chord_set'));
                $targetId = (int)($body['target_id'] ?? ($_POST['target_id'] ?? 0));
                $songId = trim($body['song_id'] ?? ($_POST['song_id'] ?? ''));
                $reviewType = trim($body['review_type'] ?? ($_POST['review_type'] ?? 'recommend'));
                $submitNote = trim($body['submit_note'] ?? ($_POST['submit_note'] ?? ''));

                if ($targetType === 'chord_set' && $targetId <= 0 && $songId !== '') {
                    $setName = trim($body['set_name'] ?? ($body['target_name'] ?? ($_POST['set_name'] ?? '')));
                    if ($setName !== '') {
                        if ($setName === 'HD' || $setName === 'default' || $setName === 'TLH') {
                            Response::error("Không thể đề xuất bộ chuẩn {$setName}", 400);
                            return;
                        }
                        $pdo = DB::get();
                        $stmtUser = $pdo->prepare("SELECT id FROM user_chord_sets WHERE song_id = ? AND user_id = ? AND (set_name = ? OR username || '__' || set_name = ?) LIMIT 1");
                        $stmtUser->execute([$songId, $userId, $setName, $setName]);
                        $foundId = $stmtUser->fetchColumn();
                        if ($foundId) {
                            $targetId = (int)$foundId;
                        } else {
                            $details = ChordSetService::getSetDetails($songId, $setName);
                            if ($details && isset($details['id'])) {
                                $targetId = (int)$details['id'];
                                if ((int)($details['user_id'] ?? 0) === 0 && $userId > 0) {
                                    $pdo->prepare("UPDATE user_chord_sets SET user_id = ?, username = ? WHERE id = ?")->execute([$userId, Auth::username() ?: 'user', $targetId]);
                                }
                            } else {
                                $chords = ChordSetService::loadSet($songId, $setName);
                                ChordSetService::saveSet($songId, $setName, $chords, (int)$userId, Auth::username() ?: 'user');
                                $details = ChordSetService::getSetDetails($songId, $setName);
                                if ($details && isset($details['id'])) {
                                    $targetId = (int)$details['id'];
                                }
                            }
                        }
                    }
                }

                $result = ReviewService::submit((int)$userId, $targetType, $targetId, $songId, $reviewType, $submitNote ?: null);
                Response::ok($result);
                return;
            }

            if ($action === 'approve') {
                if (!Auth::isLeader() && !Auth::isAdmin()) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền phê duyệt đề xuất');
                    return;
                }

                $id = (int)($body['id'] ?? ($_GET['id'] ?? 0));
                $note = trim($body['review_note'] ?? '');
                $result = ReviewService::approve($id, (int)$userId, $note ?: null);
                Response::ok($result);
                return;
            }

            if ($action === 'reject') {
                if (!Auth::isLeader() && !Auth::isAdmin()) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền từ chối đề xuất');
                    return;
                }

                $id = (int)($body['id'] ?? ($_GET['id'] ?? 0));
                $note = trim($body['review_note'] ?? '');
                if ($note === '') {
                    Response::error('Vui lòng nhập lý do từ chối để người gửi cải thiện bản phối', 400);
                    return;
                }

                $result = ReviewService::reject($id, (int)$userId, $note);
                Response::ok($result);
                return;
            }

            if ($action === 'withdraw') {
                $id = (int)($body['id'] ?? ($_GET['id'] ?? 0));
                $result = ReviewService::withdraw($id, (int)$userId);
                Response::ok($result);
                return;
            }

            if ($action === 'rollback_hd') {
                if (!Auth::isLeader() && !Auth::isAdmin()) {
                    Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền hoàn tác bộ hợp âm HD');
                    return;
                }

                $historyId = (int)($body['history_id'] ?? ($_POST['history_id'] ?? 0));
                if ($historyId <= 0) {
                    Response::error('Thiếu mã lịch sử hoàn tác', 400);
                    return;
                }

                $result = ReviewService::rollbackHd($historyId, (int)$userId);
                Response::ok($result);
                return;
            }

            Response::error('Action không hợp lệ', 400);

        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (DomainException $e) {
            Response::forbidden($e->getMessage());
        } catch (Throwable $e) {
            Response::serverError($e, 'ReviewController');
        }
    }
}
