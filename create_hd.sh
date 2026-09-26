#!/bin/bash
# Script hỗ trợ tạo bộ hợp âm (Chord Sets) "HD" cho tất cả bài hát (903 bài)
# Phù hợp chạy trên Linux/Server có cài Docker Compose

echo "============================================="
echo " TIẾN HÀNH TẠO BỘ HỢP ÂM 'HD' CHO 903 BÀI"
echo "============================================="

if command -v docker-compose &> /dev/null; then
    docker-compose exec -T sheetapp php tools/create_hd_sets.php
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose exec -T sheetapp php tools/create_hd_sets.php
else
    echo "Không tìm thấy Docker Compose. Thử chạy trực tiếp qua PHP CLI..."
    php tools/create_hd_sets.php
fi

echo "============================================="
echo " XONG!"
echo "============================================="
