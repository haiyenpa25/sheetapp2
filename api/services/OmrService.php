<?php
/**
 * api/services/OmrService.php
 */
require_once __DIR__ . '/../core/DB.php';

class OmrService {
    public const WORKSPACE_DIR = __DIR__ . '/../../storage/omr_workspace/';

    public static function initWorkspace(): void {
        if (!is_dir(self::WORKSPACE_DIR)) mkdir(self::WORKSPACE_DIR, 0775, true);
    }

    public static function getAll(): array {
        return DB::query("SELECT * FROM omr_workspace ORDER BY created_at DESC");
    }

    public static function createJob(string $id, string $originalName): void {
        DB::run("INSERT INTO omr_workspace (id, original_filename, status) VALUES (?, ?, 'waiting')", [$id, $originalName]);
    }

    public static function updateStatus(string $id, string $status): void {
        DB::run("UPDATE omr_workspace SET status = ? WHERE id = ?", [$status, $id]);
    }

    public static function checkEngineHealth(): bool {
        $engineUrl = 'http://localhost:5555/health';
        $ctx = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]);
        $healthRes = @file_get_contents($engineUrl, false, $ctx);
        if ($healthRes) {
            $healthData = json_decode($healthRes, true);
            return ($healthData['status'] ?? '') === 'ok';
        }
        return false;
    }

    public static function startWorker(string $id): void {
        $workerPath = realpath(__DIR__ . '/../omr_worker.php');
        $phpBin     = PHP_BINARY;
        $logFile    = self::WORKSPACE_DIR . $id . '_worker.log';
        $command    = "start /b \"\" \"{$phpBin}\" \"{$workerPath}\" {$id} > \"{$logFile}\" 2>&1";
        pclose(popen($command, 'r'));
    }

    public static function deleteJob(string $id): void {
        $job = DB::run("SELECT * FROM omr_workspace WHERE id = ?", [$id])->fetch();
        if ($job) {
            $filesToDel = glob(self::WORKSPACE_DIR . $id . '.*');
            if ($filesToDel) {
                foreach ($filesToDel as $f) { @unlink($f); }
            }
            DB::run("DELETE FROM omr_workspace WHERE id = ?", [$id]);
        }
    }
}
