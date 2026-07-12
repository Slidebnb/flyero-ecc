#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

APP_ROOT="${APP_ROOT:-/opt/flyero}"
UNIT_DIR="/etc/systemd/system"
BACKUP_ENV="/etc/flyero/backup.env"
PASSWORD_FILE="/etc/flyero/restic-password"

if [[ "${EUID}" -ne 0 ]]; then
  printf 'Dieser Installer muss als root ausgefuehrt werden.\n' >&2
  exit 1
fi

for command in systemctl docker restic flock; do
  command -v "$command" >/dev/null || { printf 'Benoetigtes Programm fehlt: %s\n' "$command" >&2; exit 1; }
done

test -f "$APP_ROOT/scripts/backup-production.sh" || {
  printf 'Backup-Skript fehlt: %s\n' "$APP_ROOT/scripts/backup-production.sh" >&2
  exit 1
}
test -s "$BACKUP_ENV" || {
  printf 'Fehlende Backup-Konfiguration: %s\n' "$BACKUP_ENV" >&2
  printf 'Vorlage: %s/deploy/flyero-backup.env.example\n' "$APP_ROOT" >&2
  exit 1
}
test -s "$PASSWORD_FILE" || {
  printf 'Fehlende Restic-Passwortdatei: %s\n' "$PASSWORD_FILE" >&2
  exit 1
}

install -d -m 0750 /etc/flyero
chown root:flyero /etc/flyero
chown root:root "$BACKUP_ENV"
chmod 600 "$BACKUP_ENV"
chown root:flyero "$PASSWORD_FILE"
chmod 640 "$PASSWORD_FILE"

install -m 0644 "$APP_ROOT/deploy/flyero-backup.service" "$UNIT_DIR/flyero-backup.service"
install -m 0644 "$APP_ROOT/deploy/flyero-backup.timer" "$UNIT_DIR/flyero-backup.timer"
install -m 0644 "$APP_ROOT/deploy/flyero-backup-failure@.service" "$UNIT_DIR/flyero-backup-failure@.service"

systemctl daemon-reload
systemctl enable --now flyero-backup.timer
systemctl is-enabled --quiet flyero-backup.timer
systemctl is-active --quiet flyero-backup.timer

printf 'FLYERO Backup-Timer ist aktiv. Naechstes Fenster:\n'
systemctl list-timers --no-pager flyero-backup.timer
