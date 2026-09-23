# Limove OS

Панель управления компанией Limove — 2 партнёра, проекты, бухгалтерия, счета, VPN, мессенджер, мониторинг сайтов и Telegram-бот.

## Быстрый старт

```bash
docker compose up -d --build
docker compose exec app npx prisma db seed
```

Приложение: http://localhost:3000

## Вход

- Лёша: `aleksei@limove.ru` / `леша`
- Гена: `genadiy@limove.ru` / `гена`

## Возможности

- **Дашборд** — обзор финансов и проектов
- **Финансы** — транзакции, баланс партнёров, шаблоны
- **Проекты** — карточки, доступы (шифрование AES-256-GCM), домены, Kanban, заметки, файлы
- **Счета** — счета/чеки, статусы (PENDING/PAID/CANCELLED), ZIP-архив
- **VPN** — подписки (AmneziaWG/VLESS/VMess), цвета истечения, копирование ключей
- **ElementX** — пользователи мессенджера (Matrix), 5 статусов
- **Мониторинг** — аптайм сайтов за 7/30 дней, фоновый checker
- **Telegram-бот** — /status, /balance, /expiring, /down, автоуведомления
- **PWA** — установка на телефон, офлайн-кэш

## Технологии

- Next.js 14 (App Router), TypeScript, нативный CSS (дизайн-система Limove OS Finance в `src/app/globals.css`), shadcn/ui-примитивы на base-ui
- Prisma 6 + PostgreSQL 16
- NextAuth.js (Credentials), bcryptjs
- Шифрование паролей: AES-256-GCM (ключ `MASTER_KEY`, 64 hex = 32 байта)
- grammY (Telegram-бот)
- Docker Compose

## Переменные окружения

См. `.env.example`. Скопируй в `.env` и заполни.

## Бэкап

```bash
# Скрипт лежит в ./backups (смонтирован в db), запускается из db-контейнера:
cp scripts/backup.sh backups/_backup.sh
docker compose exec db bash /app/backups/_backup.sh
rm backups/_backup.sh
```

Либо напрямую одной командой:

```bash
docker compose exec db sh -c 'PGPASSWORD=limove_pass pg_dump -h localhost -U limove -d limove | gzip' > backups/limove_$(date +%Y%m%d_%H%M%S).sql.gz
```

Дампы SQL (gzip) сохраняются в `./backups/` (скрипт оставляет последние 30).

## Миграция из Excel/CSV

1. Положи файлы в `scripts/data/`:
   - `transactions.csv`, `projects.csv`, `credentials.csv`, `vpn.csv`, `elementx.csv`
2. Просмотр без записи:

   ```bash
   docker compose exec app sh -c "cd /app && npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' scripts/migrate-from-excel.ts --dry-run"
   ```

3. Импорт:

   ```bash
   docker compose exec app sh -c "cd /app && npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' scripts/migrate-from-excel.ts"
   ```

Формат колонок — см. примеры в `scripts/data/`. Пароли из `credentials.csv` шифруются AES-256-GCM (нужен `MASTER_KEY`).

## Разработка

```bash
docker compose exec app npm run dev
docker compose logs app -f
docker compose exec app npx prisma db seed
```