<?php
/**
 * api/core/TenantContext.php
 *
 * Quản lý Ngữ cảnh Đa Hội Thánh (Multi-Tenant Context) — Epic 4.5 (ADR-005):
 * - Phân giải tenant slug từ Subdomain, Path, Header (X-Tenant-ID) hoặc Query Parameter.
 * - Kiểm tra tính hợp lệ và ngăn chặn tuyệt đối tấn công Path Traversal.
 * - Xác định đường dẫn file CSDL SQLite vật lý riêng biệt cho từng tenant.
 * - Tương thích ngược 100% với chế độ Single-Tenant mặc định khi không có tenant slug.
 */

declare(strict_types=1);

class TenantContext {
    private static ?string $currentTenant = null;
    private static string $tenantsBaseDir = '';

    /**
     * Khởi tạo đường dẫn thư mục gốc chứa các tenant
     */
    public static function getBaseDir(): string {
        if (self::$tenantsBaseDir === '') {
            self::$tenantsBaseDir = dirname(__DIR__, 2) . '/storage/tenants';
        }
        return self::$tenantsBaseDir;
    }

    /**
     * Cho phép cấu hình thư mục tenants (phục vụ test)
     */
    public static function setBaseDir(string $path): void {
        self::$tenantsBaseDir = rtrim(str_replace('\\', '/', $path), '/');
    }

    /**
     * Kiểm tra tính hợp lệ của Tenant Slug (chống Path Traversal)
     * Chỉ chấp nhận ký tự thường a-z, số 0-9, dấu gạch ngang và gạch dưới, độ dài từ 2 đến 50 ký tự.
     */
    public static function validateSlug(?string $slug): bool {
        if ($slug === null || $slug === '') {
            return false;
        }
        return (bool)preg_match('/^[a-z0-9][a-z0-9_-]{1,49}$/', $slug);
    }

    /**
     * Thiết lập tenant hiện hành
     *
     * @throws InvalidArgumentException Nếu slug không hợp lệ hoặc chứa ký tự nguy hiểm
     */
    public static function setTenant(?string $slug): void {
        if ($slug === null || $slug === '') {
            self::$currentTenant = null;
            return;
        }

        $clean = strtolower(trim($slug));
        if (!self::validateSlug($clean)) {
            throw new InvalidArgumentException("Tenant slug không hợp lệ hoặc chứa ký tự nguy hiểm: {$slug}");
        }

        self::$currentTenant = $clean;
    }

    /**
     * Lấy tenant slug hiện hành
     */
    public static function getTenant(): ?string {
        return self::$currentTenant;
    }

    /**
     * Kiểm tra xem phiên làm việc hiện tại có đang trong ngữ cảnh đa hội thánh không
     */
    public static function isMultiTenant(): bool {
        return self::$currentTenant !== null;
    }

    /**
     * Lấy đường dẫn file CSDL SQLite của tenant hiện hành (hoặc tenant chỉ định)
     */
    public static function getTenantDbPath(?string $slug = null): string {
        $target = $slug !== null ? strtolower(trim($slug)) : self::$currentTenant;
        if ($target === null || $target === '') {
            require_once __DIR__ . '/Config.php';
            return Config::get('DB_PATH');
        }

        if (!self::validateSlug($target)) {
            throw new InvalidArgumentException("Tenant slug không hợp lệ: {$target}");
        }

        return self::getBaseDir() . "/{$target}/data.sqlite";
    }

    /**
     * Tự động phân giải Tenant Slug từ HTTP Request
     * Thứ tự ưu tiên:
     * 1. Header HTTP: X-Tenant-ID
     * 2. Query param: ?tenant= hoặc ?t=
     * 3. Subdomain: {slug}.sheetapp.vn
     */
    public static function resolveFromRequest(): ?string {
        // 1. Kiểm tra Header X-Tenant-ID (cho API client / Mobile App)
        $header = $_SERVER['HTTP_X_TENANT_ID'] ?? null;
        if ($header && self::validateSlug($header)) {
            return strtolower(trim($header));
        }

        // 2. Kiểm tra Query Parameter (?tenant= hoặc ?t=)
        $param = $_GET['tenant'] ?? $_GET['t_slug'] ?? null;
        if ($param && is_string($param) && self::validateSlug($param)) {
            return strtolower(trim($param));
        }

        // 3. Phân giải từ Hostname / Subdomain
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $host = explode(':', $host)[0]; // loại bỏ port nếu có
        $parts = explode('.', $host);
        if (count($parts) >= 3) {
            $subdomain = strtolower($parts[0]);
            if ($subdomain !== 'www' && $subdomain !== 'api' && $subdomain !== 'sheet' && self::validateSlug($subdomain)) {
                return $subdomain;
            }
        }

        return null;
    }

    /**
     * Khôi phục trạng thái mặc định (Single-Tenant)
     */
    public static function reset(): void {
        self::$currentTenant = null;
    }
}
