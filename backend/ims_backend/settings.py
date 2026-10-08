"""Django settings for the IMS backend (Python port of the ASP.NET Core API)."""
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

DB_ENGINE = env("DB_ENGINE", "mysql").lower()
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = env("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "api",
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "ims_backend.urls"
WSGI_APPLICATION = "ims_backend.wsgi.application"
APPEND_SLASH = False
USE_TZ = False  # the existing DB stores naive UTC datetimes (same as the C# backend)
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

if DB_ENGINE == "sqlite":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "ims_local.sqlite3"}}
else:
    import pymysql
    pymysql.version_info = (2, 2, 1, "final", 0)  # satisfy Django's mysqlclient version check
    pymysql.install_as_MySQLdb()
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.mysql", "NAME": env("DB_NAME", "imsdatabase"), "USER": env("DB_USER", "root"),
        "PASSWORD": env("DB_PASSWORD"), "HOST": env("DB_HOST", "127.0.0.1"), "PORT": env("DB_PORT", "3306"),
        "OPTIONS": {"charset": "utf8mb4"},
    }}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["api.core.jwtauth.JwtAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["api.core.response.IMSJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser", "rest_framework.parsers.MultiPartParser",
                               "rest_framework.parsers.FormParser"],
    "EXCEPTION_HANDLER": "api.core.response.exception_handler",
    "UNAUTHENTICATED_USER": None,
}

CORS_ALLOWED_ORIGINS = [o.strip() for o in env("CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

JWT_KEY = env("JWT_KEY", "dev-insecure-jwt-key-change-me-0123456789")
JWT_ISSUER = env("JWT_ISSUER", "IMSBackend")
JWT_AUDIENCE = env("JWT_AUDIENCE", "IMSUsers")
ACCESS_TOKEN_HOURS = 8
REFRESH_TOKEN_DAYS = 7
LOW_STOCK_THRESHOLD = int(env("LOW_STOCK_THRESHOLD", "10"))

MEDIA_ROOT = BASE_DIR / "wwwroot"          # uploads live in wwwroot/uploads, same as the C# backend
STATIC_URL = "/static/"

EMAIL_HOST = env("EMAIL_HOST")
EMAIL_FROM_NAME = env("EMAIL_FROM_NAME", "IMS Inventory System")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(env("EMAIL_PORT", "465")); EMAIL_USE_SSL = EMAIL_PORT == 465; EMAIL_USE_TLS = EMAIL_PORT == 587
    EMAIL_HOST_USER = env("EMAIL_USER"); EMAIL_HOST_PASSWORD = env("EMAIL_PASSWORD")
    DEFAULT_FROM_EMAIL = f"{EMAIL_FROM_NAME} <{EMAIL_HOST_USER}>"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"  # emails (OTP codes) print in the terminal
    DEFAULT_FROM_EMAIL = "IMS <no-reply@ims.local>"

LOGGING = {"version": 1, "disable_existing_loggers": False,
           "handlers": {"console": {"class": "logging.StreamHandler"}},
           "root": {"handlers": ["console"], "level": "INFO"}}
