@echo off
set PHP_EXE=C:\xampp\php\php.exe
if not exist "%PHP_EXE%" (
    set PHP_EXE=php
)

echo [%date% %time%] === BAT DAU CHAY WORKER SHEETAPP 2.0 ===

echo [1/3] Kiem tra va nhac han bai tap ca doan (48 gio toi)...
"%PHP_EXE%" "%~dp0assignment_due_reminder.php"
if %errorlevel% neq 0 (
    echo [CANH BAO] assignment_due_reminder.php ket thuc voi ma loi %errorlevel%
)

echo.
echo [2/3] Xu ly hang doi chuyen phat thong bao (Email / Push)...
"%PHP_EXE%" "%~dp0notification_worker.php"
if %errorlevel% neq 0 (
    echo [CANH BAO] notification_worker.php ket thuc voi ma loi %errorlevel%
)

echo.
echo [3/3] Don dep phong Live Sync het han hoac da dong...
"%PHP_EXE%" "%~dp0cleanup_expired_rooms.php"
if %errorlevel% neq 0 (
    echo [CANH BAO] cleanup_expired_rooms.php ket thuc voi ma loi %errorlevel%
)

echo.
echo [%date% %time%] === HOAN TAT TAT CA WORKERS ===
