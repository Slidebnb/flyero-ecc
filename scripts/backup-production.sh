#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_ROOT="${BACKUP_STAGING_ROOT:-$(mktemp -d "${TMPDIR:-/tmp}/flyero-backup.XXXXXX")}"
BACKUP_TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  rm -rf -- "$BACKUP_ROOT"
}

trap cleanup EXIT HUP INT TERM

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Fehlende Produktionsumgebung: %s\n' "$ENV_FILE" >&2
  exit 1
fi

: "${BACKUP_RESTIC_REPOSITORY:?BACKUP_RESTIC_REPOSITORY muss gesetzt sein}"
: "${BACKUP_RESTIC_PASSWORD_FILE:?BACKUP_RESTIC_PASSWORD_FILE muss gesetzt sein}"

if [[ ! -r "$BACKUP_RESTIC_PASSWORD_FILE" ]]; then
  printf 'Restic-Passwortdatei ist nicht lesbar: %s\n' "$BACKUP_RESTIC_PASSWORD_FILE" >&2
  exit 1
fi

export RESTIC_REPOSITORY="$BACKUP_RESTIC_REPOSITORY"
export RESTIC_PASSWORD_FILE="$BACKUP_RESTIC_PASSWORD_FILE"

mkdir -p "$BACKUP_ROOT"

if [[ -z "${FILE_STORAGE_PROVIDER:-}" ]]; then
  FILE_STORAGE_PROVIDER="$(grep '^FILE_STORAGE_PROVIDER=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
fi
FILE_STORAGE_PROVIDER="${FILE_STORAGE_PROVIDER:-local}"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -c \
  'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$BACKUP_ROOT/database.dump"

if [[ "$FILE_STORAGE_PROVIDER" == "s3" ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
    sh -c 'rm -rf /tmp/flyero-s3-documents && node scripts/export-private-s3.mjs /tmp/flyero-s3-documents documents && tar -C /tmp/flyero-s3-documents -cf - .' > "$BACKUP_ROOT/storage.tar"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
    sh -c 'rm -rf /tmp/flyero-s3-generated && node scripts/export-private-s3.mjs /tmp/flyero-s3-generated generated && tar -C /tmp/flyero-s3-generated -cf - .' > "$BACKUP_ROOT/generated.tar"
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
    sh -c 'tar -C /app/storage -cf - .' > "$BACKUP_ROOT/storage.tar"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
    sh -c 'mkdir -p /app/storage/generated && tar -C /app/storage/generated -cf - .' > "$BACKUP_ROOT/generated.tar"
fi

for file in database.dump storage.tar generated.tar; do
  if [[ ! -s "$BACKUP_ROOT/$file" ]]; then
    printf 'Backup-Artefakt ist leer: %s\n' "$file" >&2
    exit 1
  fi
done

cat > "$BACKUP_ROOT/manifest.txt" <<EOF
FLYERO production backup
createdAtUtc=$BACKUP_TIMESTAMP
databaseFormat=postgresql-custom
storageArchive=storage.tar
generatedArchive=generated.tar
fileStorageProvider=$FILE_STORAGE_PROVIDER
EOF

(cd "$BACKUP_ROOT" && sha256sum database.dump storage.tar generated.tar manifest.txt > manifest.sha256)

(cd "$BACKUP_ROOT" && restic backup \
  database.dump storage.tar generated.tar manifest.txt manifest.sha256 \
  --tag flyero-production \
  --tag "created-at-$BACKUP_TIMESTAMP")

restic forget \
  --keep-daily "${BACKUP_RETENTION_DAILY:-7}" \
  --keep-weekly "${BACKUP_RETENTION_WEEKLY:-4}" \
  --keep-monthly "${BACKUP_RETENTION_MONTHLY:-12}" \
  --prune

printf 'FLYERO Backup erfolgreich erstellt: %s\n' "$BACKUP_TIMESTAMP"
