@echo off
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

echo [1/5] Checking JavaScript syntax...
"%NODE_EXE%" tools/check_syntax.js
if errorlevel 1 (
    echo [Abort] JS syntax check failed.
    exit /b 1
)

echo [2/5] Regenerate Service Worker Precache Manifest...
"%PHP_EXE%" tools/generate_sw_manifest.php

echo [3/5] Regenerate Gitnexus Second Brain Code Map...
"%NODE_EXE%" tools/generate_code_map.js

echo [4/5] Staging and committing changes...
"%GIT_EXE%" config merge.ours.driver true
"%GIT_EXE%" add -A
"%GIT_EXE%" commit -m "Auto-sync from Antigravity: %date% %time%"

echo [5/5] Rebasing and pushing to GitHub repository...
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never
"%GIT_EXE%" pull --rebase origin main
"%NODE_EXE%" tools/generate_code_map.js
"%GIT_EXE%" add CODE_MAP.md
"%GIT_EXE%" diff --cached --quiet || "%GIT_EXE%" commit --amend --no-edit
"%GIT_EXE%" push origin main
if errorlevel 1 (
    echo [Warning] Git push can require manual authentication or network. Local commit created.
)

echo Sync completed successfully!
