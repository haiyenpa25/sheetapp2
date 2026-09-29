<?php
declare(strict_types=1);

/**
 * tests/lib/mock_php_input.php
 *
 * Cho phép test PHP CLI giả lập nội dung `php://input` (request body) khi gọi
 * thẳng một Controller, để bài test thực sự chạy qua code thật thay vì chép lại
 * logic phân quyền vào trong bài test (điểm yếu bị phát hiện ở
 * hd_history_and_permission_regression.php — xem ROADMAP5.md, R0-1).
 *
 * Cách dùng:
 *   mockPhpInput(json_encode(['action' => 'save', 'songId' => 'x', ...]));
 *   $controller->handleRequest('POST');   // đọc đúng body vừa mock
 *   restorePhpInput();                    // BẮT BUỘC gọi lại trước khi test kết thúc
 */

class MockPhpInputStream {
    private string $data = '';
    private int $position = 0;

    public function stream_open(string $path, string $mode, int $options, ?string &$openedPath): bool {
        $this->data = $GLOBALS['__TEST_PHP_INPUT__'] ?? '';
        $this->position = 0;
        return true;
    }

    public function stream_read(int $count): string|false {
        $ret = substr($this->data, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    public function stream_eof(): bool {
        return $this->position >= strlen($this->data);
    }

    public function stream_stat(): array {
        return [];
    }

    public function stream_seek(int $offset, int $whence = SEEK_SET): bool {
        return false;
    }

    public function url_stat(string $path, int $flags) {
        return false;
    }
}

/** Bật chế độ giả lập: mọi lời gọi file_get_contents('php://input') sau đó trả về $body. */
function mockPhpInput(string $body): void {
    $GLOBALS['__TEST_PHP_INPUT__'] = $body;
    if (in_array('php', stream_get_wrappers(), true)) {
        stream_wrapper_unregister('php');
    }
    stream_wrapper_register('php', MockPhpInputStream::class);
}

/** Khôi phục stream wrapper 'php' gốc — bắt buộc gọi sau mỗi lần mockPhpInput(). */
function restorePhpInput(): void {
    if (in_array('php', stream_get_wrappers(), true)) {
        stream_wrapper_unregister('php');
    }
    stream_wrapper_restore('php');
    unset($GLOBALS['__TEST_PHP_INPUT__']);
}
