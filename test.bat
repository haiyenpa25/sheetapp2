@echo off
setlocal
REM SheetApp2 Unified Test Runner Script (Windows CLI)

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"

where php >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PHP_BIN=php
) else if exist "C:\xampp\php\php.exe" (
    set PHP_BIN=C:\xampp\php\php.exe
) else (
    echo [ERROR] Khong tim thay trinh thuc thi PHP tren he thong. Vui long them php vao PATH hoac cai dat XAMPP.
    exit /b 1
)

"%PHP_BIN%" "%~dp0tests\run_all_tests.php" %*
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo [FAIL] Co loi trong qua trinh kiem thu. Exit code: %EXIT_CODE%
)

exit /b %EXIT_CODE%
