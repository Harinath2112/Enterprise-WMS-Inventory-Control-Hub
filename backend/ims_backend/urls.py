import re

from django.conf import settings
from django.urls import re_path
from django.views.static import serve

from api import urls as api_urls

urlpatterns = list(api_urls.urlpatterns)

# Lightweight unauthenticated health checks for cloud load balancers and uptime monitors
urlpatterns.append(re_path(r"^health/?$", api_urls.health))

# Static file serving for local development / backwards compatibility
for prefix in ("uploads", "images", "profilephotos", "companylogos"):
    urlpatterns.append(re_path(rf"^{prefix}/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT / prefix}))
