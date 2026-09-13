#!/bin/bash
# Backup Limove DB → gzipped SQL dump in ./backups/ (last 30 kept)
# Run from the DB container: docker compose exec db bash /app/backups/backup.sh
# OR simply on host: docker compose exec db pg_dump -U limove -d limove | gzip > backups/limove_$(date +%Y%m%d_%H%M%S).sql.gz
set -euo pipefail

BACKUP_DIR=/app/backups
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/limove_${TIMESTAMP}.sql.gz"

# Здесь мы уже ВНУТРИ db-контейнера: localhost = БД
PGPASSWORD=${POSTGRES_PASSWORD:-limove_pass} pg_dump -h localhost -U ${POSTGRES_USER:-limove} -d ${POSTGRES_DB:-limove} | gzip > "$OUT_FILE"

echo "Backup создан: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Оставить только последние 30 бэкапов
ls -t "$BACKUP_DIR"/limove_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "Бэкапов осталось: $(ls "$BACKUP_DIR"/limove_*.sql.gz 2>/dev/null | wc -l)"