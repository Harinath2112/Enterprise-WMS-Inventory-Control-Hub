# PHASE 3D — Render Backend Deployment Report

**Execution Date:** 2026-10-28  
**Project:** Enterprise WMS / Inventory Control Hub  
**Repository:** [https://github.com/Harinath2112/Enterprise-WMS-Inventory-Control-Hub](https://github.com/Harinath2112/Enterprise-WMS-Inventory-Control-Hub)  
**Deployment Branch:** `deploy/backend-cloud-prep`  
**Target Platform:** Render Free Web Service (Python 3.11.9 Runtime)  
**Status:** **READY FOR LIVE DEPLOYMENT (Awaiting User Authorization to Trigger)**

---

## Executive Summary

Phase 3D completes all technical preparation, production audits, dependency pinning, runtime configurations, and safety checks required to deploy the Enterprise WMS Django backend to **Render Free Web Service**.

Gate 1 has successfully replaced the historical remote repository with the sanitized history (`main` at `912dfa2`) and published the deployment branch (`deploy/backend-cloud-prep` at `0249a14`). All pre-flight tests, including `python manage.py check --deploy`, unit tests (17/17), frontend build, and live Aiven MySQL row verification (84 tables / 410 rows), have passed with 100% success.

In strict compliance with the safety protocol, **the actual service creation and initial deployment trigger on Render are paused awaiting your explicit confirmation**.

---

## 1. Production Security & Audit Status Summary

| Audit Item | Status | Verification & Resolution Details |
|---|---|---|
| **Admin Password Rotation** | **PASS (100% Complete)** | Live Aiven MySQL password hash rotated for User ID: 1 (`harinathnetha21@gmail.com`). Application bcrypt (`$2a$`, cost 11) verified. `TokenVersion` incremented to 3; all active refresh tokens revoked; login sessions terminated. All 84 tables and 410 rows verified intact. Zero password exposure in commands, env vars, files, or reports. |
| **Git History Cleanup (Gate 1)** | **PASS (Published to GitHub)** | Purged `database/imsdatabase.sql` across entire Git history using `git-filter-repo`. Rebased all 7 GitHub README commits on rewritten root `d5ba49e`. Pushed `main` via `--force-with-lease` and published `deploy/backend-cloud-prep`. Verified directly on GitHub via `git ls-remote`. |
| **Django Production Check** | **PASS** | `python manage.py check --deploy` passed with **0 issues** (0 warnings, 1 silenced: `security.W003` because pure REST API uses stateless JWT Bearer tokens). `XFrameOptionsMiddleware` added with `X_FRAME_OPTIONS = "DENY"`. |
| **Django System Checks** | **PASS** | `python manage.py check` -> 0 issues identified (0 silenced). |
| **Unit Test Suite** | **PASS** | 17/17 tests passing (9 core API regression tests + 8 cloud service mock tests). |
| **Live Cloud Integrations** | **PASS** | Cloudinary CDN, Cloudflare R2 private bucket, Brevo HTTPS transactional email, and Aiven MySQL TLSv1.3 verified live. |
| **Health Endpoints** | **PASS** | `GET /health` and `GET /api/health` return HTTP 200 `{status: "Healthy"}`. |
| **Gunicorn WSGI Import** | **PASS** | `ims_backend.wsgi` application instantiates cleanly. |
| **Frontend Production Build** | **PASS** | `npm run build` succeeds in 1.03s with zero errors or credential leaks. |
| **Python Version Runtime** | **PASS** | Pinned to `3.11.9` across `PYTHON_VERSION=3.11.9`, `backend/.python-version`, `.python-version`, and `backend/runtime.txt`. |
| **Database Preservation** | **PASS** | Existing Aiven MySQL database preserved (84 tables, 87 foreign keys, 410 seed records). Build command performs 0 migrations and 0 destructive operations. |

---

## 2. Render Linux Runtime & Service Configuration

### Service Specifications (Render Free Tier)

| Setting | Value | Justification |
|---|---|---|
| **Service Name** | `enterprise-wms-api` | Standardized naming convention. |
| **Service Type** | **Web Service** | Exposes HTTP/HTTPS endpoints on Render. |
| **Repository** | `Harinath2112/Enterprise-WMS-Inventory-Control-Hub` | Connected GitHub repository. |
| **Branch** | `deploy/backend-cloud-prep` | Verified deployment branch. |
| **Root Directory** | `backend` | Isolates backend from root repository files. |
| **Runtime / Language** | **Python** | Pinned to `3.11.9`. |
| **Region** | `Singapore (SE Asia)` or `Frankfurt (EU Central)` | `Singapore` offers lowest latency (~30–50ms) to India; `Frankfurt` is close to EU cloud infrastructure. |
| **Plan** | **Free ($0/month)** | 512 MB RAM, 0.1 CPU core. Zero cost. |
| **Build Command** | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py check` | Installs dependencies, compresses static files with WhiteNoise, and validates Django system integrity without touching the database. |
| **Start Command** | `gunicorn ims_backend.wsgi --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120` | Conservative single-worker concurrency (~140–180 MB RAM footprint), leaving ample headroom under Render Free's 512 MB ceiling. |
| **Health Check Path** | `/health` | Unauthenticated lightweight endpoint returning HTTP 200 `{status: "Healthy"}`. |
| **Auto-Deploy** | **No (Manual Deploy)** | Prevents unintended deploys before all environment variables and secret files are configured. |

---

## 3. Production Environment Variables Checklist (Render Dashboard)

The following exact environment variable names are read by `backend/ims_backend/settings.py`. Configure these securely in the Render dashboard:

```ini
# ==============================================================================
# Runtime & Python Selection
# ==============================================================================
PYTHON_VERSION=3.11.9

# ==============================================================================
# Core Django & Host Configuration
# ==============================================================================
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<long-unique-50+-character-random-secret-key>
ALLOWED_HOSTS=enterprise-wms-api.onrender.com,.onrender.com,localhost,127.0.0.1
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000

# ==============================================================================
# Security & JWT Authentication
# ==============================================================================
JWT_KEY=<long-unique-32+-character-secret-key>
JWT_ISSUER=IMSBackend
JWT_AUDIENCE=IMSUsers

# ==============================================================================
# CORS & CSRF (Verified Local Origins; Add Vercel URL later in Phase 3E)
# ==============================================================================
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
CSRF_TRUSTED_ORIGINS=https://enterprise-wms-api.onrender.com,https://*.onrender.com

# ==============================================================================
# Aiven Cloud MySQL Database (TLSv1.3 Required)
# ==============================================================================
DB_ENGINE=mysql
DB_HOST=enterprise-wms-mysql-harinathnetha21-35bb.f.aivencloud.com
DB_PORT=25636
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=<aiven-mysql-password>
DB_SSL=1
DB_CONN_MAX_AGE=60
DB_SSL_CA=/etc/secrets/aiven-ca.pem

# ==============================================================================
# Cloudinary (Public Image Storage & CDN)
# ==============================================================================
CLOUDINARY_CLOUD_NAME=qd8cyo26
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
CLOUDINARY_URL=cloudinary://<key>:<secret>@qd8cyo26

# ==============================================================================
# Cloudflare R2 (Private Confidential Supplier Documents)
# ==============================================================================
R2_ACCOUNT_ID=262a7b5ff1979b819e1b3e45b962e958
R2_ACCESS_KEY_ID=<cloudflare-r2-access-key-id>
R2_SECRET_ACCESS_KEY=<cloudflare-r2-secret-access-key>
R2_BUCKET_NAME=enterprise-wms-private-docs
R2_ENDPOINT_URL=https://262a7b5ff1979b819e1b3e45b962e958.r2.cloudflarestorage.com

# ==============================================================================
# Brevo (Transactional Email HTTPS API — Outbound Port 443)
# ==============================================================================
BREVO_API_KEY=<brevo-api-key>
EMAIL_FROM_ADDRESS=kurapatiharinath2005@gmail.com
EMAIL_FROM_NAME=IMS Inventory System
```

---

## 4. Render Secret File Configuration (Aiven CA Certificate)

To ensure secure database communication over TLSv1.3 with hostname verification:
1. In the Render service dashboard, navigate to **Environment** -> **Secret Files**.
2. Click **Add Secret File**.
3. **Filename:** `/etc/secrets/aiven-ca.pem`
4. **Contents:** Paste the exact contents of `database/cloud_migration/aiven-ca.pem`.
5. `backend/ims_backend/settings.py` resolves `/etc/secrets/aiven-ca.pem`, verifies file existence, and sets `ssl_config["ca"] = "/etc/secrets/aiven-ca.pem"` with `ssl_config["check_hostname"] = True`.

---

## 5. Deployment Step-by-Step Instructions (Render Dashboard)

1. Log in to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** -> Connect `Harinath2112/Enterprise-WMS-Inventory-Control-Hub`.
4. Configure service parameters:
   - **Name:** `enterprise-wms-api`
   - **Region:** `Singapore (SE Asia)` or `Frankfurt (EU Central)`
   - **Branch:** `deploy/backend-cloud-prep`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py check`
   - **Start Command:** `gunicorn ims_backend.wsgi --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120`
   - **Plan:** `Free ($0/month)`
5. Under **Advanced**:
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** Select `No` (Manual Deploy) initially to verify configuration.
6. Under **Environment Variables**:
   - Add all variables from Section 3 above.
7. Under **Secret Files**:
   - Add `/etc/secrets/aiven-ca.pem` as specified in Section 4 above.
8. Click **Create Web Service**.
9. Trigger **Manual Deploy** -> **Deploy latest commit**.

---

## 6. Post-Deployment Verification Plan

Once the initial build completes on Render:
1. **Health Checks:**
   - Verify `GET https://enterprise-wms-api.onrender.com/health` returns HTTP 200 `{status: "Healthy"}`.
   - Verify `GET https://enterprise-wms-api.onrender.com/api/health` returns HTTP 200.
2. **Database Connectivity:**
   - Verify safe read-only queries against Aiven MySQL (e.g. login, product fetch).
3. **Cloud Storage Verification:**
   - Verify Cloudinary image delivery over CDN.
   - Verify Cloudflare R2 pre-signed document download without uploading files.
4. **Email Dispatch:**
   - Verify Brevo HTTPS API outbound access. (If Brevo rejects requests due to outbound IP restriction, whitelist Render outbound CIDR or disable IP restrictions on the test API key).

---

## 7. Approval Gate 2 Status

Antigravity has stopped at Gate 2:
> **Are you ready to proceed with creating and triggering the Render Free Web Service deployment for `enterprise-wms-api`?**
