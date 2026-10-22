@echo off
set NODE_EXE=C:\Program Files\nodejs\node.exe
if not exist "%NODE_EXE%" (
    set NODE_EXE=node
)

set PHP_EXE=C:\xampp\php\php.exe
if not exist "%PHP_EXE%" (
    set PHP_EXE=php
)

rem Chuan bi commit: kiem cu phap va sinh lai file tu dong.
rem Khong add/commit/push - chu du an duyet roi moi merge (AI_AGENT.md muc 1.7).

echo [1/3] Checking JavaScript syntax...
"%NODE_EXE%" tools/check_syntax.js
if errorlevel 1 (
    echo [Abort] JS syntax check failed.
    exit /b 1
)

echo [2/3] Regenerate Service Worker Precache Manifest...
"%PHP_EXE%" tools/generate_sw_manifest.php
if errorlevel 1 exit /b 1

echo [3/3] Regenerate Gitnexus Second Brain Code Map...
"%NODE_EXE%" tools/generate_code_map.js
if errorlevel 1 exit /b 1

echo Done. Review "git status" and commit on a branch; nothing was committed or pushed.
