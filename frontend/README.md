# Gazebo Frontend

React + Vite фронтенд для Gazebo API.

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Структура

```
frontend/
├── src/
│   ├── api/              # API клиенты (axios)
│   │   └── index.js
│   ├── components/       # Переиспользуемые компоненты
│   │   └── Layout.jsx
│   ├── context/          # React контексты
│   │   └── AuthContext.jsx
│   ├── pages/            # Страницы приложения
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Home.jsx
│   │   ├── Rooms.jsx
│   │   ├── RoomDetail.jsx
│   │   ├── Bestiary.jsx
│   │   ├── Map.jsx
│   │   └── Profile.jsx
│   ├── App.jsx           # Главный компонент с роутингом
│   ├── main.jsx          # Точка входа
│   └── index.css         # Глобальные стили
├── index.html
├── package.json
└── vite.config.js
```

## Функционал

- ✅ Регистрация / Вход
- ✅ JWT авторизация с авто-обновлением токена
- ✅ Защищённые роуты
- ✅ Страницы: Главная, Комнаты, Бестиарий, Карта, Профиль
- ✅ Тёмная тема
- ✅ Адаптивный дизайн

## API

Фронтенд использует прокси Vite для подключения к бэкенду:
- `/api/*` → `http://localhost:8000/*`

## Сборка для продакшена

```bash
npm run build
```
