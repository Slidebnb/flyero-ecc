#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

APP_ROOT="${APP_ROOT:-/opt/flyero}"
UNIT_DIR="/etc/systemd/system"

if [[ "${EUID}" -ne 0 ]]; then
  printf 'Dieser Installer muss als root ausgefuehrt werden.\n' >&2
  exit 1
fi

for command in systemctl curl flock; do
  command -v "$command" >/dev/null || {
    printf 'Benoetigtes Programm fehlt: %s\n' "$command" >&2
    exit 1
  }
done

test -r "$APP_ROOT/.env.production" || {
  printf 'Produktionsumgebung fehlt oder ist nicht lesbar: %s/.env.production\n' "$APP_ROOT" >&2
  exit 1
}

grep -Eq '^INTERNAL_API_TOKEN="?[A-Za-z0-9_-]{32,}"?$' "$APP_ROOT/.env.production" || {
  printf 'INTERNAL_API_TOKEN fehlt oder ist kuerzer als 32 Zeichen.\n' >&2
  exit 1
}

chmod 0755 "$APP_ROOT/scripts/process-notifications.sh"
install -m 0644 "$APP_ROOT/deploy/flyero-notification-worker.service" "$UNIT_DIR/flyero-notification-worker.service"
install -m 0644 "$APP_ROOT/deploy/flyero-notification-worker.timer" "$UNIT_DIR/flyero-notification-worker.timer"

systemctl daemon-reload
systemctl enable --now flyero-notification-worker.timer
systemctl is-enabled --quiet flyero-notification-worker.timer
systemctl is-active --quiet flyero-notification-worker.timer

printf 'FLYERO Notification-Worker ist aktiv. Naechstes Fenster:\n'
systemctl list-timers --no-pager flyero-notification-worker.timer
