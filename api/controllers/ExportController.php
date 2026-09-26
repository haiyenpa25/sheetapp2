<?php
/**
 * api/controllers/ExportController.php
 *
 * Điều phối các yêu cầu xuất bản nhạc (ChordPro, Text, Booklets):
 * Route: /api/index.php?route=export
 * Actions / Formats:
 * - format=chordpro hoặc action=chordpro: Xuất ChordPro
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ChordProService.php';

class ExportController {
    public function handleRequest(string $method): void {
        if ($method !== 'GET') {
            Response::methodNotAllowed();
            return;
        }

        $format = strtolower(trim($_GET['format'] ?? ($_GET['action'] ?? 'chordpro')));
        $songId = trim($_GET['song_id'] ?? ($_GET['id'] ?? ''));

        if ($format === 'chordpro' || $format === 'text') {
            if ($songId === '') {
                Response::error('Thiếu mã bài hát (song_id)');
                return;
            }

            $chordSet = trim($_GET['set'] ?? ($_GET['chord_set'] ?? 'HD'));
            if ($chordSet === '') $chordSet = 'HD';
            $transpose = isset($_GET['transpose']) ? (int)$_GET['transpose'] : (isset($_GET['t']) ? (int)$_GET['t'] : 0);
            $download = !empty($_GET['download']);
            $isJson = isset($_GET['as_json']) && $_GET['as_json'] === '1';

            try {
                $chordProText = ChordProService::export($songId, $chordSet, $transpose);
                $filename = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId) . '.chordpro';

                if ($isJson) {
                    Response::ok([
                        'song_id'   => $songId,
                        'chord_set' => $chordSet,
                        'transpose' => $transpose,
                        'filename'  => $filename,
                        'content'   => $chordProText
                    ]);
                    return;
                }

                // Xuất file text/plain ChordPro
                header('Content-Type: text/plain; charset=utf-8');
                $disp = $download ? 'attachment' : 'inline';
                header("Content-Disposition: {$disp}; filename=\"{$filename}\"");
                echo $chordProText;
                exit;

            } catch (InvalidArgumentException $e) {
                Response::notFound($e->getMessage());
                return;
            } catch (Throwable $e) {
                Response::serverError($e, 'Export');
                return;
            }
        }

        Response::error("Định dạng xuất '{$format}' không được hỗ trợ", 400);
    }
}
