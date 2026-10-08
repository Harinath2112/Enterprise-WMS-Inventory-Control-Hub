"""Authentication endpoints: register, login (+OTP), refresh, password flows, logout, profile."""
import random
import re
import secrets
import uuid
from datetime import timedelta

import bcrypt
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from ..core.fieldtypes import utcnow
from ..core.jwtauth import make_access_token, make_refresh_token
from ..core.mail import send_email
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import (LoginHistory, Modules, Otps, Pendingusers, RefreshTokens, RolePermissions, Roles,
                      SystemSettings, Users)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,64}$")
INVALID = "Invalid email/phone number or password."


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(11)).decode().replace("$2b$", "$2a$", 1)


def check_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.replace("$2a$", "$2b$", 1).encode())
    except ValueError:
        return False


def client_ip(request):
    return (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0] or request.META.get("REMOTE_ADDR", "")).strip()


def permissions_for(role_name):
    role = Roles.objects.filter(role_name__iexact=role_name).first()
    if not role:
        return []
    mods = {m.module_id: m for m in Modules.objects.all()}
    rows = RolePermissions.objects.filter(role_id=role.pk).all()
    out = [{"moduleId": p.module_id, "moduleKey": mods[p.module_id].module_key, "moduleName": mods[p.module_id].module_name,
            "canView": bool(p.can_view), "canAdd": bool(p.can_add), "canEdit": bool(p.can_edit), "canDelete": bool(p.can_delete),
            "_o": mods[p.module_id].display_order or 0} for p in rows if p.module_id in mods]
    out.sort(key=lambda x: x["_o"])
    for x in out:
        x.pop("_o")
    return out


def _parse_agent(ua):
    browser = next((b for b in ("Edg", "Chrome", "Firefox", "Safari", "OPR") if b in ua), "Unknown")
    osn = next((o for o in ("Windows", "Mac OS", "Android", "iPhone", "Linux") if o in ua), "Unknown")
    return {"Edg": "Edge", "OPR": "Opera"}.get(browser, browser), osn


def issue_session(request, user, message="Login successful."):
    ua = request.META.get("HTTP_USER_AGENT", "")[:250]
    browser, osn = _parse_agent(ua)
    LoginHistory.objects.filter(user_id=user.id, is_current_session=True).update(is_current_session=False)
    LoginHistory.objects.create(user_id=user.id, login_time=utcnow(), device_info=ua, ip_address=client_ip(request)[:50],
                                browser=browser, operating_system=osn, is_current_session=True)
    user.last_login = utcnow()
    user.save(update_fields=["last_login"])
    refresh = make_refresh_token(user, client_ip(request), ua)
    return ok({
        "token": make_access_token(user), "refreshToken": refresh.token,
        "expiresAt": (utcnow() + timedelta(minutes=15)).isoformat(),
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        "permissions": permissions_for(user.role),
    }, message)


def send_otp(user_or_email, purpose, user_id=None, subject="IMS Verification Code", title="Verification", name=""):
    email = user_or_email
    Otps.objects.filter(email=email, purpose=purpose, is_used=False).delete()
    code = str(random.SystemRandom().randint(100000, 999999))
    Otps.objects.create(user_id=user_id, email=email, code=code, created_at=utcnow(), expiry_time=utcnow() + timedelta(minutes=5),
                        is_used=False, purpose=purpose)
    send_email(email, subject, f"<h2>{title}</h2><p>Hello {name or ''},</p><p>Your code is:</p><h1>{code}</h1>"
                               "<p>This code is valid for 5 minutes. If you did not request it, please ignore this email.</p>")
    return code


def _body(request):
    return request.data if isinstance(request.data, dict) else {}


def _get(d, *keys, default=""):
    for k in keys:
        for dk, v in d.items():
            if dk.lower() == k.lower() and v is not None:
                return v
    return default


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    d = _body(request)
    name = str(_get(d, "name")).strip(); email = str(_get(d, "email")).strip().lower()
    phone = re.sub(r"\D", "", str(_get(d, "phoneNumber", "phone")))
    pw = str(_get(d, "password")); confirm = str(_get(d, "confirmPassword", default=pw))
    role = str(_get(d, "role")).strip() or "User"
    if not name: raise ApiError("Full name is required.", errors={"Name": ["Full name is required."]})
    if len(name) < 2 or len(name) > 50 or not re.fullmatch(r"[A-Za-z ]+", name):
        raise ApiError("Full name must be 2-50 characters and contain only letters and spaces.", errors={"Name": ["Invalid full name."]})
    if not EMAIL_RE.match(email): raise ApiError("Please enter a valid email address.", errors={"Email": ["Please enter a valid email address."]})
    if not re.fullmatch(r"\d{10}", phone): raise ApiError("Mobile number must contain exactly 10 digits.", errors={"PhoneNumber": ["Invalid mobile number."]})
    if not PASSWORD_RE.match(pw):
        raise ApiError("Password must be 8+ characters with upper and lower case letters, a number and a special character.",
                       errors={"Password": ["Password does not meet the requirements."]})
    if pw != confirm: raise ApiError("Passwords do not match.", errors={"ConfirmPassword": ["Passwords do not match."]})
    Pendingusers.objects.filter(email_verification_token_expiry__lt=utcnow()).delete()
    if Users.objects.filter(email__iexact=email).exists() or Pendingusers.objects.filter(email__iexact=email).exists():
        raise ApiError("Email address is already registered.", errors={"Email": ["Email address is already registered."]})
    if Users.objects.filter(phone_number=phone).exists() or Pendingusers.objects.filter(phone_number=phone).exists():
        raise ApiError("Mobile number is already registered.", errors={"PhoneNumber": ["Mobile number is already registered."]})
    Pendingusers.objects.create(name=name, email=email, phone_number=phone, password_hash=hash_password(pw), role=role,
                                email_verification_token=str(uuid.uuid4()), email_verification_token_expiry=utcnow() + timedelta(minutes=10))
    send_otp(email, "EmailVerification", subject="Email Verification OTP", title="Email Verification", name=name)
    return ok({"email": email, "role": role}, "Registration successful. Please check your email for the verification OTP.")


def _activate_pending(pending):
    user = Users.objects.create(name=pending.name, email=pending.email, password_hash=pending.password_hash, role=pending.role or "User",
                                is_active=True, phone_number=pending.phone_number, is_email_verified=True, created_at=utcnow(),
                                updated_at=utcnow(), token_version=1)
    Otps.objects.filter(email=pending.email, purpose="EmailVerification").delete()
    pending.delete()
    return user


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email_otp(request):
    d = _body(request); email = str(_get(d, "email")).strip().lower(); code = str(_get(d, "otp")).strip()
    pending = Pendingusers.objects.filter(email__iexact=email).first()
    if not pending:
        if Users.objects.filter(email__iexact=email, is_email_verified=True).exists():
            return ok(None, "Email is already verified. You can log in.")
        raise ApiError("No pending registration was found for this email.", 404)
    otp = Otps.objects.filter(email__iexact=email, purpose="EmailVerification", is_used=False).order_by("-id").first()
    if not otp or otp.code != code or otp.expiry_time < utcnow():
        raise ApiError("Invalid or expired OTP.")
    _activate_pending(pending)
    return ok(None, "Email verified successfully. You can now log in.")


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email(request):
    token = request.query_params.get("token", "")
    pending = Pendingusers.objects.filter(email_verification_token=token).first()
    if not pending or pending.email_verification_token_expiry < utcnow():
        raise ApiError("The verification link is invalid or has expired.")
    _activate_pending(pending)
    return ok(None, "Email verified successfully.")


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification(request):
    email = str(_get(_body(request), "email")).strip().lower()
    pending = Pendingusers.objects.filter(email__iexact=email).first()
    if not pending:
        raise ApiError("No pending registration was found for this email.", 404)
    pending.email_verification_token_expiry = utcnow() + timedelta(minutes=10)
    pending.save(update_fields=["email_verification_token_expiry"])
    send_otp(email, "EmailVerification", subject="Email Verification OTP", title="Email Verification", name=pending.name)
    return ok(None, "A new verification OTP has been sent.")


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    d = _body(request); ident = str(_get(d, "emailOrPhone", "email")).strip(); pw = str(_get(d, "password"))
    if not ident or not pw:
        raise ApiError("Email/phone and password are required.")
    phone = re.sub(r"\D", "", ident)
    user = Users.objects.filter(email__iexact=ident).first() or (Users.objects.filter(phone_number=phone).first() if phone else None)
    if not user:
        raise ApiError(INVALID, 401)
    if not user.is_email_verified: raise ApiError("Please verify your email before logging in.", 401)
    if not user.is_active: raise ApiError("Your account is inactive.", 401)
    role = Roles.objects.filter(role_name__iexact=user.role).first()
    if not role or not role.is_active:
        raise ApiError("Your assigned role is inactive. Please contact the administrator.", 401)
    if user.lockout_end and user.lockout_end > utcnow():
        raise ApiError(f"Your account is locked until {user.lockout_end:%Y-%m-%d %H:%M:%S} UTC.", 401)
    if not check_password(pw, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.lockout_end = utcnow() + timedelta(minutes=15); user.failed_login_attempts = 0
            user.save(update_fields=["failed_login_attempts", "lockout_end"])
            raise ApiError("Your account has been locked for 15 minutes due to multiple failed login attempts.", 401)
        user.save(update_fields=["failed_login_attempts"])
        raise ApiError(f"{INVALID} Remaining attempts: {5 - user.failed_login_attempts}", 401)
    if user.failed_login_attempts or user.lockout_end:
        user.failed_login_attempts = 0; user.lockout_end = None
        user.save(update_fields=["failed_login_attempts", "lockout_end"])
    ss = SystemSettings.objects.first()
    if ss and ss.enable_two_factor_auth:
        send_otp(user.email, "Login", user_id=user.id, subject="IMS Login Verification Code", title="Login Verification", name=user.name)
        return ok({"requiresOtp": True, "userId": user.id, "email": user.email}, "OTP sent successfully.")
    return issue_session(request, user)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
    d = _body(request); code = str(_get(d, "otp")).strip(); email = str(_get(d, "email")).strip().lower(); uid = _get(d, "userId", default=None)
    user = Users.objects.filter(id=int(uid)).first() if uid not in (None, "") else Users.objects.filter(email__iexact=email).first()
    if not user: raise ApiError("User not found.", 404)
    otp = Otps.objects.filter(user_id=user.id, purpose="Login", is_used=False).order_by("-id").first()
    if not otp or otp.code != code or otp.expiry_time < utcnow():
        raise ApiError("Invalid or expired OTP.", 401)
    otp.is_used = True; otp.save(update_fields=["is_used"])
    return issue_session(request, user)


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_login_otp(request):
    d = _body(request); uid = _get(d, "userId", default=None); email = str(_get(d, "email")).strip().lower()
    user = Users.objects.filter(id=int(uid)).first() if uid not in (None, "") else Users.objects.filter(email__iexact=email).first()
    if not user: raise ApiError("User not found.", 404)
    send_otp(user.email, "Login", user_id=user.id, subject="IMS Login Verification Code", title="Login Verification", name=user.name)
    return ok(None, "A new OTP has been sent.")


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token(request):
    token = str(_get(_body(request), "refreshToken"))
    row = RefreshTokens.objects.filter(token=token).first()
    if not row or row.revoked_at or row.expires_at < utcnow():
        raise ApiError("Invalid or expired refresh token.", 401)
    user = Users.objects.filter(id=row.user_id, is_active=True).first()
    if not user: raise ApiError("User not found.", 401)
    row.revoked_at = utcnow(); row.save(update_fields=["revoked_at"])
    new = make_refresh_token(user, client_ip(request), request.META.get("HTTP_USER_AGENT", ""))
    return ok({"token": make_access_token(user), "refreshToken": new.token,
               "expiresAt": (utcnow() + timedelta(minutes=15)).isoformat()}, "Token refreshed.")


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    email = str(_get(_body(request), "email")).strip().lower()
    user = Users.objects.filter(email__iexact=email).first()
    if user:
        send_otp(user.email, "ResetPassword", user_id=user.id, subject="IMS Password Reset Code", title="Password Reset", name=user.name)
    return ok(None, "If the email is registered, a password reset code has been sent.")


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    d = _body(request); email = str(_get(d, "email")).strip().lower(); code = str(_get(d, "otp")).strip(); new = str(_get(d, "newPassword"))
    if not PASSWORD_RE.match(new):
        raise ApiError("Password must be 8+ characters with upper and lower case letters, a number and a special character.")
    otp = Otps.objects.filter(email__iexact=email, purpose="ResetPassword", is_used=False).order_by("-id").first()
    user = Users.objects.filter(email__iexact=email).first()
    if not user or not otp or otp.code != code or otp.expiry_time < utcnow():
        raise ApiError("Invalid or expired OTP.")
    user.password_hash = hash_password(new); user.token_version += 1; user.failed_login_attempts = 0; user.lockout_end = None
    user.save(update_fields=["password_hash", "token_version", "failed_login_attempts", "lockout_end"])
    otp.is_used = True; otp.save(update_fields=["is_used"])
    return ok(None, "Password reset successfully. Please log in.")


@api_view(["PUT"])
def change_password(request, user_id):
    d = _body(request); cur = str(_get(d, "currentPassword")); new = str(_get(d, "newPassword"))
    if request.user.id != user_id and str(request.user.role).lower() != "admin":
        raise ApiError("You can only change your own password.", 403)
    user = Users.objects.filter(id=user_id).first()
    if not user: raise ApiError("User not found.", 404)
    if not check_password(cur, user.password_hash): raise ApiError("Current password is incorrect.")
    if not PASSWORD_RE.match(new): raise ApiError("New password does not meet the password requirements.")
    if cur == new: raise ApiError("New password must be different from the current password.")
    user.password_hash = hash_password(new); user.token_version += 1; user.updated_at = utcnow()
    user.save(update_fields=["password_hash", "token_version", "updated_at"])
    RefreshTokens.objects.filter(user_id=user.id, revoked_at__isnull=True).update(revoked_at=utcnow())
    return ok(None, "Password changed successfully. Please log in again.")


@api_view(["POST"])
def logout(request, user_id):
    RefreshTokens.objects.filter(user_id=user_id, revoked_at__isnull=True).update(revoked_at=utcnow())
    LoginHistory.objects.filter(user_id=user_id, is_current_session=True).update(is_current_session=False, logout_time=utcnow(), logout_type="Manual")
    return ok(None, "Logged out successfully.")


@api_view(["POST"])
def logout_all_devices(request, user_id):
    Users.objects.filter(id=user_id).update(token_version=Users.objects.get(id=user_id).token_version + 1)
    RefreshTokens.objects.filter(user_id=user_id, revoked_at__isnull=True).update(revoked_at=utcnow())
    LoginHistory.objects.filter(user_id=user_id, is_current_session=True).update(is_current_session=False, logout_time=utcnow(), logout_type="AllDevices")
    return ok(None, "Logged out from all devices.")


@api_view(["GET"])
def claims(request):
    u = request.user
    return ok([{"type": "UserId", "value": str(u.id)}, {"type": "email", "value": u.email}, {"type": "role", "value": u.role}])
