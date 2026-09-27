#!/usr/bin/env bash
# Daily backup of DocStudio runtime data (users, jobs, sessions, feedback,
# uploaded + formatted documents). Keeps the last 14 archives.
#   crontab: 30 2 * * * /home/admin/apps/docstudio-prod/deploy/backup.sh
set -euo pipefail

DATA_ROOT="${DATA_ROOT:-/home/admin/docstudio-data}"
DEST="$DATA_ROOT/backups"
KEEP="${KEEP:-14}"

mkdir -p "$DEST"
stamp=$(date +%Y-%m-%d_%H%M)
tar -czf "$DEST/docstudio-$stamp.tar.gz" -C "$DATA_ROOT" data uploads
ls -1t "$DEST"/docstudio-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
