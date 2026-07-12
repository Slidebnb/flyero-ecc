#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_ROOT="${APP_ROOT:-$(pwd)}"
RESTORE_ROOT="${RESTORE_STAGING_ROOT:-$(mktemp -d "${TMPDIR:-/tmp}/flyero-backup-verify.XXXXXX")}"
EVIDENCE_FILE="${BACKUP_EVIDENCE_FILE:-/var/lib/flyero/backup-evidence/verify-$(date -u +%Y%m%dT%H%M%SZ).txt}"
READ_DATA_SUBSET="${BACKUP_READ_DATA_SUBSET:-1/20}"

cleanup() {
  rm -rf -- "$RESTORE_ROOT"
}
trap cleanup EXIT HUP INT TERM

: "${BACKUP_RESTIC_REPOSITORY:?BACKUP_RESTIC_REPOSITORY muss gesetzt sein}"
: "${BACKUP_RESTIC_PASSWORD_FILE:?BACKUP_RESTIC_PASSWORD_FILE muss gesetzt sein}"
: "${RESTIC_SNAPSHOT_ID:?RESTIC_SNAPSHOT_ID muss auf einen geprueften Snapshot zeigen}"

if [[ ! -r "$BACKUP_RESTIC_PASSWORD_FILE" ]]; then
  printf 'Restic-Passwortdatei ist nicht lesbar: %s\n' "$BACKUP_RESTIC_PASSWORD_FILE" >&2
  exit 1
fi
if [[ ! "$READ_DATA_SUBSET" =~ ^[0-9]+(/[0-9]+)?$ ]]; then
  printf 'Ungueltige BACKUP_READ_DATA_SUBSET: %s\n' "$READ_DATA_SUBSET" >&2
  exit 1
fi

export RESTIC_REPOSITORY="$BACKUP_RESTIC_REPOSITORY"
export RESTIC_PASSWORD_FILE="$BACKUP_RESTIC_PASSWORD_FILE"

mkdir -p "$(dirname "$EVIDENCE_FILE")"
chmod 0700 "$(dirname "$EVIDENCE_FILE")"

{
  printf 'FLYERO backup verification\n'
  printf 'verifiedAtUtc=%s\n' "$(date -u +%Y%m%dT%H%M%SZ)"
  printf 'snapshotId=%s\n' "$RESTIC_SNAPSHOT_ID"
  printf 'readDataSubset=%s\n' "$READ_DATA_SUBSET"
  printf '\n[restic-snapshot]\n'
  restic snapshots "$RESTIC_SNAPSHOT_ID" --no-lock
  printf '\n[restic-check]\n'
  restic check --read-data-subset="$READ_DATA_SUBSET" --no-lock
  printf '\n[verify-only-restore]\n'
  RESTORE_STAGING_ROOT="$RESTORE_ROOT" ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" RESTIC_SNAPSHOT_ID="$RESTIC_SNAPSHOT_ID" ALLOW_DESTRUCTIVE_RESTORE=false bash "$APP_ROOT/scripts/restore-production.sh"
  printf '\nresult=PASSED\n'
} > "$EVIDENCE_FILE"

chmod 0600 "$EVIDENCE_FILE"
printf 'FLYERO Backup-Verifikation erfolgreich. Evidenz: %s\n' "$EVIDENCE_FILE"
