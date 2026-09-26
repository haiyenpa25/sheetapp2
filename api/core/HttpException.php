<?php
declare(strict_types=1);

/**
 * api/core/HttpException.php — HTTP Exception with Status Code
 */
class HttpException extends RuntimeException {
    protected int $statusCode;

    public function __construct(int $statusCode, string $message = '', ?Throwable $previous = null) {
        $this->statusCode = $statusCode;
        parent::__construct($message, $statusCode, $previous);
    }

    public function getStatusCode(): int {
        return $this->statusCode;
    }
}
