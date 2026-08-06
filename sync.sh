#!/bin/bash
git add .
git commit -m "Auto-sync from Antigravity: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main
