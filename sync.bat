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

echo [1/3] Regenerate Gitnexus Second Brain Code Map...
"%NODE_EXE%" tools/generate_code_map.js

echo [2/3] Staging and committing changes...
"%GIT_EXE%" config user.name "AI Agent"
"%GIT_EXE%" config user.email "agent@sheet.hyb.io.vn"
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Auto-sync from Antigravity: %date% %time%"

echo [3/3] Pushing to GitHub repository...
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never
"%GIT_EXE%" push origin main
if errorlevel 1 (
    echo [Warning] Git push can require manual authentication or network. Local commit created.
)

echo Sync completed successfully!
