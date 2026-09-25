#!/bin/bash
# Ночной бэкап Limove: pg_dump из контейнера БД → ./backups/ (30 шт.)
# + отправка свежего дампа в Telegram всем привязанным партнёрам.
# Запуск с ХОСТА по cron, пример:
#   0 4 * * * /opt/limove-os/scripts/backup-cron.sh >> /opt/limove-os/backups/cron.log 2>&1
set -euo pipefail

APP_DIR=/opt/limove-os
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/limove_${TS}.sql.gz"

echo "[$TS] backup start"

# 1) Дамп из контейнера БД.
docker exec limove-db pg_dump -U limove -d limove 2>/dev/null | gzip > "$OUT_FILE"
echo "Backup: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# 2) Только последние 30.
ls -t "$BACKUP_DIR"/limove_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f

# 3) Токен бота из .env прода.
if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$APP_DIR/.env"; set +a
fi
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN пуст — пропускаю отправку в TG"
  exit 0
fi

# 4) Чаты партнёров из БД.
CHATS=$(docker exec limove-db psql -U limove -d limove -tAc \
  'SELECT DISTINCT "telegramChatId" FROM "User" WHERE "telegramChatId" IS NOT NULL' 2>/dev/null || true)
if [ -z "$CHATS" ]; then
  echo "Нет привязанных чатов — пропускаю отправку в TG"
  exit 0
fi

# 5) Отправка дампа каждому партнёру.
SIZE=$(du -h "$OUT_FILE" | cut -f1)
for CHAT in $CHATS; do
  if curl -sf -m 120 -F "document=@${OUT_FILE}" \
      -F "caption=💾 Бэкап Limove $(date +%d.%m.%Y) ($SIZE)" \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
      --data-urlencode "chat_id=${CHAT}" -o /dev/null; then
    echo "Отправлен в чат $CHAT"
  else
    echo "ОШИБКА отправки в чат $CHAT"
  fi
done

echo "[$TS] backup done"
