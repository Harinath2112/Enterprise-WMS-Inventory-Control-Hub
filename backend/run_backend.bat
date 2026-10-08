@echo off
REM Starts the IMS Python backend on http://localhost:8000
cd /d "%~dp0"
if not exist venv ( python -m venv venv )
call venv\Scripts\activate
pip install -q -r requirements.txt
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo A new file named .env was created in the backend folder.
  echo Open it, type your MySQL password after DB_PASSWORD= , save it, then run this file again.
  pause
  exit /b
)
python manage.py runserver 8000
