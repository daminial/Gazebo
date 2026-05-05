# MeetGazebo Deployment

## Подготовка
1. Скопируйте `.env.example` в `.env`.
2. Заполните значения секретов и URL-адресов.
3. Для продакшена настройте `ALLOWED_ORIGINS` (например, `https://yourdomain.com`).
4. Для продакшена настройте `LIVEKIT_URL` на публичный адрес LiveKit сервера.

## SSL Настройка
1. Запустите приложение без SSL:
   ```bash
   docker-compose -f scripts/docker-compose.yml up --build -d
   ```

2. Получите SSL сертификат:
   ```bash
   ./scripts/get-ssl.sh yourdomain.com your-email@example.com
   ```

3. Сертификаты будут автоматически обновляться каждые 90 дней.

## Запуск на хосте
```bash
docker-compose -f scripts/docker-compose.yml up --build -d
```

## Доступ
- Фронтенд: `https://yourdomain.com` (HTTPS с редиректом)
- Бэкенд: `http://localhost:8000` (внутренний)
- MinIO: `http://localhost:9000`
- MinIO консоль: `http://localhost:9001`

## Важные замечания
- `LIVEKIT_URL` должен указывать на публичный доступный адрес LiveKit сервера.
- `.env` не должен попадать в репозиторий.
- Если используете `docker compose`, команда работает аналогично.

## Разработка
Для локальной разработки:
- Запустите бэкенд: `uvicorn src.main:app --reload`
- Запустите фронтенд: `cd frontend && npm run dev`
- Фронтенд будет доступен на `http://localhost:3000`
