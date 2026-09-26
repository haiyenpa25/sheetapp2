@echo off
setlocal EnableDelayedExpansion
title SheetApp Batch Import
cd /d "%~dp0.."

echo.
echo ================================================================
echo   SheetApp - Batch Import 903 Bai Thanh Ca HTTLVN
echo   Luu tai: storage\Thanh ca\NNN Ten Bai.xml
echo ================================================================
echo.

REM === Tim Chrome (dung ~dp de tranh loi khoang trang) ===
set "CHROME="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe"       set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if "!CHROME!"=="" (
    echo [!] Khong tim thay Chrome!
    pause & exit /b 1
)
echo [+] Tim thay Chrome: !CHROME!
echo.

REM === Dong Chrome cu ===
echo [1/4] Dong Chrome hien tai...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM === Tao profile rieng cho CDP ===
set "CDP_DIR=%TEMP%\SheetAppCDP"
if not exist "!CDP_DIR!" mkdir "!CDP_DIR!"

REM === Mo Chrome moi voi CDP port 9222 ===
echo [2/4] Mo Chrome voi CDP debugging...
start "" "!CHROME!" --remote-debugging-port=9222 --user-data-dir="!CDP_DIR!" --no-first-run --no-default-browser-check --disable-extensions "https://thanhca.httlvn.org/"

echo [+] Doi Chrome khoi dong (8 giay)...
timeout /t 8 /nobreak >nul

REM === Kiem tra CDP ===
echo [3/4] Kiem tra CDP port 9222...
set CDP_OK=0
for /L %%i in (1,1,10) do (
    curl -s --max-time 2 http://127.0.0.1:9222/json >nul 2>&1
    if not errorlevel 1 (
        set CDP_OK=1
        goto :CDP_READY
    )
    echo     Lan %%i: chua san sang, doi 2 giay...
    timeout /t 2 /nobreak >nul
)

:CDP_READY
if "!CDP_OK!"=="0" (
    echo [!] CDP van chua phan hoi sau 20 giay.
    echo     Thu vao Chrome va kiem tra thu cong:
    echo     http://127.0.0.1:9222/json
    echo.
    pause
)
echo [+] CDP OK - bat dau tai!
echo.

REM === Chay Python script ===
echo [4/4] Tai 903 bai Thanh Ca...
echo       Nhan Ctrl+C de tam dung. Chay lai se tu tiep tuc.
echo.
python tools\batch_fetch_all.py --resume

echo.
echo ================================================================
python tools\batch_fetch_all.py --status
echo    Xong! Mo SheetApp: http://localhost/SheetApp/
echo ================================================================
pause
