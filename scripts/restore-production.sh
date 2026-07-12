#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
RESTORE_ROOT="${RESTORE_STAGING_ROOT:-$(mktemp -d "${TMPDIR:-/tmp}/flyero-restore.XXXXXX")}"

cleanup() {
  rm -rf -- "$RESTORE_ROOT"
}

trap cleanup EXIT HUP INT TERM

: "${BACKUP_RESTIC_REPOSITORY:?BACKUP_RESTIC_REPOSITORY muss gesetzt sein}"
: "${BACKUP_RESTIC_PASSWORD_FILE:?BACKUP_RESTIC_PASSWORD_FILE muss gesetzt sein}"
: "${RESTIC_SNAPSHOT_ID:?RESTIC_SNAPSHOT_ID muss auf einen geprueften Snapshot zeigen}"

if [[ -z "${FILE_STORAGE_PROVIDER:-}" && -f "$ENV_FILE" ]]; then
  FILE_STORAGE_PROVIDER="$(grep '^FILE_STORAGE_PROVIDER=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
fi
FILE_STORAGE_PROVIDER="${FILE_STORAGE_PROVIDER:-local}"

if [[ ! -r "$BACKUP_RESTIC_PASSWORD_FILE" ]]; then
  printf 'Restic-Passwortdatei ist nicht lesbar: %s\n' "$BACKUP_RESTIC_PASSWORD_FILE" >&2
  exit 1
fi

export RESTIC_REPOSITORY="$BACKUP_RESTIC_REPOSITORY"
export RESTIC_PASSWORD_FILE="$BACKUP_RESTIC_PASSWORD_FILE"

restic restore "$RESTIC_SNAPSHOT_ID" --target "$RESTORE_ROOT"

cd "$RESTORE_ROOT"
for file in database.dump storage.tar generated.tar manifest.txt manifest.sha256; do
  test -s "$file" || { printf 'Restore-Artefakt fehlt oder ist leer: %s\n' "$file" >&2; exit 1; }
done

sha256sum -c manifest.sha256

if [[ "${ALLOW_DESTRUCTIVE_RESTORE:-false}" != "true" ]]; then
  printf 'Integritaetspruefung erfolgreich. Es wurde nichts in die laufende Umgebung geschrieben.\n'
  printf 'Fuer einen ausdruecklich freigegebenen Restore: ALLOW_DESTRUCTIVE_RESTORE=true setzen.\n'
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Fehlende Produktionsumgebung: %s\n' "$ENV_FILE" >&2
  exit 1
fi

if [[ "${RESTORE_DATABASE:-false}" == "true" ]]; then
  cat database.dump | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
fi

if [[ "${RESTORE_STORAGE:-false}" == "true" ]]; then
  if [[ "${FILE_STORAGE_PROVIDER:-local}" == "s3" ]]; then
    cat storage.tar | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
      sh -c 'rm -rf /tmp/flyero-s3-documents && mkdir -p /tmp/flyero-s3-documents && tar -C /tmp/flyero-s3-documents -xf - && node scripts/import-private-s3.mjs /tmp/flyero-s3-documents documents'
  else
    cat storage.tar | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
      sh -c 'rm -rf /app/storage/* && tar -C /app/storage -xf -'
  fi
fi

if [[ "${RESTORE_GENERATED:-false}" == "true" ]]; then
  if [[ "${FILE_STORAGE_PROVIDER:-local}" == "s3" ]]; then
    cat generated.tar | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
      sh -c 'rm -rf /tmp/flyero-s3-generated && mkdir -p /tmp/flyero-s3-generated && tar -C /tmp/flyero-s3-generated -xf - && node scripts/import-private-s3.mjs /tmp/flyero-s3-generated generated'
  else
    cat generated.tar | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps -T app \
      sh -c 'rm -rf /app/storage/generated/* && tar -C /app/storage/generated -xf -'
  fi
fi

printf 'Destruktiver Restore abgeschlossen. Anwendung und Downloads jetzt gezielt smoke-testen.\n'
