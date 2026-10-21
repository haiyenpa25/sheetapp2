#!/usr/bin/env bash
# Chuẩn bị commit: kiểm cú pháp và sinh lại file tự động.
# Không add/commit/push — chủ dự án duyệt rồi mới merge (AI_AGENT.md mục 1.7).
set -e

echo "[1/3] Checking JavaScript syntax..."
node tools/check_syntax.js

echo "[2/3] Regenerating Service Worker Precache Manifest..."
php tools/generate_sw_manifest.php

echo "[3/3] Regenerating Gitnexus Second Brain Code Map..."
node tools/generate_code_map.js

echo "Done. Review 'git status' and commit on a branch; nothing was committed or pushed."
