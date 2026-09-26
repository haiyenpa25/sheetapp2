@echo off
set GIT_EXE=C:\Users\CNS-MSI-004\.git-bin\cmd\git.exe
if not exist "%GIT_EXE%" (
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
"%GIT_EXE%" push origin main

echo Sync completed successfully!
