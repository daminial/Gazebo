# Полная инструкция: миграция с LiveKit Cloud на локальный сервер

## 📋 Оглавление
1. [Установка LiveKit Server](#1-установка-livekit-server)
2. [Настройка config.yaml](#2-настройка-configyaml)
3. [Nginx + Let's Encrypt](#3-nginx--lets-encrypt-ssl)
4. [Настройка фаервола](#4-настройка-фаервола)
5. [Запуск LiveKit](#5-запуск-livekit)
6. [Настройка FastAPI](#6-настройка-fastapi)
7. [Проверка работы](#7-проверка-работы)

---

## 1. Установка LiveKit Server

### Способ A: Docker (рекомендуется)

```bash
# 1. Установите Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Создайте директорию
mkdir -p ~/livekit && cd ~/livekit

# 3. Скопируйте config.yaml из проекта
cp /path/to/meetgazebo/scripts/livekit-config.yaml ./config.yaml
```

### Способ B: Бинарный файл

```bash
# Скачайте последнюю версию
wget https://github.com/livekit/livekit/releases/latest/download/livekit-server-linux-amd64.tar.gz
tar -xzf livekit-server-linux-amd64.tar.gz
sudo mv livekit-server /usr/local/bin/
sudo chmod +x /usr/local/bin/livekit-server
```

---

## 2. Настройка config.yaml

Отредактируйте `~/livekit/config.yaml`:

```yaml
# Сгенерируйте ключи:
# openssl rand -hex 16  (для API_KEY)
# openssl rand -hex 32  (для API_SECRET)

keys:
  your-api-key-here: your-api-secret-here

rtc:
  tcp_port: 7881
  udp_port: 7882
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  # Укажите ваш публичный IP
  # external_ips: ["203.0.113.1"]

port: 7880

logging:
  level: info
```

⚠️ **Важно:** Ключи из `config.yaml` должны совпадать с `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET` в `.env` файле FastAPI!

---

## 3. Nginx + Let's Encrypt SSL

### 3.1. Получение SSL-сертификата

```bash
# Установите certbot
sudo apt update
sudo apt install certbot

# Остановите nginx (если запущен)
sudo systemctl stop nginx

# Получите сертификат (замените домен)
sudo certbot certonly --standalone -d livekit.yourdomain.com

# Сертификаты: /etc/letsencrypt/live/livekit.yourdomain.com/
```

### 3.2. Настройка Nginx

Создайте `/etc/nginx/sites-available/livekit`:

```nginx
server {
    listen 80;
    server_name livekit.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name livekit.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/livekit.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/livekit.yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket таймауты
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### 3.3. Активация

```bash
sudo ln -s /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3.4. Автообновление сертификата

```bash
sudo crontab -e
# Добавьте:
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## 4. Настройка фаервола

### UFW (рекомендуется)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 7880/tcp  # LiveKit API
sudo ufw allow 7881/tcp  # LiveKit TCP transport
sudo ufw allow 7882/udp  # LiveKit UDP transport
sudo ufw allow 50000:60000/udp  # WebRTC media

sudo ufw enable
sudo ufw status
```

### iptables

```bash
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7880 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7881 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 7882 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 50000:60000 -j ACCEPT

# Сохраните
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

---

## 5. Запуск LiveKit

### Docker

```bash
# Скопируйте docker-compose.yml из проекта
cp /path/to/meetgazebo/scripts/docker-compose.yml ~/livekit/

# Запустите
cd ~/livekit
docker compose up -d livekit

# Проверьте логи
docker logs -f gazebo_livekit
```

### Systemd (нативный)

```bash
sudo nano /etc/systemd/system/livekit.service
```

```ini
[Unit]
Description=LiveKit Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/livekit-server --config /root/livekit/config.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable livekit
sudo systemctl start livekit
sudo systemctl status livekit
```

---

## 6. Настройка FastAPI

### 6.1. Генерация .env файла

```bash
cd /path/to/meetgazebo

# Автоматическая генерация
python scripts/generate_env.py \
  --livekit-url https://livekit.yourdomain.com

# Или вручную скопируйте .env.example
cp .env.example .env
nano .env  # Заполните значения
```

### 6.2. Проверьте .env

```env
LIVEKIT_URL=https://livekit.yourdomain.com
LIVEKIT_API_KEY=your-api-key-here
LIVEKIT_API_SECRET=your-api-secret-here
```

⚠️ **Важно:** `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET` должны совпадать с ключами из `config.yaml` LiveKit сервера!

### 6.3. Проверка работы FastAPI

```bash
cd /path/to/meetgazebo
source .venv/bin/activate
uvicorn src.main:app --reload
```

---

## 7. Проверка работы

### 7.1. Проверка LiveKit

```bash
# Проверьте, что LiveKit запущен
curl http://localhost:7880

# Если используете HTTPS через Nginx
curl https://livekit.yourdomain.com
```

### 7.2. Проверка WebSocket

```bash
# Установите wscat
npm install -g wscat

# Подключитесь к LiveKit (замените URL)
wscat -c wss://livekit.yourdomain.com/rtc
```

### 7.3. Проверка фронтенда

1. Откройте `https://yourdomain.com` (или `https://localhost:3000`)
2. Войдите в комнату
3. Проверьте видео и аудио

### 7.4. Логи

```bash
# LiveKit логи
docker logs -f gazebo_livekit

# FastAPI логи
# В терминале где запущен uvicorn

# Nginx логи
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Полный цикл перезапуска

```bash
# 1. Перезапуск LiveKit
docker compose restart livekit

# 2. Перезапуск FastAPI
# Ctrl+C в терминале uvicorn
uvicorn src.main:app --reload

# 3. Перезапуск Nginx
sudo systemctl reload nginx

# 4. Перезапуск фронтенда
cd frontend
npm run dev
```

---

## 🐛 Troubleshooting

### Проблема: WebRTC не подключается
- Проверьте, что порты 50000-60000/udp открыты
- Убедитесь, что `use_external_ip: true` в config.yaml
- Попробуйте `network_mode: host` в docker-compose.yml

### Проблема: WebSocket отключается
- Проверьте Nginx логи: `sudo tail -f /var/log/nginx/error.log`
- Убедитесь, что `proxy_read_timeout` достаточно большой
- Проверьте SSL сертификат: `sudo certbot certificates`

### Проблема: 401 Unauthorized
- Убедитесь, что ключи в `.env` и `config.yaml` совпадают
- Проверьте, что LiveKit сервер запущен

### Проблема: Нет видео
- Проверьте разрешения в токене (can_publish, can_subscribe)
- Откройте консоль браузера (F12) и посмотрите ошибки
- Проверьте, что кодеки VP8/VP9 поддерживаются

---

## 📝 Полезные команды

```bash
# LiveKit CLI (если установлен бинарник)
livekit-server --version

# Docker
docker compose ps
docker compose logs -f livekit
docker compose restart livekit

# Nginx
sudo nginx -t
sudo systemctl reload nginx

# SSL
sudo certbot certificates
sudo certbot renew --dry-run
```
