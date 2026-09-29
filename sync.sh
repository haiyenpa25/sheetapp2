#!/bin/bash
# ── DISABLED trong đợt ROADMAP5 (2026-09-29) ──────────────────────────────
# Auto-push đang tắt để tránh 2 tác nhân ghi đè nhau (xem ROADMAP5.md Phần 0,
# "Dieu kien tien quyet"). Commit thu cong tren nhanh feature/roadmap5,
# chu du an duyet roi moi merge. Xoa dong "exit 0" ben duoi de bat lai.
exit 0
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
