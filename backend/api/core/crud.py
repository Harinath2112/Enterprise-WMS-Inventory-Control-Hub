"""Generic list/create/read/update/delete views mirroring the C# controllers' behaviour:
soft delete when the table has IsDeleted, case-insensitive duplicate checks, audit logging, camelCase JSON."""
from django.db.models import Q
from rest_framework.views import APIView

from .audit import log_audit
from .fieldtypes import utcnow
from .response import ApiError, ok
from .serial import _coerce, apply_payload, field_map, json_key, lookup, to_dict

RESERVED = {"page", "pageSize", "search", "sort", "sortBy", "sortDir", "order", "limit", "offset", "includeDeleted", "q"}


def _fields(model):
    return {f.name: f for f in model._meta.concrete_fields}


class CrudBase(APIView):
    model = None
    label = "Record"
    module = None                 # audit module name
    order = None                  # default ordering (list of attr names)
    search = ()                   # attrs searched by ?search=
    unique = ()                   # attrs that must be unique (case-insensitive, ignoring deleted)
    required = ()                 # (attr, message)
    exclude = ()                  # json keys never returned
    scope = None                  # optional callable(request, qs) -> qs
    extra = None                  # optional callable(obj) -> dict of extra json fields
    bulk_extra = None             # optional callable(list_of_objs) -> {pk: extra dict}  (avoids N+1 queries)

    # ----- hooks
    def before_save(self, request, obj, data, is_new):
        pass

    def after_save(self, request, obj, data, is_new):
        pass

    def before_delete(self, request, obj):
        pass

    # ----- helpers
    def qs(self, request):
        q = self.model.objects.all()
        f = _fields(self.model)
        if "is_deleted" in f and request.query_params.get("includeDeleted") != "true":
            q = q.filter(is_deleted=False)
        if self.scope:
            q = self.scope(request, q)
        return q

    def filtered(self, request):
        q = self.qs(request)
        fm = field_map(self.model)
        for key, val in request.query_params.items():
            if key in RESERVED or val == "" or key not in fm:
                continue
            f = fm[key]
            try:
                q = q.filter(**{f.name: _coerce(f, val)})
            except (ValueError, ArithmeticError):
                continue
        term = (request.query_params.get("search") or request.query_params.get("q") or "").strip()
        if term and self.search:
            cond = Q()
            for a in self.search:
                cond |= Q(**{f"{a}__icontains": term})
            q = q.filter(cond)
        if self.order:
            q = q.order_by(*self.order)
        return q

    def dump(self, obj, extra=None):
        d = to_dict(obj, exclude=self.exclude)
        if self.extra:
            d.update(self.extra(obj) or {})
        if extra:
            d.update(extra)
        return d

    def dump_many(self, objs):
        objs = list(objs)
        bulk = self.bulk_extra(objs) if self.bulk_extra else {}
        return [self.dump(o, bulk.get(o.pk)) for o in objs]

    def get_obj(self, request, pk):
        obj = self.qs(request).filter(pk=pk).first()
        if not obj:
            raise ApiError(f"{self.label} was not found.", 404)
        return obj

    def body(self, request):
        data = request.data
        if not isinstance(data, dict):
            raise ApiError("A JSON object body is required.")
        return data

    def validate(self, obj, data, is_new):
        for attr, msg in self.required:
            if not str(getattr(obj, attr, "") or "").strip():
                raise ApiError(msg, errors={json_key(_fields(self.model)[attr].column): [msg]})
        for attr in self.unique:
            val = getattr(obj, attr, None)
            if val in (None, ""):
                continue
            dup = self.qs_all().filter(**{f"{attr}__iexact": str(val).strip()})
            if obj.pk:
                dup = dup.exclude(pk=obj.pk)
            if dup.exists():
                raise ApiError(f"{self.label} with this {attr.replace('_', ' ')} already exists.")

    def qs_all(self):
        q = self.model.objects.all()
        if "is_deleted" in _fields(self.model):
            q = q.filter(is_deleted=False)
        return q

    def normalise(self, obj):
        for attr in ("name", "description"):
            v = getattr(obj, attr, None)
            if isinstance(v, str):
                setattr(obj, attr, " ".join(v.split()) or (None if attr == "description" else ""))

    def save_from(self, request, obj, data, is_new):
        try:
            apply_payload(obj, data)
        except ValueError as e:
            raise ApiError(str(e))
        self.normalise(obj)
        names = _fields(self.model)
        now = utcnow()
        if is_new and "created_at" in names and not data.get("createdAt"):
            obj.created_at = now
        if "updated_at" in names:
            obj.updated_at = now
        self.before_save(request, obj, data, is_new)
        self.validate(obj, data, is_new)
        obj.save()
        self.after_save(request, obj, data, is_new)
        return obj


class ListCreate(CrudBase):
    def get(self, request):
        return ok(self.dump_many(self.filtered(request)))

    def post(self, request):
        obj = self.model()
        self.save_from(request, obj, self.body(request), True)
        log_audit(request, "Create", self.module or self.label, obj.pk, f"{self.label} created: {getattr(obj, 'name', obj.pk)}")
        return ok(self.dump(obj), f"{self.label} created successfully.", 201)


class Detail(CrudBase):
    def get(self, request, pk):
        return ok(self.dump(self.get_obj(request, pk)))

    def put(self, request, pk):
        obj = self.get_obj(request, pk)
        self.save_from(request, obj, self.body(request), False)
        log_audit(request, "Update", self.module or self.label, obj.pk, f"{self.label} updated: {getattr(obj, 'name', obj.pk)}")
        return ok(self.dump(obj), f"{self.label} updated successfully.")

    patch = put

    def delete(self, request, pk):
        obj = self.get_obj(request, pk)
        self.before_delete(request, obj)
        if "is_deleted" in _fields(self.model):
            obj.is_deleted = True
            if "updated_at" in _fields(self.model):
                obj.updated_at = utcnow()
            if "deleted_at" in _fields(self.model):
                obj.deleted_at = utcnow()
            obj.save()
        else:
            obj.delete()
        log_audit(request, "Delete", self.module or self.label, pk, f"{self.label} deleted: {getattr(obj, 'name', pk)}")
        return ok(None, f"{self.label} deleted successfully.")


def make_crud(model, label, **attrs):
    """Return (ListView, DetailView) classes configured for `model`."""
    common = {"model": model, "label": label, **attrs}
    L = type(f"{model.__name__}List", (ListCreate,), dict(common))
    D = type(f"{model.__name__}Detail", (Detail,), dict(common))
    return L, D
