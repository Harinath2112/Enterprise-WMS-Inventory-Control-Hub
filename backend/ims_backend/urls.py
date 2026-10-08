import re

from django.conf import settings
from django.urls import re_path
from django.views.static import serve

from api import urls as api_urls

urlpatterns = list(api_urls.urlpatterns)
for prefix in ("uploads", "images", "profilephotos"):        # static files written by the API (same URLs as the C# backend)
    urlpatterns.append(re_path(rf"^{prefix}/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT / prefix}))
