#!/bin/bash
# 1. Regenerate Service Worker Precache Manifest
php tools/generate_sw_manifest.php

# 2. Regenerate Gitnexus Second Brain Code Map
node tools/generate_code_map.js

# 3. Stage, commit and push to GitHub
git config user.name "AI Agent"
git config user.email "agent@sheet.hyb.io.vn"
git add .
git commit -m "Auto-sync from Antigravity: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main
