from ..models import AuditLogs, Notifications
from .fieldtypes import utcnow


def log_audit(request, action, module, record_id=None, description=None, table=None):
    uid = getattr(getattr(request, "user", None), "id", None)
    try:
        AuditLogs.objects.create(user_id=uid, action=action, module=module, record_id=record_id,
                                 description=description, created_at=utcnow(), table_name=table or module)
    except Exception:       # auditing must never break the request
        pass


def notify(title, message, type_="info", user_id=None, related_id=None):
    try:
        fields = {f.name for f in Notifications._meta.concrete_fields}
        data = {"created_at": utcnow()}
        for k, v in (("title", title), ("message", message), ("type", type_), ("user_id", user_id)):
            if k in fields:
                data[k] = v
        Notifications.objects.create(**data)
    except Exception:
        pass
