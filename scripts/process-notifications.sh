#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

APP_ROOT="${APP_ROOT:-/opt/flyero}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env.production}"

if [[ ! -r "$ENV_FILE" ]]; then
  printf 'Produktionsumgebung fehlt oder ist nicht lesbar: %s\n' "$ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${APP_URL:?APP_URL muss gesetzt sein}"
: "${INTERNAL_API_TOKEN:?INTERNAL_API_TOKEN muss gesetzt sein}"

case "$APP_URL" in
  https://*) ;;
  *)
    printf 'APP_URL muss fuer den Notification-Worker HTTPS verwenden.\n' >&2
    exit 1
    ;;
esac

curl --fail-with-body --silent --show-error \
  --connect-timeout 15 \
  --max-time 60 \
  --retry 2 \
  --retry-delay 2 \
  -X POST \
  -H "accept: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  "$APP_URL/api/internal/notifications/process"
printf '\n'
