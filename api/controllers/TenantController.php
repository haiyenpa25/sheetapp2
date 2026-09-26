<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/TenantProvisioningService.php';

/**
 * TenantController
 *
 * REST API Quản lý Hệ thống Đa Hội Thánh (Multi-Tenant Management)
 * Dành riêng cho Quản Trị Viên Hệ Thống (Admin only).
 */
class TenantController
{
    public function handleRequest(string $method): void
    {
        Auth::requireAdmin();

        $action = $_GET['action'] ?? ($method === 'POST' ? 'create' : 'list');

        try {
            switch ($action) {
                case 'list':
                    $this->listTenants();
                    break;

                case 'stats':
                    $slug = trim((string)($_GET['slug'] ?? ''));
                    $this->getStats($slug);
                    break;

                case 'create':
                    if ($method !== 'POST') {
                        Response::methodNotAllowed(['POST']);
                        return;
                    }
                    $this->createTenant();
                    break;

                case 'backup':
                    if ($method !== 'POST') {
                        Response::methodNotAllowed(['POST']);
                        return;
                    }
                    $this->backupTenant();
                    break;

                default:
                    Response::badRequest("Hành động không hợp lệ: {$action}");
                    break;
            }
        } catch (InvalidArgumentException $e) {
            Response::badRequest($e->getMessage());
        } catch (Throwable $e) {
            error_log("[TenantController] Lỗi: " . $e->getMessage());
            Response::serverError("Không thể thực hiện tác vụ đa hội thánh: " . $e->getMessage());
        }
    }

    private function listTenants(): void
    {
        $tenants = TenantProvisioningService::listTenants();
        Response::ok(['tenants' => $tenants, 'total' => count($tenants)]);
    }

    private function getStats(string $slug): void
    {
        if ($slug === '') {
            Response::badRequest("Thiếu slug hội thánh.");
            return;
        }

        $stats = TenantProvisioningService::getTenantStats($slug);
        Response::ok($stats);
    }

    private function createTenant(): void
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? [];

        $slug = trim((string)($data['slug'] ?? ''));
        $name = trim((string)($data['name'] ?? ''));

        if ($slug === '' || $name === '') {
            Response::badRequest("Vui lòng cung cấp mã hội thánh (slug) và tên hội thánh.");
            return;
        }

        $adminData = [];
        if (!empty($data['admin_user'])) {
            $adminData['username'] = trim((string)$data['admin_user']);
        }
        if (!empty($data['admin_pass'])) {
            $adminData['password'] = (string)$data['admin_pass'];
        }
        if (!empty($data['admin_email'])) {
            $adminData['email'] = trim((string)$data['admin_email']);
        }

        $result = TenantProvisioningService::provisionTenant($slug, $name, $adminData);
        Response::created($result, "Hội thánh '{$name}' đã được khởi tạo thành công.");
    }

    private function backupTenant(): void
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? [];

        $slug = trim((string)($data['slug'] ?? ''));
        $passphrase = !empty($data['passphrase']) ? (string)$data['passphrase'] : null;

        if ($slug === '') {
            Response::badRequest("Thiếu mã hội thánh (slug).");
            return;
        }

        $result = TenantProvisioningService::backupTenant($slug, $passphrase);
        Response::ok($result, "Bản sao lưu hội thánh '{$slug}' đã được tạo thành công.");
    }
}
