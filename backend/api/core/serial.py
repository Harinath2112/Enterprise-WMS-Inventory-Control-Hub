"""Model <-> JSON helpers. JSON keys follow the original API: camelCase of the C# property (== DB column)."""
import re
from datetime import date, datetime, time
from decimal import Decimal

_cache = {}


def json_key(column: str) -> str:
    if "_" in column:                                   # value_id -> valueId
        head, *rest = column.split("_")
        return head.lower() + "".join(p[:1].upper() + p[1:] for p in rest)
    m = re.match(r"^([A-Z]+)(?=[A-Z][a-z]|$|[^A-Za-z])", column)   # STJ camelCase: GRNNumber -> grnNumber, UserId -> userId
    if m and len(m.group(1)) > 1:
        return m.group(1).lower() + column[len(m.group(1)):]
    return column[:1].lower() + column[1:]


def field_map(model):
    """{jsonKey: field}"""
    if model not in _cache:
        _cache[model] = {json_key(f.column): f for f in model._meta.concrete_fields}
    return _cache[model]


def _plain(v):
    if isinstance(v, Decimal):
        f = float(v)
        return int(f) if f.is_integer() and abs(f) < 1e15 and False else f
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (date, time)):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray)):
        return any(v)
    return v


def to_dict(obj, exclude=(), extra=None):
    out = {}
    for key, f in field_map(type(obj)).items():
        if key in exclude or f.attname in exclude:
            continue
        out[key] = _plain(getattr(obj, f.attname))
    if extra:
        out.update(extra)
    return out


def _coerce(field, value):
    from django.db import models
    if value is None:
        return None
    t = type(field).__name__
    if t in ("BooleanField", "BitBooleanField"):
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "yes", "y", "on")
        return bool(value)
    if isinstance(field, (models.IntegerField, models.BigIntegerField, models.AutoField)):
        if value == "" or value is False:
            return None
        return int(float(value))
    if isinstance(field, models.DecimalField):
        return None if value == "" else Decimal(str(value))
    if isinstance(field, models.FloatField):
        return None if value == "" else float(value)
    if isinstance(field, models.DateTimeField):
        if isinstance(value, str):
            if not value.strip():
                return None
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        return value
    if isinstance(field, models.DateField):
        if isinstance(value, str):
            return None if not value.strip() else date.fromisoformat(value[:10])
        return value
    if isinstance(field, (models.CharField, models.TextField)):
        return str(value)
    return value


def lookup(data: dict, key: str):
    """Case-insensitive key lookup so camelCase/PascalCase payloads both work."""
    if key in data:
        return True, data[key]
    low = key.lower()
    for k, v in data.items():
        if k.lower() == low or k.lower().replace("_", "") == low:
            return True, v
    return False, None


def apply_payload(obj, data: dict, exclude=(), only=None):
    """Copy known keys from a JSON body onto the model instance. Returns list of changed json keys."""
    changed = []
    for key, f in field_map(type(obj)).items():
        if f.primary_key or getattr(f, "generated", False) or key in exclude or (only and key not in only):
            continue
        present, value = lookup(data, key)
        if not present:
            continue
        try:
            setattr(obj, f.attname, _coerce(f, value))
        except (ValueError, ArithmeticError):
            raise ValueError(f"Invalid value for {key}.")
        changed.append(key)
    return changed
