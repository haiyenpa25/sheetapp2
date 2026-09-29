@echo off
REM ── DISABLED trong đợt ROADMAP5 (2026-09-29) ──────────────────────────────
REM Auto-push đang tắt để tránh 2 tác nhân ghi đè nhau (xem ROADMAP5.md Phần 0,
REM "Dieu kien tien quyet"). Commit thu cong tren nhanh feature/roadmap5,
REM chu du an duyet roi moi merge. Xoa dong "exit /b 0" ben duoi de bat lai.
exit /b 0
if exist "C:\Program Files\Git\cmd\git.exe" (
    set GIT_EXE=C:\Program Files\Git\cmd\git.exe
) else if exist "C:\Users\CNS-MSI-004\.git-bin\cmd\git.exe" (
    set GIT_EXE=C:\Users\CNS-MSI-004\.git-bin\cmd\git.exe
) else (
    set GIT_EXE=git
)

set NODE_EXE=C:\Program Files\nodejs\node.exe
if not exist "%NODE_EXE%" (
    set NODE_EXE=node
)

set PHP_EXE=C:\xampp\php\php.exe
if not exist "%PHP_EXE%" (
    set PHP_EXE=php
)

echo [1/4] Regenerate Service Worker Precache Manifest...
"%PHP_EXE%" tools/generate_sw_manifest.php

echo [2/4] Regenerate Gitnexus Second Brain Code Map...
"%NODE_EXE%" tools/generate_code_map.js

echo [3/4] Staging and committing changes...
"%GIT_EXE%" config user.name "AI Agent"
"%GIT_EXE%" config user.email "agent@sheet.hyb.io.vn"
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Auto-sync from Antigravity: %date% %time%"

echo [4/4] Pushing to GitHub repository...
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never
"%GIT_EXE%" push origin main
if errorlevel 1 (
    echo [Warning] Git push can require manual authentication or network. Local commit created.
)

echo Sync completed successfully!
