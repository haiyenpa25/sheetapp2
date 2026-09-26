@echo off
REM setup.bat — Cai dat dependencies cho SheetApp Python Tools
REM Chay file nay 1 lan truoc khi dung fetch_sheet.py

echo ============================================
echo  SheetApp Tools Setup
echo ============================================
echo.

echo [1/3] Kiem tra Python...
python --version
if errorlevel 1 (
    echo ERROR: Python chua duoc cai! Tai tu python.org
    pause
    exit /b 1
)

echo.
echo [2/3] Cai dat thu vien Python...
pip install websocket-client requests -q
if errorlevel 1 (
    echo WARN: pip install co loi
)
echo Cai dat xong!

echo.
echo [3/3] Tao thu muc can thiet...
mkdir ..\storage\sheets 2>nul
mkdir ..\storage\data\sessions 2>nul
echo Hoan tat!

echo.
echo ============================================
echo  Setup xong! Cach dung:
echo.
echo  BUOC 1: Mo Chrome voi CDP debug:
echo    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
echo.
echo  BUOC 2: Vao trang bai hat trong Chrome:
echo    https://thanhca.httlvn.org/thanh-ca-1/...?op=sheet
echo.
echo  BUOC 3: Chay fetch_sheet.py:
echo    python tools/fetch_sheet.py --cdp
echo.
echo  Hoac import truc tiep file .xml:
echo    python tools/fetch_sheet.py --file "D:\sheet.xml"
echo.
echo  Xem thu vien:
echo    python tools/fetch_sheet.py --list
echo ============================================
pause
