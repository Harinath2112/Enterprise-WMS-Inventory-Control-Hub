"""Django settings for the IMS backend (Production Cloud-Ready for Render + Aiven/TiDB MySQL + Cloudinary)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env():
    path = BASE_DIR / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if " #" in v:                      # inline comment (needs a space before #)
            v = v.split(" #", 1)[0]
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
env = lambda k, d="": os.environ.get(k, d)

# Core Execution Environment
DEBUG = env("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
if not DEBUG and SECRET_KEY in ("dev-insecure-key-change-me", "change-me-to-a-long-random-text", ""):
    raise ValueError("DJANGO_SECRET_KEY environment variable must be set to a secure unique key in production.")

# Host Restrictions
raw_allowed_hosts = env("ALLOWED_HOSTS", "")
if raw_allowed_hosts:
    ALLOWED_HOSTS = [h.strip() for h in raw_allowed_hosts.split(",") if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = [".onrender.com", "localhost", "127.0.0.1"]

# Applications
INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "api",
]

# Middleware Pipeline (WhiteNoise static files serving)
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "ims_backend.urls"
WSGI_APPLICATION = "ims_backend.wsgi.application"
APPEND_SLASH = False
USE_TZ = False  # the existing DB stores naive UTC datetimes (same as the C# backend)
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# Database Configuration (MySQL with TLS/SSL for Aiven / TiDB Cloud; SQLite for local test runs)
DB_ENGINE = env("DB_ENGINE", "mysql").lower()
if DB_ENGINE == "sqlite":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "ims_local.sqlite3"}}
else:
    import pymysql
    pymysql.version_info = (2, 2, 1, "final", 0)  # satisfy Django's mysqlclient version check
    pymysql.install_as_MySQLdb()

    db_options = {
        "charset": "utf8mb4",
        "connect_timeout": 15,
    }
    db_ssl = env("DB_SSL", "0").lower() in ("1", "true", "required", "yes")
    db_ssl_ca = env("DB_SSL_CA", "")
    if db_ssl or db_ssl_ca:
        ssl_config = {}
        resolved_ca = None
        if db_ssl_ca:
            if os.path.exists(db_ssl_ca):
                resolved_ca = os.path.abspath(db_ssl_ca)
            elif os.path.exists(BASE_DIR / db_ssl_ca):
                resolved_ca = str((BASE_DIR / db_ssl_ca).resolve())
        db_ssl_ca_content = env("DB_SSL_CA_CONTENT", "")
        if not resolved_ca and db_ssl_ca_content and "-----BEGIN CERTIFICATE-----" in db_ssl_ca_content:
            ca_target_dir = Path("/tmp") if os.path.exists("/tmp") else BASE_DIR
            ca_path = ca_target_dir / ".aiven-ca.pem"
            try:
                ca_path.write_text(db_ssl_ca_content.strip(), encoding="utf-8")
                resolved_ca = str(ca_path.resolve())
            except Exception:
                pass
        if resolved_ca:
            ssl_config["ca"] = resolved_ca
            ssl_config["check_hostname"] = True
        else:
            ssl_config["check_hostname"] = False
        db_options["ssl"] = ssl_config

    DATABASES = {"default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME", "imsdatabase"),
        "USER": env("DB_USER", "root"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", "127.0.0.1"),
        "PORT": env("DB_PORT", "3306"),
        "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60" if not DEBUG else "0")),
        "OPTIONS": db_options,
    }}

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.core.jwtauth.JwtAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["api.core.response.IMSJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "EXCEPTION_HANDLER": "api.core.response.exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# CORS & CSRF Settings
raw_cors_origins = env("CORS_ALLOWED_ORIGINS", env("CORS_ORIGINS", ""))
if raw_cors_origins:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in raw_cors_origins.split(",") if o.strip()]
elif DEBUG:
    CORS_ALLOWED_ORIGINS = ["http://localhost:5174", "http://127.0.0.1:5174"]
else:
    CORS_ALLOWED_ORIGINS = []

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

raw_csrf_trusted = env("CSRF_TRUSTED_ORIGINS", "")
if raw_csrf_trusted:
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in raw_csrf_trusted.split(",") if o.strip()]
elif CORS_ALLOWED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = [o for o in CORS_ALLOWED_ORIGINS if o.startswith(("http://", "https://"))]
else:
    CSRF_TRUSTED_ORIGINS = []

# HTTPS & Reverse Proxy Security (behind Render / Cloud Load Balancer)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", "1") == "1"
    SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# JWT Settings
JWT_KEY = env("JWT_KEY", "dev-insecure-jwt-key-change-me-0123456789")
if not DEBUG and JWT_KEY in ("dev-insecure-jwt-key-change-me-0123456789", "change-me-at-least-32-characters-long-secret-text", ""):
    raise ValueError("JWT_KEY environment variable must be set to a secure unique 32+ char key in production.")
JWT_ISSUER = env("JWT_ISSUER", "IMSBackend")
JWT_AUDIENCE = env("JWT_AUDIENCE", "IMSUsers")
ACCESS_TOKEN_HOURS = 8
REFRESH_TOKEN_DAYS = 7
LOW_STOCK_THRESHOLD = int(env("LOW_STOCK_THRESHOLD", "10"))

# Static and Media Assets
MEDIA_ROOT = BASE_DIR / "wwwroot"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Cloudinary Persistent Cloud Storage
CLOUDINARY_CLOUD_NAME = env("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = env("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = env("CLOUDINARY_API_SECRET", "")
CLOUDINARY_URL = env("CLOUDINARY_URL", "")

USE_CLOUDINARY = bool(CLOUDINARY_URL or (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET))
if USE_CLOUDINARY:
    try:
        import cloudinary
        if CLOUDINARY_URL:
            cloudinary.config(cloudinary_url=CLOUDINARY_URL)
        else:
            cloudinary.config(
                cloud_name=CLOUDINARY_CLOUD_NAME,
                api_key=CLOUDINARY_API_KEY,
                api_secret=CLOUDINARY_API_SECRET,
                secure=True,
            )
    except Exception:
        USE_CLOUDINARY = False

# Transactional Email (HTTPS API: Brevo / Resend; SMTP fallback; Console for dev)
BREVO_API_KEY = env("BREVO_API_KEY", "")
RESEND_API_KEY = env("RESEND_API_KEY", "")
EMAIL_HOST = env("EMAIL_HOST", "")
EMAIL_FROM_NAME = env("EMAIL_FROM_NAME", "IMS Inventory System")
EMAIL_FROM_ADDRESS = env("EMAIL_FROM_ADDRESS", env("EMAIL_USER", "no-reply@ims.local"))
DEFAULT_FROM_EMAIL = f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>"

if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(env("EMAIL_PORT", "465"))
    EMAIL_USE_SSL = EMAIL_PORT == 465
    EMAIL_USE_TLS = EMAIL_PORT == 587
    EMAIL_HOST_USER = env("EMAIL_USER")
    EMAIL_HOST_PASSWORD = env("EMAIL_PASSWORD")
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
