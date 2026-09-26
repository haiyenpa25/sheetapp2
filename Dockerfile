# Sử dụng image PHP 8.2 kèm Apache làm base
FROM php:8.2-apache

# Bật rewrite module cho Apache (thường dùng cho Web)
RUN a2enmod rewrite

# Cập nhật OS và cài đặt các thư viện cần thiết
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    sqlite3 \
    python3 \
    python3-pip \
    python3-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt PDO SQLite extension cho PHP
RUN docker-php-ext-install pdo pdo_sqlite

# Khởi tạo môi trường ảo Python và cài đặt oemer (OMR Engine)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip
RUN pip install oemer

# Gán quyền thư mục storage để PHP có thể ghi file database và nhạc
RUN mkdir -p /var/www/html/storage/omr_workspace \
    && mkdir -p /var/www/html/storage/MoiNhanDien \
    && chown -R www-data:www-data /var/www/html/storage \
    && chmod -R 775 /var/www/html/storage

# Expose port 80
EXPOSE 80
