"""Administration: users, roles, permissions, profile, audit logs, login history, notifications."""
import math
import os
import re
import uuid
from datetime import datetime

from django.conf import settings
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.fieldtypes import utcnow
from ..core.jwtauth import IsAdmin, require
from ..core.response import ApiError, ok
from ..core.serial import to_dict
from ..models import (AuditLogs, LoginHistory, Modules, Notifications, RefreshTokens, RolePermissions, Roles, Users)
from .auth import EMAIL_RE, PASSWORD_RE, hash_password

NAME_RE = re.compile(r"^[A-Za-z ]{2,50}$")


def raw(data, code=200):                    # the original controllers return plain objects for these endpoints
    return Response(data, status=code)


def msg(text, code=400, **extra):
    return Response({"message": text, **extra}, status=code)


# ------------------------------------------------------------------ users
def _user_row(u, role_active):
    return {"id": u.id, "name": u.name, "email": u.email, "phoneNumber": u.phone_number, "role": u.role, "isActive": u.is_active,
            "userIsActive": u.is_active, "roleIsActive": role_active, "effectiveIsActive": u.is_active and role_active,
            "employeeId": u.employee_id, "department": u.department, "warehouse": u.warehouse, "profilePhoto": u.profile_photo,
            "lastLogin": u.last_login.isoformat() if u.last_login else None}


@api_view(["GET", "POST"])
def users(request):
    if request.method == "GET":
        roles = {r.role_name.lower(): r.is_active for r in Roles.objects.all()}
        return raw([_user_row(u, roles.get(u.role.lower(), True)) for u in Users.objects.order_by("id")])
    if str(request.user.role).lower() != "admin":
        return msg("Only administrators can create users.", 403)
    d = request.data; name = str(d.get("name", "")).strip(); email = str(d.get("email", "")).strip().lower()
    phone = re.sub(r"\D", "", str(d.get("phoneNumber", ""))); pw = str(d.get("password", ""))
    if not NAME_RE.match(name): return msg("Full name must contain only letters and spaces.")
    if not EMAIL_RE.match(email): return msg("Enter a valid email address.")
    if not re.fullmatch(r"\d{10}", phone): return msg("Mobile number must contain exactly 10 digits.")
    if not PASSWORD_RE.match(pw): return msg("Password must be 8+ characters with upper and lower case letters, a number and a special character.")
    if pw != str(d.get("confirmPassword", pw)): return msg("Passwords do not match.")
    role = str(d.get("role") or "User").strip()
    if not Roles.objects.filter(role_name__iexact=role).exists(): return msg("The selected role does not exist.")
    if Users.objects.filter(email__iexact=email).exists(): return msg("Email address is already registered.")
    if Users.objects.filter(phone_number=phone).exists(): return msg("Mobile number is already registered.")
    u = Users.objects.create(name=name, email=email, phone_number=phone, password_hash=hash_password(pw), role=role,
                             is_active=bool(d.get("isActive", True)), is_email_verified=True, created_at=utcnow(), updated_at=utcnow())
    log_audit(request, "Create", "Users", u.id, f"User created: {u.email}", "users")
    return raw({"message": "User created successfully."})


@api_view(["GET", "PUT", "DELETE"])
def user_detail(request, pk):
    u = Users.objects.filter(id=pk).first()
    if not u: return msg("User not found.", 404)
    is_admin = str(request.user.role).lower() == "admin"
    if request.method == "GET":
        r = Roles.objects.filter(role_name__iexact=u.role).first()
        return raw(_user_row(u, r.is_active if r else True))
    if not is_admin:
        return msg("Only administrators can modify users.", 403)
    if request.method == "DELETE":
        if u.id == request.user.id: return msg("You cannot delete your own account.")
        if str(u.role).lower() == "admin" and Users.objects.filter(role__iexact="admin").count() <= 1:
            return msg("The last administrator cannot be deleted.")
        Users.objects.filter(id=pk).delete()
        RefreshTokens.objects.filter(user_id=pk).delete()
        log_audit(request, "Delete", "Users", pk, f"User deleted: {u.email}", "users")
        return raw({"message": "User deleted successfully."})
    d = request.data; name = str(d.get("name", u.name)).strip(); email = str(d.get("email", u.email)).strip().lower()
    phone = re.sub(r"\D", "", str(d.get("phoneNumber", u.phone_number or "")))
    if not NAME_RE.match(name): return msg("Full name must contain only letters and spaces.")
    if not EMAIL_RE.match(email): return msg("Enter a valid email address.")
    if phone and not re.fullmatch(r"\d{10}", phone): return msg("Mobile number must contain exactly 10 digits.")
    if Users.objects.filter(email__iexact=email).exclude(id=pk).exists(): return msg("Email address is already registered.")
    if phone and Users.objects.filter(phone_number=phone).exclude(id=pk).exists(): return msg("Mobile number is already registered.")
    role = str(d.get("role") or u.role).strip()
    if not Roles.objects.filter(role_name__iexact=role).exists(): return msg("The selected role does not exist.")
    active = bool(d.get("isActive", u.is_active))
    if u.id == request.user.id and not active: return msg("You cannot deactivate your own account.")
    if role.lower() != "admin" and str(u.role).lower() == "admin" and Users.objects.filter(role__iexact="admin").count() <= 1:
        return msg("The last administrator cannot be changed to another role.")
    if (role != u.role) or (active != u.is_active): u.token_version += 1
    u.name, u.email, u.phone_number, u.role, u.is_active, u.updated_at = name, email, phone or None, role, active, utcnow()
    u.save()
    log_audit(request, "Update", "Users", u.id, f"User updated: {u.email}", "users")
    return raw({"message": "User updated successfully."})


# ------------------------------------------------------------------ roles & permissions
def ensure_permissions(role_id):
    have = set(RolePermissions.objects.filter(role_id=role_id).values_list("module_id", flat=True))
    for m in Modules.objects.all():
        if m.module_id not in have:
            RolePermissions.objects.create(role_id=role_id, module_id=m.module_id, can_view=False, can_add=False, can_edit=False,
                                           can_delete=False, created_at=utcnow(), updated_at=utcnow())


@api_view(["GET", "POST"])
def roles(request):
    if request.method == "GET":
        return raw([to_dict(r) for r in Roles.objects.order_by("role_name")])
    name = str(request.data.get("roleName", request.data.get("name", ""))).strip()
    if not name: return msg("Role name is required.")
    if Roles.objects.filter(role_name__iexact=name).exists(): return msg("A role with this name already exists.")
    r = Roles.objects.create(role_name=name, description=request.data.get("description"), created_at=utcnow(), is_active=True)
    ensure_permissions(r.pk)
    log_audit(request, "Create", "Roles", r.pk, f"Role created: {name}", "roles")
    return raw({"message": "Role created successfully", "roleId": r.pk, "roleName": r.role_name})


@api_view(["GET", "PUT", "DELETE"])
def role_detail(request, pk):
    r = Roles.objects.filter(pk=pk).first()
    if not r: return msg("Role not found.", 404)
    if request.method == "GET": return raw(to_dict(r))
    if request.method == "DELETE":
        if r.role_name.lower() == "admin": return msg("The Admin role cannot be deleted.")
        if Users.objects.filter(role__iexact=r.role_name).exists(): return msg("This role is assigned to users and cannot be deleted.")
        RolePermissions.objects.filter(role_id=pk).delete(); r.delete()
        log_audit(request, "Delete", "Roles", pk, f"Role deleted: {r.role_name}", "roles")
        return raw({"message": "Role deleted successfully"})
    name = str(request.data.get("roleName", request.data.get("name", r.role_name))).strip()
    if Roles.objects.filter(role_name__iexact=name).exclude(pk=pk).exists(): return msg("A role with this name already exists.")
    if r.role_name.lower() == "admin" and name.lower() != "admin": return msg("The Admin role cannot be renamed.")
    old = r.role_name
    r.role_name, r.description = name, request.data.get("description", r.description)
    r.save()
    if old != name: Users.objects.filter(role=old).update(role=name)
    log_audit(request, "Update", "Roles", pk, f"Role updated: {name}", "roles")
    return raw({"message": "Role updated successfully", "roleId": r.pk, "roleName": r.role_name})


@api_view(["PUT"])
def role_status(request, pk):
    r = Roles.objects.filter(pk=pk).first()
    if not r: return msg("Role not found.", 404)
    active = bool(request.data.get("isActive"))
    if r.role_name.lower() == "admin" and not active: return msg("The Admin role cannot be deactivated.")
    r.is_active = active; r.save()
    for u in Users.objects.filter(role__iexact=r.role_name): Users.objects.filter(id=u.id).update(token_version=u.token_version + 1)
    return raw({"message": "Role status updated successfully"})


@api_view(["GET"])
def permission_roles(request):
    return raw([{"roleId": r.pk, "roleName": r.role_name, "description": r.description, "isActive": r.is_active} for r in Roles.objects.all()])


@api_view(["GET"])
def permissions_by_role(request, role_id):
    if not Roles.objects.filter(pk=role_id).exists(): return msg("Role not found", 404)
    ensure_permissions(role_id)
    mods = {m.module_id: m for m in Modules.objects.filter(is_active=True)}
    rows = [p for p in RolePermissions.objects.filter(role_id=role_id) if p.module_id in mods]
    out = [{"permissionId": p.permission_id, "moduleName": mods[p.module_id].module_name, "moduleKey": mods[p.module_id].module_key,
            "canView": bool(p.can_view), "canAdd": bool(p.can_add), "canEdit": bool(p.can_edit), "canDelete": bool(p.can_delete)} for p in rows]
    return raw(sorted(out, key=lambda x: x["moduleName"]))


@api_view(["GET"])
def my_permissions(request):
    from .auth import permissions_for
    return raw({"role": request.user.role, "permissions": permissions_for(request.user.role)})


@api_view(["PUT", "POST"])
def update_permissions(request):
    items = request.data if isinstance(request.data, list) else request.data.get("permissions", [])
    for it in items:
        p = RolePermissions.objects.filter(permission_id=it.get("permissionId")).first()
        if not p: continue
        p.can_view, p.can_add, p.can_edit, p.can_delete = (bool(it.get(k)) for k in ("canView", "canAdd", "canEdit", "canDelete"))
        p.updated_at = utcnow(); p.save()
    log_audit(request, "Update", "Permissions", None, "Role permissions updated", "role_permissions")
    return raw({"message": "Permissions updated successfully"})


@api_view(["POST"])
def reset_role_permissions(request, role_id):
    ensure_permissions(role_id)
    RolePermissions.objects.filter(role_id=role_id).update(can_view=False, can_add=False, can_edit=False, can_delete=False)
    return raw({"message": "Permissions reset successfully"})


@api_view(["POST"])
def clone_permissions(request):
    src, dst = request.data.get("sourceRoleId"), request.data.get("targetRoleId")
    ensure_permissions(dst)
    for s in RolePermissions.objects.filter(role_id=src):
        RolePermissions.objects.filter(role_id=dst, module_id=s.module_id).update(can_view=s.can_view, can_add=s.can_add, can_edit=s.can_edit, can_delete=s.can_delete)
    return raw({"message": "Permissions cloned successfully"})


# ------------------------------------------------------------------ profile
def _profile(u):
    return {"id": u.id, "name": u.name, "email": u.email, "phoneNumber": u.phone_number, "employeeId": u.employee_id,
            "department": u.department, "role": u.role, "warehouse": u.warehouse, "profilePhoto": u.profile_photo,
            "isActive": u.is_active, "lastLogin": u.last_login.isoformat() if u.last_login else None}


@api_view(["GET"])
def profile_me(request):
    u = Users.objects.filter(id=request.user.id).first()
    return raw(_profile(u)) if u else msg("User not found", 404)


@api_view(["GET", "PUT"])
def profile_detail(request, user_id):
    u = Users.objects.filter(id=user_id).first()
    if not u: return msg("User not found", 404)
    if request.method == "GET": return raw(_profile(u))
    if request.user.id != user_id and str(request.user.role).lower() != "admin": return msg("You can only edit your own profile.", 403)
    d = request.data; name = str(d.get("name", u.name)).strip(); email = str(d.get("email", u.email)).strip().lower()
    if not NAME_RE.match(name): return msg("Full name must contain only letters and spaces.")
    if not EMAIL_RE.match(email): return msg("Enter a valid email address.")
    if Users.objects.filter(email__iexact=email).exclude(id=user_id).exists(): return msg("Email address is already registered.")
    phone = re.sub(r"\D", "", str(d.get("phoneNumber", u.phone_number or "")))
    u.name, u.email, u.phone_number = name, email, phone or None
    for a, k in (("employee_id", "employeeId"), ("department", "department"), ("warehouse", "warehouse")):
        if k in d: setattr(u, a, d.get(k) or None)
    u.updated_at = utcnow(); u.save()
    return raw({"message": "Profile updated successfully", "user": _profile(u)})


@api_view(["POST"])
def profile_photo(request, user_id):
    f = request.FILES.get("file") or request.FILES.get("photo") or next(iter(request.FILES.values()), None)
    if not f: return msg("No file was uploaded.")
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"): return msg("Only JPG, PNG or WEBP images are allowed.")
    if f.size > 5 * 1024 * 1024: return msg("Image must be 5 MB or smaller.")
    folder = settings.MEDIA_ROOT / "profilephotos"; folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    with open(folder / name, "wb") as out:
        for chunk in f.chunks(): out.write(chunk)
    Users.objects.filter(id=user_id).update(profile_photo=f"/profilephotos/{name}")
    return raw({"message": "Photo uploaded successfully", "profilePhoto": f"/profilephotos/{name}"})


@api_view(["DELETE"])
def profile_photo_delete(request, user_id):
    Users.objects.filter(id=user_id).update(profile_photo=None)
    return raw({"message": "Photo removed successfully"})


# ------------------------------------------------------------------ audit logs / login history
def _iso_utc(dt):
    return dt.isoformat() + "Z" if dt else None


def _log_row(x):
    return {"logId": x.log_id, "id": x.log_id, "userId": x.user_id, "action": x.action, "module": x.module, "tableName": x.table_name,
            "recordId": x.record_id, "description": x.description, "createdAt": _iso_utc(x.created_at)}


@api_view(["GET"])
def audit_logs(request):
    page = max(int(request.query_params.get("page", 1) or 1), 1); size = min(max(int(request.query_params.get("pageSize", 50) or 50), 1), 100)
    module = (request.query_params.get("module") or "").strip().lower(); term = (request.query_params.get("search") or "").strip()
    q = AuditLogs.objects.all()
    if module and module != "all":
        if module == "inventory":
            q = q.filter(Q(module__iexact="inventory") | Q(module__iexact="stock") | Q(action__icontains="stock") | Q(action__icontains="goods_receipt"))
        elif module == "payments":
            q = q.filter(Q(module__iexact="payments") | Q(action__icontains="payment"))
        elif module == "invoices":
            q = q.filter(Q(module__iexact="sales") | Q(action__icontains="invoice"))
        else:
            q = q.filter(Q(module__iexact=module) | Q(action__icontains=module))
    if term:
        q = q.filter(Q(action__icontains=term) | Q(module__icontains=term) | Q(description__icontains=term) | Q(table_name__icontains=term))
    total = q.count()
    rows = q.order_by("-created_at", "-log_id")[(page - 1) * size: page * size]
    return raw({"page": page, "pageSize": size, "totalRecords": total, "totalPages": math.ceil(total / size) if total else 0,
                "data": [_log_row(x) for x in rows]})


@api_view(["GET"])
def audit_logs_by_module(request, module):
    return raw([_log_row(x) for x in AuditLogs.objects.filter(module__iexact=module).order_by("-created_at")[:500]])


@api_view(["GET"])
def audit_logs_by_user(request, user_id):
    return raw([_log_row(x) for x in AuditLogs.objects.filter(user_id=user_id).order_by("-created_at")[:500]])


def _login_row(x):
    return {"loginHistoryId": x.login_history_id, "id": x.login_history_id, "userId": x.user_id, "loginTime": _iso_utc(x.login_time),
            "deviceInfo": x.device_info, "ipAddress": x.ip_address, "logoutTime": _iso_utc(x.logout_time), "browser": x.browser,
            "operatingSystem": x.operating_system, "logoutType": x.logout_type, "isCurrentSession": bool(x.is_current_session)}


@api_view(["GET"])
def login_history(request, user_id):
    return raw([_login_row(x) for x in LoginHistory.objects.filter(user_id=user_id).order_by("-login_time")[:100]])


@api_view(["GET"])
def login_history_current(request, user_id):
    x = LoginHistory.objects.filter(user_id=user_id, is_current_session=True).order_by("-login_time").first()
    return raw(_login_row(x)) if x else msg("No active session.", 404)


# ------------------------------------------------------------------ notifications
def _note(n):
    return {"notificationId": n.notification_id, "id": n.notification_id, "title": n.title, "message": n.message, "type": n.type,
            "isRead": bool(n.is_read), "createdAt": _iso_utc(n.created_at)}


@api_view(["GET", "POST"])
def notifications(request):
    if request.method == "GET":
        q = Notifications.objects.order_by("-created_at")
        if request.query_params.get("unreadOnly") == "true": q = q.filter(is_read=False)
        return ok([_note(n) for n in q[:200]])
    n = Notifications.objects.create(title=str(request.data.get("title", "")).strip() or "Notification", message=request.data.get("message"),
                                     type=request.data.get("type", "info"), is_read=False, created_at=utcnow())
    return ok(_note(n), "Notification created.", 201)


@api_view(["GET"])
def notifications_unread(request):
    return ok({"count": Notifications.objects.filter(is_read=False).count()})


@api_view(["PUT", "POST"])
def notification_read(request, pk):
    Notifications.objects.filter(pk=pk).update(is_read=True)
    return ok(None, "Notification marked as read.")


@api_view(["DELETE"])
def notification_delete(request, pk):
    Notifications.objects.filter(pk=pk).delete()
    return ok(None, "Notification deleted.")
