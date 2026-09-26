#!/bin/bash
# 1. Regenerate Gitnexus Second Brain Code Map
node tools/generate_code_map.js

# 2. Stage, commit and push to GitHub
git config user.name "AI Agent"
git config user.email "agent@sheet.hyb.io.vn"
git add .
git commit -m "Auto-sync from Antigravity: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main
