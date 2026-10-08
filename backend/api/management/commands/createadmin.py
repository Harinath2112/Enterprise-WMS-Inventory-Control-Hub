"""python manage.py createadmin --email you@example.com --password 'Strong@123' --name Admin --phone 9999999999"""
from django.core.management.base import BaseCommand

from api.core.fieldtypes import utcnow
from api.models import Roles, Users
from api.views.auth import hash_password
from api.views.admin import ensure_permissions


class Command(BaseCommand):
    help = "Create (or reset) an administrator account"

    def add_arguments(self, p):
        p.add_argument("--email", required=True); p.add_argument("--password", required=True)
        p.add_argument("--name", default="Administrator"); p.add_argument("--phone", default=None)

    def handle(self, *a, **o):
        role = Roles.objects.filter(role_name__iexact="Admin").first() or Roles.objects.create(role_name="Admin", description="System Administrator", created_at=utcnow(), is_active=True)
        ensure_permissions(role.pk)
        from api.models import RolePermissions
        RolePermissions.objects.filter(role_id=role.pk).update(can_view=True, can_add=True, can_edit=True, can_delete=True)
        u = Users.objects.filter(email__iexact=o["email"]).first() or Users(email=o["email"].lower(), created_at=utcnow())
        u.name, u.role, u.is_active, u.is_email_verified, u.password_hash = o["name"], "Admin", True, True, hash_password(o["password"])
        u.phone_number = o["phone"] or u.phone_number; u.updated_at = utcnow(); u.failed_login_attempts = 0; u.lockout_end = None
        u.save()
        self.stdout.write(self.style.SUCCESS(f"Administrator ready: {u.email}"))
