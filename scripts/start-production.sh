#!/bin/sh
set -eu

CLAMAV_DB_DIR="${CLAMAV_DB_DIR:-/var/lib/clamav}"

has_signatures() {
  for file in "$CLAMAV_DB_DIR"/*.cvd "$CLAMAV_DB_DIR"/*.cld "$CLAMAV_DB_DIR"/*.cud; do
    if [ -s "$file" ]; then
      return 0
    fi
  done
  return 1
}

mkdir -p "$CLAMAV_DB_DIR"
chown clamav:clamav "$CLAMAV_DB_DIR"

if has_signatures; then
  if ! freshclam --stdout --foreground --checks=1; then
    echo "ClamAV-Signaturupdate nicht verfuegbar; vorhandene Signaturen bleiben aktiv." >&2
  fi
else
  echo "Keine ClamAV-Signaturen vorhanden; initialisiere FreshClam." >&2
  if ! freshclam --stdout --foreground --checks=1; then
    echo "ClamAV-Signaturen konnten nicht geladen werden. Produktionsstart abgebrochen." >&2
    exit 1
  fi
fi

if ! has_signatures; then
  echo "ClamAV-Signaturen fehlen weiterhin. Produktionsstart abgebrochen." >&2
  exit 1
fi

exec sh -c 'npx prisma migrate deploy && npm run start'
