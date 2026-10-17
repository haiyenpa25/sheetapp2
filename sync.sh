#!/usr/bin/env bash
set -e

echo "[1/5] Checking JavaScript syntax..."
node tools/check_syntax.js

echo "[2/5] Regenerating Service Worker Precache Manifest..."
php tools/generate_sw_manifest.php

echo "[3/5] Regenerating Gitnexus Second Brain Code Map..."
node tools/generate_code_map.js

echo "[4/5] Staging and committing changes..."
git config merge.ours.driver true
git add -A
git commit -m "Auto-sync from Antigravity: $(date '+%Y-%m-%d %H:%M:%S')" || true

echo "[5/5] Rebasing and pushing to GitHub..."
git pull --rebase origin main || true
node tools/generate_code_map.js
git add CODE_MAP.md
git diff --cached --quiet || git commit --amend --no-edit
git push origin main || echo "[Warning] Push skipped or failed."

echo "Sync completed successfully!"
