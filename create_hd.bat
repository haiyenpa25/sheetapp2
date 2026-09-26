@echo off
REM Script hỗ trợ tạo bộ hợp âm "HD" cho tất cả bài hát (903 bài)
REM Phù hợp chạy trên Windows (XAMPP hoặc Docker Desktop)

echo =============================================
echo  TIEN HANH TAO BO HOP AM 'HD' CHO 903 BAI
echo =============================================

REM Kiểm tra xem có đang chạy trong môi trường Docker không
docker-compose --version >nul 2>&1
if "%ERRORLEVEL%" == "0" (
    echo [INFO] Tim thay Docker Compose. Dang chay qua Docker...
    docker-compose exec -T sheetapp php tools/create_hd_sets.php
    goto :end
)

docker compose version >nul 2>&1
if "%ERRORLEVEL%" == "0" (
    echo [INFO] Tim thay Docker Compose. Dang chay qua Docker...
    docker compose exec -T sheetapp php tools/create_hd_sets.php
    goto :end
)

REM Nếu không có Docker Compose thì chạy qua PHP CLI
echo [INFO] Khong tim thay Docker Compose. Thu chay truc tiep qua PHP CLI...
php --version >nul 2>&1
if "%ERRORLEVEL%" == "0" (
    php tools/create_hd_sets.php
) else (
    echo [ERROR] Khong tim thay lenh 'php' hay 'docker-compose'.
    echo Vui long mo XAMPP Shell hoac cai dat PHP vao PATH de chay!
)

:end
echo =============================================
echo  XONG!
echo =============================================
pause
