<?php
/**
 * api/services/ManagerService.php
 * Business logic cho phân hệ Quản lý & Cộng tác người dùng (/manager/)
 */
require_once __DIR__ . '/../core/DB.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/ChordSetService.php';
require_once __DIR__ . '/SongService.php';

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
        $pdo = DB::get();

        $where = ["1=1"];
        $params = [];

        if (!empty($filters['category_id'])) {
            $where[] = "s.category_id = ?";
            $params[] = (int)$filters['category_id'];
        }

        if (!empty($filters['keyword'])) {
            $kw = '%' . trim($filters['keyword']) . '%';
            $where[] = "(s.title LIKE ? OR s.id LIKE ? OR CAST(s.httlvnId AS TEXT) LIKE ? OR s.lyrics_text LIKE ?)";
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $sqlWhere = implode(" AND ", $where);
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : 50;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        // Đếm tổng số bài thỏa mãn điều kiện
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM songs s WHERE $sqlWhere");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        // Lấy danh sách bài
        $sql = "
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id,
                   c.name as category_name, c.icon as category_icon, c.slug as category_slug
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE $sqlWhere
            ORDER BY s.httlvnId ASC, s.title ASC
            LIMIT $limit OFFSET $offset
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $songs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Lấy tất cả user_chord_sets liên quan
        if (!empty($songs)) {
            $songIds = array_column($songs, 'id');
            $inClause = implode(',', array_fill(0, count($songIds), '?'));

            // User chord sets
            $stmtChords = $pdo->prepare("
                SELECT cs.id, cs.song_id, cs.user_id, cs.username, cs.set_name,
                       cs.instrument_type, cs.capo_fret, cs.custom_tempo, cs.chord_count,
                       cs.notes_guide, cs.is_public, cs.is_recommended, cs.views_count, cs.created_at,
                       u.display_name, u.avatar_url
                FROM user_chord_sets cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE cs.song_id IN ($inClause) AND cs.is_public = 1
                ORDER BY cs.is_recommended DESC, cs.created_at DESC
            ");
            $stmtChords->execute($songIds);
            $allChords = $stmtChords->fetchAll(PDO::FETCH_ASSOC);

            // Group by song_id
            $chordsBySong = [];
            foreach ($allChords as $ch) {
                $chordsBySong[$ch['song_id']][] = $ch;
            }

            // Song versions (MusicXML Forks)
            $stmtVers = $pdo->prepare("
                SELECT v.id, v.song_id, v.user_id, v.username, v.version_name, v.version_slug,
                       v.xml_path, v.description, v.is_default, v.is_recommended, v.created_at,
                       u.display_name
                FROM song_versions v
                LEFT JOIN users u ON v.user_id = u.id
                WHERE v.song_id IN ($inClause)
                ORDER BY v.created_at DESC
            ");
            $stmtVers->execute($songIds);
            $allVers = $stmtVers->fetchAll(PDO::FETCH_ASSOC);

            $versBySong = [];
            foreach ($allVers as $ver) {
                $versBySong[$ver['song_id']][] = $ver;
            }

            foreach ($songs as &$song) {
                $sid = $song['id'];
                $song['user_chord_sets'] = $chordsBySong[$sid] ?? [];
                $song['song_versions']   = $versBySong[$sid] ?? [];
            }
        }

        return [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'songs' => $songs
        ];
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
                   cs.notes_guide, cs.is_public, cs.is_recommended, cs.views_count,
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
        Auth::requireBanhat();
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
     * Quản lý danh sách thành viên cho Admin
     */
    public static function getUsersList(): array {
        $pdo = DB::get();
        return $pdo->query("
            SELECT u.id, u.username, u.role, u.display_name, u.instrument, u.avatar_url, u.status, u.created_at,
                   COUNT(DISTINCT cs.id) as chord_sets_count,
                   COUNT(DISTINCT sv.id) as versions_count
            FROM users u
            LEFT JOIN user_chord_sets cs ON u.id = cs.user_id
            LEFT JOIN song_versions sv ON u.id = sv.user_id
            GROUP BY u.id
            ORDER BY u.created_at ASC
        ")->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Thao tác quản trị tài khoản người dùng (Admin Only)
     */
    public static function manageUser(string $action, array $data): array {
        Auth::requireAdmin();
        $pdo = DB::get();

        switch ($action) {
            case 'create':
                $username = trim($data['username'] ?? '');
                $password = $data['password'] ?? '';
                $role = $data['role'] ?? 'banhat';
                $displayName = trim($data['display_name'] ?? $username);
                $instrument = trim($data['instrument'] ?? 'Guitar');

                if (!$username || !$password) {
                    return ['success' => false, 'message' => 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu'];
                }

                $check = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
                $check->execute([$username]);
                if ($check->fetchColumn() > 0) {
                    return ['success' => false, 'message' => 'Tên đăng nhập này đã tồn tại'];
                }

                $hash = password_hash($password, PASSWORD_DEFAULT);
                $ins = $pdo->prepare("INSERT INTO users (username, password_hash, role, display_name, instrument) VALUES (?, ?, ?, ?, ?)");
                $ins->execute([$username, $hash, $role, $displayName, $instrument]);
                return ['success' => true, 'message' => "Đã tạo tài khoản @{$username} thành công!"];

            case 'update_role':
                $userId = (int)($data['user_id'] ?? 0);
                $role = $data['role'] ?? 'banhat';
                if (!$userId) return ['success' => false, 'message' => 'Thiếu user_id'];

                $upd = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
                $upd->execute([$role, $userId]);
                return ['success' => true, 'message' => 'Đã cập nhật vai trò người dùng'];

            case 'reset_password':
                $userId = (int)($data['user_id'] ?? 0);
                $newPass = $data['new_password'] ?? '';
                if (!$userId || !$newPass) return ['success' => false, 'message' => 'Thiếu tham số'];

                $hash = password_hash($newPass, PASSWORD_DEFAULT);
                $upd = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $upd->execute([$hash, $userId]);
                return ['success' => true, 'message' => 'Đã đặt lại mật khẩu mới thành công'];

            case 'delete':
                $userId = (int)($data['user_id'] ?? 0);
                if (!$userId || $userId === Auth::userId()) {
                    return ['success' => false, 'message' => 'Không thể xóa tài khoản của chính bạn'];
                }

                $del = $pdo->prepare("DELETE FROM users WHERE id = ?");
                $del->execute([$userId]);
                return ['success' => true, 'message' => 'Đã xóa tài khoản'];

            case 'toggle_status':
                $userId = (int)($data['user_id'] ?? 0);
                if (!$userId || $userId === Auth::userId()) {
                    return ['success' => false, 'message' => 'Không thể khóa tài khoản của chính bạn'];
                }
                $currStatus = $pdo->prepare("SELECT status FROM users WHERE id = ?");
                $currStatus->execute([$userId]);
                $s = $currStatus->fetchColumn();
                $newStatus = ($s === 'locked') ? 'active' : 'locked';
                $upd = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
                $upd->execute([$newStatus, $userId]);
                return ['success' => true, 'status' => $newStatus, 'message' => $newStatus === 'locked' ? 'Đã khóa tài khoản' : 'Đã kích hoạt lại tài khoản'];

            default:
                return ['success' => false, 'message' => 'Action không hợp lệ'];
        }
    }

    /**
     * Quản lý cây thể loại danh mục (Admin Only)
     */
    public static function manageCategory(string $action, array $data): array {
        $pdo = DB::get();

        if ($action === 'list') {
            return $pdo->query("
                SELECT c.id, c.name, c.slug, c.icon, c.description, c.display_order,
                       COUNT(s.id) as song_count
                FROM categories c
                LEFT JOIN songs s ON c.id = s.category_id
                GROUP BY c.id
                ORDER BY c.display_order ASC, c.id ASC
            ")->fetchAll(PDO::FETCH_ASSOC);
        }

        Auth::requireAdmin();

        switch ($action) {
            case 'create':
                $name = trim($data['name'] ?? '');
                $icon = trim($data['icon'] ?? '🎵');
                $desc = trim($data['description'] ?? '');
                $order = (int)($data['display_order'] ?? 10);
                if (!$name) return ['success' => false, 'message' => 'Tên danh mục không được để trống'];

                $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower(str_replace(' ', '-', $name))) ?: 'cat-' . time();
                $ins = $pdo->prepare("INSERT INTO categories (name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?)");
                $ins->execute([$name, $slug, $icon, $desc, $order]);
                return ['success' => true, 'message' => "Đã thêm danh mục '{$name}'!"];

            case 'update':
                $id = (int)($data['id'] ?? 0);
                $name = trim($data['name'] ?? '');
                $icon = trim($data['icon'] ?? '🎵');
                $desc = trim($data['description'] ?? '');
                $order = (int)($data['display_order'] ?? 0);
                if (!$id || !$name) return ['success' => false, 'message' => 'Thiếu dữ liệu'];

                $upd = $pdo->prepare("UPDATE categories SET name = ?, icon = ?, description = ?, display_order = ? WHERE id = ?");
                $upd->execute([$name, $icon, $desc, $order, $id]);
                return ['success' => true, 'message' => "Đã cập nhật danh mục '{$name}'!"];

            case 'delete':
                $id = (int)($data['id'] ?? 0);
                if (!$id || $id === 1) return ['success' => false, 'message' => 'Không thể xóa danh mục mặc định'];

                // Chuyển các bài hát thuộc danh mục này về danh mục 1 (Thánh ca)
                $pdo->prepare("UPDATE songs SET category_id = 1 WHERE category_id = ?")->execute([$id]);
                $pdo->prepare("DELETE FROM categories WHERE id = ?")->execute([$id]);
                return ['success' => true, 'message' => 'Đã xóa danh mục thành công'];

            default:
                return ['success' => false, 'message' => 'Action không hợp lệ'];
        }
    }

    /**
     * Tìm kiếm bài hát siêu tốc cho Live Autocomplete Picker trên toàn bộ 903 bài
     */
    public static function searchSongsFast(string $keyword): array {
        $pdo = DB::get();
        $q = trim($keyword);
        if ($q === '') {
            // Trả 25 bài đầu tiên
            $stmt = $pdo->query("
                SELECT s.id, s.title, s.httlvnId, s.defaultKey, s.category_id,
                       c.name as category_name, c.icon as category_icon,
                       (SELECT COUNT(*) FROM user_chord_sets WHERE song_id = s.id AND is_public = 1) as chord_sets_count
                FROM songs s
                LEFT JOIN categories c ON s.category_id = c.id
                ORDER BY s.httlvnId ASC LIMIT 25
            ");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $kw = '%' . $q . '%';
        $stmt = $pdo->prepare("
            SELECT s.id, s.title, s.httlvnId, s.defaultKey, s.category_id,
                   c.name as category_name, c.icon as category_icon,
                   (SELECT COUNT(*) FROM user_chord_sets WHERE song_id = s.id AND is_public = 1) as chord_sets_count
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.title LIKE ? OR s.id LIKE ? OR CAST(s.httlvnId AS TEXT) LIKE ? OR s.lyrics_text LIKE ?
            ORDER BY 
                CASE 
                    WHEN CAST(s.httlvnId AS TEXT) = ? THEN 1
                    WHEN s.title LIKE ? THEN 2
                    ELSE 3
                END,
                s.httlvnId ASC
            LIMIT 30
        ");
        $stmt->execute([$kw, $kw, $kw, $kw, $q, $q . '%']);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Lấy toàn bộ thông tin chi tiết của 1 bài hát được chọn (Metadata + Master HD + Toàn bộ hợp âm thành viên)
     */
    public static function getSongDetails(string $songId): array {
        $pdo = DB::get();

        $stmt = $pdo->prepare("
            SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id, s.lyrics_text,
                   c.name as category_name, c.icon as category_icon, c.slug as category_slug
            FROM songs s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.id = ?
        ");
        $stmt->execute([$songId]);
        $song = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$song) return [];

        // Lấy tất cả user chord sets của bài này
        $stmtChords = $pdo->prepare("
            SELECT cs.*, u.display_name, u.role as user_role, u.instrument as user_instrument, u.avatar_url
            FROM user_chord_sets cs
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.song_id = ? AND cs.is_public = 1
            ORDER BY cs.is_recommended DESC, cs.created_at DESC
        ");
        $stmtChords->execute([$songId]);
        $song['user_chord_sets'] = $stmtChords->fetchAll(PDO::FETCH_ASSOC);

        // Kiểm tra xem có bộ HD chuẩn không
        $hdFile = ChordSetService::BASE_DIR . '/' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId) . '/HD.json';
        $hasHd = file_exists($hdFile);
        $hdChords = $hasHd ? (json_decode(file_get_contents($hdFile), true) ?? []) : [];
        $song['has_master_hd'] = $hasHd;
        $song['master_hd_chord_count'] = count($hdChords);

        // Lấy MusicXML versions
        $stmtVers = $pdo->prepare("
            SELECT v.*, u.display_name
            FROM song_versions v
            LEFT JOIN users u ON v.user_id = u.id
            WHERE v.song_id = ?
            ORDER BY v.created_at DESC
        ");
        $stmtVers->execute([$songId]);
        $song['song_versions'] = $stmtVers->fetchAll(PDO::FETCH_ASSOC);

        return $song;
    }

    /**
     * Cập nhật thể loại cho bài hát
     */
    public static function updateSongCategory(string $songId, int $categoryId): array {
        Auth::requireBanhat();
        $pdo = DB::get();

        $catCheck = $pdo->prepare("SELECT COUNT(*) FROM categories WHERE id = ?");
        $catCheck->execute([$categoryId]);
        if ($catCheck->fetchColumn() == 0) {
            return ['success' => false, 'message' => 'Thể loại không tồn tại'];
        }

        $upd = $pdo->prepare("UPDATE songs SET category_id = ? WHERE id = ?");
        $upd->execute([$categoryId, $songId]);
        SongService::invalidateCache();

        return ['success' => true, 'message' => 'Đã cập nhật thể loại bài hát thành công!'];
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
        Auth::requireBanhat();
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
