#!/usr/bin/env bash
# Starts the IMS Python backend on http://localhost:8000
set -e
cd "$(dirname "$0")"
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo "A new file named .env was created. Open it, set DB_PASSWORD to your MySQL password, save, then run this script again."
  exit 0
fi
python manage.py runserver 8000
