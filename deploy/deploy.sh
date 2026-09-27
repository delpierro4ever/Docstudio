#!/usr/bin/env bash
# Update the production checkout to the latest commit of its branch,
# rebuild, and restart the services. Run on the server:
#   /home/admin/apps/docstudio-prod/deploy/deploy.sh
set -euo pipefail

APP="${APP:-/home/admin/apps/docstudio-prod}"
cd "$APP"

git pull --ff-only

# Guest-trial previews need LibreOffice + poppler (see README).
for cmd in soffice pdftoppm; do
  command -v "$cmd" >/dev/null || { echo "missing $cmd: sudo apt-get install -y libreoffice-writer-nogui python3-uno poppler-utils fonts-liberation fonts-crosextra-carlito fonts-crosextra-caladea" >&2; exit 1; }
done

(cd formatter-service && .venv/bin/pip install -q -r requirements.txt)
(cd backend && npm ci --silent && npm run build)
(cd frontend && npm ci --silent && npm run build)

sudo systemctl restart docstudio-formatter docstudio-backend docstudio-frontend
sleep 5
systemctl is-active docstudio-formatter docstudio-backend docstudio-frontend
curl -fsS http://127.0.0.1:3000/backend/health && echo " <- healthy"
