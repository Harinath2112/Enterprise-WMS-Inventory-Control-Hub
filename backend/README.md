# IMS Backend — Python (Django + Django REST Framework)

REST API for the IMS (Inventory Management System). Database: MySQL `imsdatabase`. Frontend: `../frontend` (React).
For the full step-by-step instructions read **`../run guide.txt`**.

## Tech stack
| Layer | Technology |
|---|---|
| Language / framework | Python 3.10+ · Django 5 · Django REST Framework |
| Database | MySQL 8 (`imsdatabase`) through PyMySQL (pure Python, no compiler needed) · SQLite option for quick tests |
| Auth | JWT (PyJWT), refresh tokens, BCrypt passwords, email OTP, lock-out after 5 failed logins |
| Reports / files | openpyxl (Excel), ReportLab (PDF), Django email (SMTP) |
| Tests | Django test runner |

## Quick start
```
cd backend
run_backend.bat            (Windows)      ./run_backend.sh      (macOS / Linux)
```
First run creates `.env` — set `DB_PASSWORD` in it and run again. API: http://localhost:8000/api/health

## Commands
* `python manage.py runserver 8000` — start the API
* `python manage.py createadmin --email you@example.com --password "Strong@123"` — create or reset an administrator
* `set DB_ENGINE=sqlite` then `python manage.py migrate --run-syncdb` and `python manage.py load_dump "../database/imsdatabase.sql"` — run without MySQL
* `python manage.py test` — run the automated tests (needs `DB_ENGINE=sqlite`)
* `python tools/gen_models.py` — regenerate `api/models.py` if the SQL schema changes

## Layout
```
ims_backend/      settings and root URLs
api/models.py     76 models generated from the MySQL schema
api/core/         JWT auth, permissions, JSON mapping, CRUD engine, stock engine, audit log, mail
api/views/        auth · admin (users, roles, permissions, audit, notifications) · masters · products · parties
                  (suppliers, customers) · warehouses · stockops · purchasing · sales · reports · system
api/urls.py       route table (case-insensitive paths)
wwwroot/          uploaded files (product images, profile photos, company logo)
```

## Notes
* Every stock change (goods receipt, invoice, cancel, returns, adjustments, transfers, audits, put-away) goes through one
  stock engine that updates Stock, Stock Ledger and Stock Movements together.
* Without `EMAIL_HOST` in `.env`, emails (OTP codes, invoices) are printed in the backend terminal.
* Keep real secrets only in `.env`. Before production: new `JWT_KEY` and `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, HTTPS.
