"""JWT (HS256) issue/verify, DRF authentication class and module-permission checks."""
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from ..models import Modules, RolePermissions, Roles, Users, RefreshTokens
from .fieldtypes import utcnow


@dataclass
class AuthUser:
    id: int
    name: str
    email: str
    role: str
    token_version: int = 1
    is_authenticated: bool = True


def make_access_token(user) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": str(user.id), "email": user.email, "name": user.name, "role": user.role, "UserId": str(user.id),
        "TokenVersion": str(user.token_version), "iss": settings.JWT_ISSUER, "aud": settings.JWT_AUDIENCE,
        "iat": now, "exp": now + timedelta(hours=settings.ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(payload, settings.JWT_KEY, algorithm="HS256")


def make_refresh_token(user, ip="", device=""):
    row = RefreshTokens(user_id=user.id, token=secrets.token_urlsafe(64), expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
                        created_at=utcnow(), created_by_ip=(ip or "")[:50], device_name=(device or "")[:255])
    row.save()
    return row


class JwtAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.lower().startswith("bearer "):
            return None
        token = header[7:].strip()
        try:
            claims = jwt.decode(token, settings.JWT_KEY, algorithms=["HS256"], audience=settings.JWT_AUDIENCE,
                                issuer=settings.JWT_ISSUER)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Your session has expired. Please sign in again.")
        except jwt.PyJWTError:
            raise AuthenticationFailed("Invalid authentication token.")
        row = Users.objects.filter(id=int(claims.get("UserId") or claims["sub"])).first()
        if not row or not row.is_active:
            raise AuthenticationFailed("User account is not available.")
        if str(row.token_version) != str(claims.get("TokenVersion", row.token_version)):
            raise AuthenticationFailed("Your session was signed out. Please sign in again.")
        return AuthUser(row.id, row.name, row.email, row.role, row.token_version), token


def has_permission(role: str, module_key: str, action: str) -> bool:
    mod = Modules.objects.filter(module_key__iexact=module_key).first()
    r = Roles.objects.filter(role_name__iexact=role).first()
    if not mod or not r or not r.is_active:
        return False
    p = RolePermissions.objects.filter(role_id=r.pk, module_id=mod.pk).first()
    if not p:
        return False
    return bool({"view": p.can_view, "add": p.can_add, "edit": p.can_edit, "delete": p.can_delete}.get(action.lower(), False))


def require(module_key: str, action: str):
    class _Perm(BasePermission):
        message = "You do not have permission to perform this action."

        def has_permission(self, request, view):
            u = request.user
            return bool(u and getattr(u, "is_authenticated", False) and has_permission(u.role, module_key, action))
    return _Perm


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and getattr(u, "is_authenticated", False) and str(u.role).lower() in ("admin", "super admin", "superadmin"))
