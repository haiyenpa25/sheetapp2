<?php
/**
 * api/index.php — Front Controller / Router
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}


// Bật gzip cho API response (giảm bandwidth mobile/iPad)
if (!ob_start('ob_gzhandler')) { ob_start(); }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
// API không cache — luôn lấy data mới nhất
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/core/Response.php';

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($route) {
        case 'users':
            require_once __DIR__ . '/controllers/UserController.php';
            $controller = new UserController();
            $controller->handleRequest($method);
            break;

        case 'categories':
            require_once __DIR__ . '/controllers/CategoryController.php';
            $controller = new CategoryController();
            $controller->handleRequest($method);
            break;

        case 'setlists':
            require_once __DIR__ . '/controllers/SetlistController.php';
            $controller = new SetlistController();
            $controller->handleRequest($method);
            break;

        case 'omr':
            require_once __DIR__ . '/controllers/OmrController.php';
            $controller = new OmrController();
            $controller->handleRequest($method);
            break;
            
        case 'songs':
            require_once __DIR__ . '/controllers/SongController.php';
            $controller = new SongController();
            $controller->handleRequest($method);
            break;
            
        case 'sessions':
            require_once __DIR__ . '/controllers/SessionController.php';
            $controller = new SessionController();
            $controller->handleRequest($method);
            break;

        case 'auth':
            require_once __DIR__ . '/controllers/AuthController.php';
            $controller = new AuthController();
            $controller->handleRequest($method);
            break;

        case 'chord_sets':
            require_once __DIR__ . '/controllers/ChordSetController.php';
            $controller = new ChordSetController();
            $controller->handleRequest($method);
            break;

        case 'annotations':
            require_once __DIR__ . '/controllers/AnnotationController.php';
            $controller = new AnnotationController();
            $controller->handleRequest($method);
            break;

        case 'import':
            require_once __DIR__ . '/controllers/ImportController.php';
            $controller = new ImportController();
            $controller->handleRequest($method);
            break;

        default:
            Response::notFound("Endpoint /api/{$route} không tồn tại.");
            break;
    }
} catch (Throwable $e) {
    Response::error('Lỗi Hệ Thống: ' . $e->getMessage(), 500);
}
