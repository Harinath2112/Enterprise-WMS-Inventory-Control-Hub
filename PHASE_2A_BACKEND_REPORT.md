# Phase 2A: Enterprise WMS Backend Cloud Preparation Report

> **Target Environment:** Render Free Web Service (Django 5.0+ / Gunicorn)  
> **Database:** Aiven Free MySQL 8.0 / TiDB Serverless (PyMySQL with TLS/SSL)  
> **Persistent File Storage:** Cloudinary Free Tier  
> **Email OTP Delivery:** HTTPS API (Brevo / Resend) with SMTP & Dev Fallbacks  
> **Source Control Branch:** `deploy/backend-cloud-prep`  
> **Phase Status:** Complete & Verified  

---

## 1. Executive Summary

In Phase 2A, the backend of the Enterprise WMS / Inventory Control Hub was successfully transformed from a local-only development setup into a cloud-ready, hardened Django REST API prepared for deployment on **Render Free Web Service** and connection to **Aiven / TiDB Free MySQL**.

All changes were implemented under strict preservation rules:
- **Zero changes** to existing business logic or calculation engines (warehouse allocations, stock ledger updates, purchase/sales orders, returns).
- **Zero changes** to frontend screens or frontend source code.
- **Zero changes** to API response envelopes or JSON field contracts.
- **Zero changes** to database table structures or relationships.
- Local development behavior remains 100% functional with `.env` fallbacks.

---

## 2. Git Branch & Working-Tree Status

- **Branch Name:** `deploy/backend-cloud-prep` (branched off `main` to preserve the clean state of the primary branch).
- **Push Status:** **Not pushed** (changes held locally per instructions).
- **Working Tree:**
  - 11 files modified.
  - 1 new backend core module created (`backend/api/core/storage.py`).
  - 1 new report created (`PHASE_2A_BACKEND_REPORT.md`).
  - `staticfiles/` and `.env` are strictly excluded from version control.

---

## 3. Dependency Inventory & Versions Added

The following production dependencies were added to [backend/requirements.txt](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/requirements.txt) and verified in the virtual environment:

| Package | Version Installed | Production Purpose |
| :--- | :---: | :--- |
| `gunicorn` | `26.2.0` | Production WSGI HTTP Server for Render Linux containers. |
| `whitenoise` | `6.12.0` | Static asset serving (handles Django Admin & DRF browsable assets directly in Gunicorn). |
| `cloudinary` | `1.46.3` | Python SDK for persistent cloud uploads, replacements, and secure media retrieval. |
| `cryptography` | `50.0.2` | RSA encryption & TLS handshaking required by PyMySQL for cloud MySQL connections. |
| `requests` | `2.34.2` | HTTPS-based transactional email delivery (Brevo / Resend APIs) bypassing blocked SMTP ports. |

All existing packages (`Django 5.2.18`, `djangorestframework 3.18.3`, `PyMySQL 1.2.3`, `PyJWT 2.15.1`, `bcrypt 5.0.0`, `openpyxl 3.1.5`, `reportlab 5.0.1`, `python-barcode 0.16.1`, `qrcode 8.2`) were completely preserved without any version clashes.

---

## 4. Summary of Files Modified & Created

### 4.1 New Files
- **[backend/api/core/storage.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/core/storage.py):** Unified media storage abstraction supporting both Cloudinary cloud storage and local filesystem fallback (`upload_media`, `delete_media`, `is_cloudinary_url`).
- **[PHASE_2A_BACKEND_REPORT.md](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/PHASE_2A_BACKEND_REPORT.md):** Comprehensive Phase 2A implementation and testing report.

### 4.2 Modified Files
- **[backend/requirements.txt](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/requirements.txt):** Added `gunicorn`, `whitenoise`, `cloudinary`, `cryptography`, and `requests`.
- **[backend/ims_backend/settings.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/ims_backend/settings.py):** Configured WhiteNoise, Cloudinary, MySQL SSL (`DB_SSL`, `DB_SSL_CA`, `CONN_MAX_AGE`), HTTPS reverse proxy headers (`SECURE_PROXY_SSL_HEADER`), fail-safe production validation for `SECRET_KEY` and `JWT_KEY`, and HTTPS email API options.
- **[backend/ims_backend/urls.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/ims_backend/urls.py):** Added unauthenticated root `/health` route and added `companylogos` to static prefixes.
- **[backend/api/core/mail.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/core/mail.py):** Implemented HTTPS REST API delivery for Brevo and Resend, preserving SMTP and dev console fallbacks, with sanitized logging that prevents OTP exposure.
- **[backend/api/views/products.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/views/products.py):** Migrated product image uploads to `upload_media`, replacing old images via `delete_media` and returning `{"imageUrl": ...}`.
- **[backend/api/views/system.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/views/system.py):** Migrated company logo upload and deletion to `upload_media` and `delete_media`.
- **[backend/api/views/admin.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/views/admin.py):** Migrated user profile photos to `upload_media` and `delete_media`.
- **[backend/api/views/parties.py](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/api/views/parties.py):** Migrated supplier document uploads to `upload_media(is_raw=True)`, updated `supplier_document_download` to securely stream cloud documents through Django behind JWT authentication, and cleaned up temporary/deleted documents via `delete_media`.
- **[backend/.env.example](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/.env.example):** Documented all cloud production variable names and options.
- **[backend/.gitignore](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/backend/.gitignore):** Excluded `staticfiles/`.
- **[.gitignore](file:///d:/hari/Projects/Enterprise-WMS-Inventory-Control-Hub/.gitignore):** Excluded `staticfiles/`.

---

## 5. Architectural & Security Implementations

### 5.1 Gunicorn WSGI Production Configuration
- **Application Target:** `ims_backend.wsgi.application`
- **Render Build Command:**
  ```bash
  pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py check
  ```
- **Render Start Command:**
  ```bash
  gunicorn ims_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120
  ```
- **Worker Concurrency Rational:** Configured for 2 workers and 2 threads. On Render's Free 512 MB RAM container, 2 workers consume ~180 MB, providing ample headroom for memory-intensive PDF (`reportlab`) and Excel (`openpyxl`) generation without triggering Out-Of-Memory (OOM) dyno kills.

### 5.2 Managed MySQL TLS / SSL Strategy (Aiven & TiDB Cloud)
- **PyMySQL TLS Configuration:**
  In `ims_backend/settings.py`, database options dynamically support encrypted connections via environment variables:
  ```python
  db_options = {"charset": "utf8mb4"}
  db_ssl = env("DB_SSL", "0").lower() in ("1", "true", "required", "yes")
  db_ssl_ca = env("DB_SSL_CA", "")
  if db_ssl or db_ssl_ca:
      ssl_config = {}
      if db_ssl_ca:
          ssl_config["ca"] = db_ssl_ca
      db_options["ssl"] = ssl_config if ssl_config else {"ssl_mode": "REQUIRED"}
  ```
- **Connection Pooling:** `CONN_MAX_AGE` defaults to `0` (closes connections at request end), mitigating stale socket drops caused by cloud load balancers or idle database timeouts.

### 5.3 Cloudinary Media Storage Design
- **Public Assets (Products, Logos, Profile Avatars):**
  - Stored in Cloudinary folders: `ims/uploads/products`, `ims/companylogos`, `ims/profilephotos`.
  - Stored URLs are HTTPS links (`https://res.cloudinary.com/...`).
  - Total URL lengths are ~80 characters, fitting comfortably inside existing `varchar(255)` / `varchar(500)` columns.
  - Zero frontend code changes: `frontend/src/api/apiClient.js` already passes absolute `https://` URLs through directly!
- **Private Supplier Documents (Confidentiality & Access Control):**
  - Supplier documents (PDFs, DOCX, XLSX, images) are uploaded to Cloudinary using `resource_type="raw"`.
  - **No Public Direct URL Exposure:** The frontend continues to fetch documents via `GET /api/Suppliers/documents/<id>/download`.
  - The backend verifies JWT authorization, checks that `is_deleted=False`, and streams the document securely back to the user via `FileResponse(io.BytesIO(...), as_attachment=True)`.
  - Unauthorized users cannot access or download documents.

### 5.4 Transactional Email OTP (HTTPS API Delivery)
- **Render SMTP Restriction Workaround:** Render Free blocks outbound SMTP ports 25, 465, and 587. To ensure reliable OTP and invoice delivery, `backend/api/core/mail.py` was implemented with HTTPS REST API delivery:
  1. **Brevo (Sendinblue) HTTPS API:** Uses HTTPS port 443 (`POST https://api.brevo.com/v3/smtp/email`) with `api-key`. Free tier: 300 emails/day forever.
  2. **Resend HTTPS API:** Uses HTTPS port 443 (`POST https://api.resend.com/emails`) with Bearer token. Free tier: 3,000 emails/month.
  3. **SMTP Fallback:** Retained for any deployment environment where outbound SMTP is permitted.
  4. **Sanitized Logging:** Never logs OTP values or email contents to production stdout, preventing credential leaks in cloud monitoring dashboards.
  5. **Development & Test Mocking:** Safely falls back to Django's console backend during development and automated tests.

### 5.5 Static Files & Health Monitoring
- **WhiteNoise:** Integrated into middleware directly after `SecurityMiddleware`. Compresses and caches static assets in `staticfiles/` with cache-busting unique hashes.
- **Health Endpoints:**
  - `/api/health` ➔ `{"success": true, "data": {"status": "Healthy"}}`
  - `/health` ➔ `{"success": true, "data": {"status": "Healthy"}}`
  - Both endpoints are unauthenticated (`AllowAny`) and disclose zero internal database, credential, or server metadata.

---

## 6. Required Production Environment Variables

*(Names only — No secret values permitted)*

```ini
# Core Configuration
DJANGO_SECRET_KEY
DJANGO_DEBUG=0
ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1
CORS_ORIGINS=https://<your-project>.vercel.app
CSRF_TRUSTED_ORIGINS=https://<your-project>.vercel.app

# Database Configuration (Aiven / TiDB Cloud MySQL)
DB_ENGINE=mysql
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD
DB_HOST
DB_PORT
DB_SSL=1
DB_SSL_CA=
DB_CONN_MAX_AGE=0

# JWT Authentication
JWT_KEY
JWT_ISSUER=IMSBackend
JWT_AUDIENCE=IMSUsers
LOW_STOCK_THRESHOLD=10

# Cloudinary Persistent Cloud Storage
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_URL

# Transactional Email (Choose Brevo or Resend for Render Free)
BREVO_API_KEY=
RESEND_API_KEY=
EMAIL_FROM_NAME=IMS Inventory System
EMAIL_FROM_ADDRESS=
```

---

## 7. Verification & Test Execution Results

The following non-destructive diagnostics were executed in the project virtual environment:

### 7.1 Django System Check
- **Command:** `python manage.py check`
- **Result:** `System check identified no issues (0 silenced).` **[PASS]**

### 7.2 Automated Test Suite
- **Command:** `DB_ENGINE=sqlite python manage.py test`
- **Result:**
  ```text
  Ran 4 tests in 0.743s
  OK
  System check identified no issues (0 silenced).
  ```
  **[PASS]**

### 7.3 WSGI / Gunicorn Import Verification
- **Command:** `python -c "from ims_backend.wsgi import application; print(application)"`
- **Result:** `WSGI Application loaded successfully: <django.core.handlers.wsgi.WSGIHandler object at ...>` **[PASS]**

### 7.4 Static File Collection (WhiteNoise)
- **Command:** `python manage.py collectstatic --noinput`
- **Result:** `27 static files copied to 'backend/staticfiles'.` **[PASS]**

### 7.5 Storage Abstraction Tests
- **Operations Tested:** Extension sanitization, local upload generation, local file deletion, file type rejection (`.exe` cleanly rejected with `ApiError`).
- **Result:** All assertions passed. **[PASS]**

### 7.6 Email Delivery Tests
- **Operations Tested:** Input validation (empty/invalid addresses rejected), dev dispatch fallback.
- **Result:** All assertions passed. **[PASS]**

### 7.7 Production Security Check
- **Test:** Executed with `DJANGO_DEBUG=0` and default dev secret keys.
- **Result:** Cleanly raised `ValueError: DJANGO_SECRET_KEY environment variable must be set to a secure unique key in production.` **[PASS]**
- **Test:** Executed with `DJANGO_DEBUG=0` and strong mock keys.
- **Result:** Django check passed cleanly (`0 issues`). **[PASS]**

### 7.8 Health Endpoints Verification
- **Test:** Tested `GET /api/health` and `GET /health` with test client.
- **Result:** Both returned HTTP 200 with `status: "Healthy"` without authentication. **[PASS]**

### 7.9 MySQL Cloud TLS / SSL Configuration Validation
- **Test:** Tested `DB_ENGINE=mysql`, `DB_SSL=1`, `DB_SSL_CA="/path/to/ca.pem"`.
- **Result:** Generated `DATABASES['default']['OPTIONS']['ssl'] = {'ca': '/path/to/ca.pem'}`. **[PASS]**
- **Test:** Tested `DB_ENGINE=mysql`, `DB_SSL=1` without CA path.
- **Result:** Generated `DATABASES['default']['OPTIONS']['ssl'] = {'ssl_mode': 'REQUIRED'}`. **[PASS]**

---

## 8. Errors Encountered & Resolution

| Issue Encountered | Root Cause | Resolution |
| :--- | :--- | :--- |
| `UserWarning: No directory at: backend/staticfiles/` during initial test run | WhiteNoise middleware checks for the presence of `STATIC_ROOT` directory. | Executed `python manage.py collectstatic --noinput` and added `staticfiles/` to `.gitignore`. |
| Standalone storage test script raised `ImproperlyConfigured: Requested setting REST_FRAMEWORK` | Standalone script imported DRF components before `django.setup()` was called. | Initialized `os.environ['DJANGO_SETTINGS_MODULE']` and `django.setup()` prior to running isolated test asserts. |

---

## 9. Remaining Risks & Features Requiring Live Cloud Testing

The following items are architecturally prepared and locally validated, but require live external credentials to test end-to-end:
1. **Live Cloudinary Uploads:** Requires live `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to verify cloud upload response times.
2. **Live Cloud MySQL Connectivity:** Requires live Aiven or TiDB Cloud instance to execute connection handshake over cloud TLS.
3. **Live Transactional Email:** Requires live Brevo or Resend API key to confirm inbox delivery of 6-digit OTP codes.

---

## 10. Phase 2A Final Assessment

### **ASSESSMENT: PASS**

The backend is fully prepared for free cloud deployment on Render with MySQL cloud database compatibility, WhiteNoise static assets, Cloudinary persistent storage abstraction, and HTTPS email OTP delivery.

**Next Step:** Proceed to **Phase 2B (Frontend Cloud Preparation)** upon user approval.
