<?php
/**
 * api/services/ManagerService.php
 * Business logic cho phân hệ Quản lý & Cộng tác người dùng (/manager/)
 * Facade điều phối các helper chuyên biệt (ManagerUserHelper, ManagerRepertoireHelper)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/AuthPolicy.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/SongService.php';
require_once __DIR__ . '/UserService.php';
require_once __DIR__ . '/ManagerUserHelper.php';
require_once __DIR__ . '/ManagerRepertoireHelper.php';

class ManagerService {

    /**
     * Lấy thống kê tổng quan KPI
     */
    public static function getStats(): array {
        $pdo = DB::get();

        $totalSongs = (int)$pdo->query("SELECT COUNT(*) FROM songs")->fetchColumn();
        $totalCategories = (int)$pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn();
        $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $totalChordSets = (int)$pdo->query("SELECT COUNT(*) FROM user_chord_sets WHERE is_public = 1")->fetchColumn();
        $totalVersions = (int)$pdo->query("SELECT COUNT(*) FROM song_versions")->fetchColumn();

        // Top người đóng góp tích cực
        $topContributors = $pdo->query("
            SELECT u.id, u.username, u.display_name, u.role, u.instrument,
                   COUNT(DISTINCT c.id) as chord_sets_count,
                   COUNT(DISTINCT v.id) as versions_count,
                   (COUNT(DISTINCT c.id) + COUNT(DISTINCT v.id)) as total_contributions
            FROM users u
            LEFT JOIN user_chord_sets c ON u.id = c.user_id AND c.is_public = 1
            LEFT JOIN song_versions v ON u.id = v.user_id
            GROUP BY u.id
            ORDER BY total_contributions DESC, u.created_at ASC
            LIMIT 6
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Phân bố theo thể loại
        $categoryBreakdown = $pdo->query("
            SELECT c.id, c.name, c.icon, c.slug, COUNT(s.id) as song_count
            FROM categories c
            LEFT JOIN songs s ON c.id = s.category_id
            GROUP BY c.id
            ORDER BY c.display_order ASC, c.id ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        return [
            'total_songs' => $totalSongs,
            'total_categories' => $totalCategories,
            'total_users' => $totalUsers,
            'total_chord_sets' => $totalChordSets,
            'total_versions' => $totalVersions,
            'top_contributors' => $topContributors,
            'category_breakdown' => $categoryBreakdown
        ];
    }

    /**
     * Lấy danh sách kho bài hát kết hợp danh mục và các bản clone/hợp âm của thành viên
     */
    public static function getRepertoire(array $filters = []): array {
        return ManagerRepertoireHelper::getRepertoire($filters);
    }

    /**
     * Quản lý cây thể loại danh mục (Admin Only)
     */
    public static function manageCategory(string $action, array $data): array {
        return ManagerRepertoireHelper::manageCategory($action, $data);
    }

    /**
     * Tìm kiếm bài hát siêu tốc cho Live Autocomplete Picker trên toàn bộ 903 bài
     */
    public static function searchSongsFast(string $keyword): array {
        return ManagerRepertoireHelper::searchSongsFast($keyword);
    }

    /**
     * Lấy toàn bộ thông tin chi tiết của 1 bài hát được chọn (Metadata + Master HD + Toàn bộ hợp âm thành viên)
     */
    public static function getSongDetails(string $songId): array {
        return ManagerRepertoireHelper::getSongDetails($songId);
    }

    /**
     * Cập nhật thể loại cho bài hát
     */
    public static function updateSongCategory(string $songId, int $categoryId): array {
        return ManagerRepertoireHelper::updateSongCategory($songId, $categoryId);
    }

    /**
     * Quản lý danh sách thành viên cho Admin & Ban Hát
     */
    public static function getUsersList(): array {
        return ManagerUserHelper::getUsersList();
    }

    /**
     * Thao tác quản trị tài khoản người dùng (Admin Only)
     */
    public static function manageUser(string $action, array $data): array {
        return ManagerUserHelper::manageUser($action, $data);
    }

    /**
     * Lấy danh sách bộ hợp âm cộng đồng (hỗ trợ lọc theo tác giả, nhạc cụ, thể loại)
     */
    public static function getCommunityChordSets(array $filters = []): array {
        $pdo = DB::get();

        $where = ["cs.is_public = 1"];
        $params = [];

        if (!empty($filters['song_id'])) {
            $where[] = "cs.song_id = ?";
            $params[] = trim($filters['song_id']);
        }

        if (!empty($filters['user_id'])) {
            $where[] = "cs.user_id = ?";
            $params[] = (int)$filters['user_id'];
        }

        if (!empty($filters['username'])) {
            $where[] = "cs.username = ?";
            $params[] = trim($filters['username']);
        }

        if (!empty($filters['instrument_type'])) {
            $where[] = "cs.instrument_type = ?";
            $params[] = trim($filters['instrument_type']);
        }

        if (!empty($filters['category_id'])) {
            $where[] = "s.category_id = ?";
            $params[] = (int)$filters['category_id'];
        }

        if (!empty($filters['recommended_only'])) {
            $where[] = "cs.is_recommended = 1";
        }

        if (!empty($filters['keyword'])) {
            $kw = '%' . trim($filters['keyword']) . '%';
            $where[] = "(cs.set_name LIKE ? OR s.title LIKE ? OR cs.username LIKE ? OR u.display_name LIKE ?)";
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $sqlWhere = implode(" AND ", $where);
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : 60;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        $sql = "
            SELECT cs.id, cs.song_id, cs.user_id, cs.username, cs.set_name,
                   cs.instrument_type, cs.capo_fret, cs.custom_tempo, cs.chord_count,
                   cs.notes_guide, cs.is_public, cs.is_recommended, cs.review_status, cs.views_count,
                   cs.created_at, cs.updated_at,
                   u.display_name, u.role as user_role, u.instrument as user_instrument, u.avatar_url,
                   s.title as song_title, s.httlvnId, s.defaultKey,
                   c.name as category_name, c.icon as category_icon
            FROM user_chord_sets cs
            JOIN songs s ON cs.song_id = s.id
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE $sqlWhere
            ORDER BY cs.is_recommended DESC, cs.updated_at DESC, cs.created_at DESC
            LIMIT $limit OFFSET $offset
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Thực hiện Clone / Fork bài hát ra bản riêng của User đăng nhập
     * BẢO VỆ BẢN GỐC MASTER TUYỆT ĐỐI KHÔNG BỊ GHI ĐÈ
     */
    public static function forkSong(array $params): array {
        Auth::requireLogin();
        $pdo = DB::get();

        $userId   = Auth::userId();
        $username = Auth::username();
        $songId   = trim($params['song_id'] ?? '');
        $forkType = trim($params['fork_type'] ?? 'chord_set'); // 'chord_set' | 'score_version'

        if (!$songId) {
            return ['success' => false, 'message' => 'Thiếu tham số song_id'];
        }

        // Kiểm tra bài hát gốc
        $song = $pdo->prepare("SELECT * FROM songs WHERE id = ?");
        $song->execute([$songId]);
        $songData = $song->fetch(PDO::FETCH_ASSOC);
        if (!$songData) {
            return ['success' => false, 'message' => 'Không tìm thấy bài hát gốc'];
        }

        // Lấy thông tin user
        $userRow = $pdo->prepare("SELECT display_name, instrument FROM users WHERE id = ?");
        $userRow->execute([$userId]);
        $userInfo = $userRow->fetch(PDO::FETCH_ASSOC) ?: ['display_name' => $username, 'instrument' => 'guitar'];
        $displayName = $userInfo['display_name'] ?: $username;

        if ($forkType === 'chord_set') {
            $setName = trim($params['set_name'] ?? '');
            if (!$setName) {
                $instrumentName = ucfirst($params['instrument_type'] ?? $userInfo['instrument'] ?? 'Guitar');
                $setName = "Bản {$instrumentName} của " . $displayName;
            }

            $instrument = trim($params['instrument_type'] ?? $userInfo['instrument'] ?? 'guitar');
            $capoFret   = isset($params['capo_fret']) ? (int)$params['capo_fret'] : 0;
            $tempo      = !empty($params['custom_tempo']) ? (int)$params['custom_tempo'] : null;
            $notesGuide = trim($params['notes_guide'] ?? '');
            $isPublic   = isset($params['is_public']) ? (int)$params['is_public'] : 1;

            // Nạp hợp âm khởi tạo (sao chép từ HD preset nếu có, để người dùng không phải gõ lại từ đầu)
            $baselineChords = ChordSetService::loadSet($songId, 'HD');
            if (empty($baselineChords)) {
                $baselineChords = [];
            }
            $chordCount = count($baselineChords);
            $chordsJson = json_encode($baselineChords, JSON_UNESCAPED_UNICODE);

            $ins = $pdo->prepare("
                INSERT INTO user_chord_sets 
                (song_id, user_id, username, set_name, instrument_type, capo_fret, custom_tempo, chord_count, notes_guide, chords_json, is_public)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $ins->execute([$songId, $userId, $username, $setName, $instrument, $capoFret, $tempo, $chordCount, $notesGuide, $chordsJson, $isPublic]);
            $newSetId = (int)$pdo->lastInsertId();

            // Đồng bộ ra file disk storage/data/chord_sets/{songId}/{safeName}.json để chord-canvas.js có thể load
            $safeDiskName = $username . '__' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $setName);
            ChordSetService::saveSet($songId, $safeDiskName, $baselineChords);

            return [
                'success' => true,
                'message' => "Đã tạo thành công bản phối hợp âm '{$setName}' cho tài khoản @{$username}!",
                'data' => [
                    'set_id' => $newSetId,
                    'song_id' => $songId,
                    'set_name' => $setName,
                    'disk_set_name' => $safeDiskName,
                    'instrument' => $instrument,
                    'capo' => $capoFret,
                    'redirect_url' => "index.php?song={$songId}&set=" . urlencode($safeDiskName)
                ]
            ];

        } elseif ($forkType === 'score_version') {
            // Fork toàn bộ MusicXML Score
            $versionTitle = trim($params['set_name'] ?? "Bản phối nốt của {$displayName}");
            $description  = trim($params['notes_guide'] ?? 'Bản chuyển soạn cá nhân');

            // Đọc nội dung MusicXML gốc
            $xmlPath = __DIR__ . '/../../' . ltrim($songData['xmlPath'], '/\\');
            if (!file_exists($xmlPath)) {
                return ['success' => false, 'message' => 'Không tìm thấy file MusicXML gốc của bài hát'];
            }
            $xmlContent = file_get_contents($xmlPath);

            $res = SongService::saveVersion($songId, $xmlContent, $versionTitle, null, $description);
            if ($res['success']) {
                $verData = $res['data'] ?? [];
                return [
                    'success' => true,
                    'message' => "Đã nhân bản thành công file MusicXML riêng biệt!",
                    'data' => [
                        'version_id' => $verData['id'] ?? null,
                        'song_id' => $songId,
                        'version_name' => $versionTitle,
                        'redirect_url' => "editor/?song={$songId}&version=" . ($verData['id'] ?? '')
                    ]
                ];
            } else {
                return ['success' => false, 'message' => $res['message']];
            }
        }

        return ['success' => false, 'message' => 'fork_type không hợp lệ'];
    }

    /**
     * Lưu cập nhật bộ hợp âm của user
     */
    public static function saveUserChordSet(int $setId, array $data): array {
        Auth::requireLogin();
        $pdo = DB::get();

        $stmt = $pdo->prepare("SELECT * FROM user_chord_sets WHERE id = ?");
        $stmt->execute([$setId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$current) {
            return ['success' => false, 'message' => 'Không tìm thấy bộ hợp âm'];
        }

        if ($current['user_id'] != Auth::userId() && !Auth::isAdmin()) {
            return ['success' => false, 'message' => 'Bạn không có quyền chỉnh sửa bộ hợp âm này'];
        }

        $setName     = !empty($data['set_name']) ? trim($data['set_name']) : $current['set_name'];
        $instrument  = !empty($data['instrument_type']) ? trim($data['instrument_type']) : $current['instrument_type'];
        $capoFret    = isset($data['capo_fret']) ? (int)$data['capo_fret'] : $current['capo_fret'];
        $customTempo = isset($data['custom_tempo']) ? (int)$data['custom_tempo'] : $current['custom_tempo'];
        $notesGuide  = isset($data['notes_guide']) ? trim($data['notes_guide']) : $current['notes_guide'];
        $isPublic    = isset($data['is_public']) ? (int)$data['is_public'] : $current['is_public'];

        $chordsJson  = $current['chords_json'];
        $chordCount  = $current['chord_count'];

        if (isset($data['chords']) && is_array($data['chords'])) {
            $chordsJson = json_encode($data['chords'], JSON_UNESCAPED_UNICODE);
            $chordCount = count($data['chords']);

            // Lưu ra file disk storage/data/chord_sets/
            $safeDiskName = $current['username'] . '__' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $setName);
            ChordSetService::saveSet($current['song_id'], $safeDiskName, $data['chords']);
        }

        $upd = $pdo->prepare("
            UPDATE user_chord_sets
            SET set_name = ?, instrument_type = ?, capo_fret = ?, custom_tempo = ?,
                notes_guide = ?, chords_json = ?, chord_count = ?, is_public = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $upd->execute([$setName, $instrument, $capoFret, $customTempo, $notesGuide, $chordsJson, $chordCount, $isPublic, $setId]);

        return [
            'success' => true,
            'message' => "Đã lưu cập nhật thành công bộ hợp âm '{$setName}'!",
            'data' => [
                'id' => $setId,
                'set_name' => $setName,
                'chord_count' => $chordCount
            ]
        ];
    }

    /**
     * Xóa bộ hợp âm người dùng
     */
    public static function deleteUserChordSet(int $setId): array {
        Auth::requireLogin();
        $pdo = DB::get();

        $stmt = $pdo->prepare("SELECT * FROM user_chord_sets WHERE id = ?");
        $stmt->execute([$setId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$current) {
            return ['success' => false, 'message' => 'Không tìm thấy bộ hợp âm'];
        }

        if ($current['user_id'] != Auth::userId() && !Auth::isAdmin()) {
            return ['success' => false, 'message' => 'Bạn không có quyền xóa bộ hợp âm này'];
        }

        // Xóa file disk nếu có
        $safeDiskName = $current['username'] . '__' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $current['set_name']);
        ChordSetService::deleteSet($current['song_id'], $safeDiskName);

        $del = $pdo->prepare("DELETE FROM user_chord_sets WHERE id = ?");
        $del->execute([$setId]);

        return ['success' => true, 'message' => 'Đã xóa bộ hợp âm thành công'];
    }

    /**
     * Ghim / Bỏ ghim huy hiệu "⭐ Ca Trưởng Khuyên Dùng" (Admin / Ca Trưởng only)
     */
    public static function toggleRecommend(int $setId): array {
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền ghim/bỏ ghim khuyên dùng');
        }
        $pdo = DB::get();

        $stmt = $pdo->prepare("SELECT is_recommended, set_name FROM user_chord_sets WHERE id = ?");
        $stmt->execute([$setId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return ['success' => false, 'message' => 'Không tìm thấy bộ hợp âm'];

        $newVal = $row['is_recommended'] == 1 ? 0 : 1;
        $upd = $pdo->prepare("UPDATE user_chord_sets SET is_recommended = ? WHERE id = ?");
        $upd->execute([$newVal, $setId]);

        $statusMsg = $newVal == 1 ? 'Đã ghim: ⭐ Ca Trưởng Khuyên Dùng' : 'Đã gỡ ghim khuyên dùng';
        return ['success' => true, 'message' => $statusMsg, 'is_recommended' => $newVal];
    }

    /**
     * Lấy các bản phối và hợp âm do chính User hiện tại tạo ra (My Profile Workspace)
     */
    public static function getMyContributions(): array {
        Auth::requireLogin();
        $userId = Auth::userId();
        $pdo = DB::get();

        // Lấy các chord sets của user
        $stmtChords = $pdo->prepare("
            SELECT cs.*, s.title as song_title, s.httlvnId, s.defaultKey, c.name as category_name
            FROM user_chord_sets cs
            JOIN songs s ON cs.song_id = s.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE cs.user_id = ?
            ORDER BY cs.created_at DESC
        ");
        $stmtChords->execute([$userId]);
        $myChordSets = $stmtChords->fetchAll(PDO::FETCH_ASSOC);

        // Lấy các song versions của user
        $stmtVers = $pdo->prepare("
            SELECT v.*, s.title as song_title, s.httlvnId, s.defaultKey
            FROM song_versions v
            JOIN songs s ON v.song_id = s.id
            WHERE v.user_id = ?
            ORDER BY v.created_at DESC
        ");
        $stmtVers->execute([$userId]);
        $myVersions = $stmtVers->fetchAll(PDO::FETCH_ASSOC);

        // Lấy user profile
        $user = $pdo->prepare("SELECT id, username, role, display_name, instrument, bio, created_at FROM users WHERE id = ?");
        $user->execute([$userId]);
        $profile = $user->fetch(PDO::FETCH_ASSOC);

        return [
            'profile'    => $profile,
            'chord_sets' => $myChordSets,
            'versions'   => $myVersions
        ];
    }

    /**
     * Lấy danh sách các phiên bản MusicXML Fork (Tab 3)
     */
    public static function getVersionsList(array $filters = []): array {
        $pdo = DB::get();

        $where = ["1=1"];
        $params = [];

        if (!empty($filters['song_id'])) {
            $where[] = "v.song_id = ?";
            $params[] = $filters['song_id'];
        }

        if (!empty($filters['user_id'])) {
            $where[] = "v.user_id = ?";
            $params[] = (int)$filters['user_id'];
        }

        if (!empty($filters['username'])) {
            $where[] = "v.username = ?";
            $params[] = $filters['username'];
        }

        if (!empty($filters['recommended_only'])) {
            $where[] = "v.is_recommended = 1";
        }

        if (!empty($filters['keyword'])) {
            $kw = '%' . $filters['keyword'] . '%';
            $where[] = "(v.version_name LIKE ? OR s.title LIKE ? OR s.httlvnId LIKE ? OR v.username LIKE ? OR u.display_name LIKE ?)";
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $limit = isset($filters['limit']) ? max(1, min(200, (int)$filters['limit'])) : 60;
        $offset = isset($filters['offset']) ? max(0, (int)$filters['offset']) : 0;

        $sql = "
            SELECT v.*,
                   s.title as song_title, s.httlvnId, s.defaultKey, s.xmlPath as master_xml_path,
                   u.display_name, u.role as user_role, u.instrument as user_instrument
            FROM song_versions v
            JOIN songs s ON v.song_id = s.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY v.is_recommended DESC, v.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $versions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Đếm tổng số để phân trang
        $countSql = "
            SELECT COUNT(*)
            FROM song_versions v
            JOIN songs s ON v.song_id = s.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE " . implode(' AND ', $where);
        $stmtCount = $pdo->prepare($countSql);
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        return [
            'versions' => $versions,
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset
        ];
    }

    /**
     * Xóa một phiên bản MusicXML Fork
     */
    public static function deleteVersion(int $versionId): array {
        Auth::requireLogin();
        $pdo = DB::get();
        $userId = Auth::userId();
        $isAdmin = Auth::isAdmin();

        $stmt = $pdo->prepare("SELECT * FROM song_versions WHERE id = ?");
        $stmt->execute([$versionId]);
        $version = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$version) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }

        if (!$isAdmin && $version['user_id'] != $userId) {
            return ['success' => false, 'message' => 'Bạn không có quyền xóa phiên bản này'];
        }

        // Xóa file MusicXML trên đĩa nếu tồn tại và nằm trong storage
        if (!empty($version['xml_path'])) {
            $absPath = __DIR__ . '/../../' . ltrim($version['xml_path'], '/\\');
            if (file_exists($absPath) && strpos(realpath($absPath), realpath(__DIR__ . '/../../storage')) === 0) {
                // Tuyệt đối không xóa file trong storage/Thanh ca/
                if (strpos($absPath, 'storage/Thanh ca/') === false) {
                    @unlink($absPath);
                    $bakFile = $absPath . '.bak';
                    if (file_exists($bakFile)) @unlink($bakFile);
                }
            }
        }

        $delStmt = $pdo->prepare("DELETE FROM song_versions WHERE id = ?");
        $delStmt->execute([$versionId]);

        return ['success' => true, 'message' => 'Đã xóa phiên bản MusicXML thành công'];
    }

    /**
     * Bật/Tắt ghim khuyên dùng cho phiên bản MusicXML
     */
    public static function toggleVersionRecommend(int $versionId): array {
        if (!AuthPolicy::can(Auth::role(), 'review_chord_set') && !Auth::isLeader() && !Auth::isAdmin()) {
            Response::forbidden('Chỉ Ca Trưởng hoặc Quản Trị Viên mới có quyền ghim/bỏ ghim khuyên dùng');
        }
        $pdo = DB::get();

        $stmt = $pdo->prepare("SELECT is_recommended FROM song_versions WHERE id = ?");
        $stmt->execute([$versionId]);
        $curr = $stmt->fetchColumn();

        if ($curr === false) {
            return ['success' => false, 'message' => 'Phiên bản không tồn tại'];
        }

        $newVal = $curr == 1 ? 0 : 1;
        $upStmt = $pdo->prepare("UPDATE song_versions SET is_recommended = ? WHERE id = ?");
        $upStmt->execute([$newVal, $versionId]);

        return [
            'success' => true,
            'is_recommended' => $newVal,
            'message' => $newVal == 1 ? 'Đã ghim khuyên dùng cho phiên bản này' : 'Đã bỏ ghim khuyên dùng'
        ];
    }
}
