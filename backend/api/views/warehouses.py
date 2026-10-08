"""Warehouses, racks, bins, warehouse summary/details."""
import re
from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.crud import make_crud
from ..core.fieldtypes import utcnow
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import BinStock, Bins, Products, Racks, Stock, Warehouses, WarehouseZones

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def _wh_rows(whs):
    whs = list(whs); ids = [w.pk for w in whs]
    stock = {}
    for r in Stock.objects.filter(warehouse_id__in=ids, quantity__gt=0, is_deleted=False).values("warehouse_id", "product_id").annotate(q=Sum("quantity")):
        stock.setdefault(r["warehouse_id"], {})[r["product_id"]] = float(r["q"])
    prods = {p.pk: p for p in Products.objects.filter(pk__in={pid for m in stock.values() for pid in m})}
    racks = {r["warehouse_id"]: r["c"] for r in Racks.objects.filter(warehouse_id__in=ids).values("warehouse_id").annotate(c=Count("rack_id"))}
    bins = {r["warehouse_id"]: r["c"] for r in Bins.objects.filter(warehouse_id__in=ids).values("warehouse_id").annotate(c=Count("bin_id"))}
    out = []
    for w in whs:
        items = [{"productId": pid, "productName": prods[pid].name if pid in prods else None, "sku": prods[pid].sku if pid in prods else None, "quantity": q}
                 for pid, q in stock.get(w.pk, {}).items()]
        out.append(to_dict(w, exclude=("isDeleted", "deletedAt"), extra={
            "id": w.pk, "code": w.warehouse_code, "products": items, "totalProducts": len(items), "totalStock": sum(i["quantity"] for i in items),
            "totalStockUnits": sum(i["quantity"] for i in items), "totalRacks": racks.get(w.pk, 0), "totalBins": bins.get(w.pk, 0),
            "racks": racks.get(w.pk, 0), "bins": bins.get(w.pk, 0)}))
    return out


def _wh_code():
    n = Warehouses.objects.count() + 1
    while Warehouses.objects.filter(warehouse_code=f"WH-{n:03d}").exists(): n += 1
    return f"WH-{n:03d}"


def _wh_save(request, w):
    d = request.data; new = w.pk is None
    name = " ".join(str(d.get("name", w.name or "")).split())
    if not name: raise ApiError("Warehouse name is required.", errors={"Name": ["Warehouse name is required."]})
    email = str(d.get("email", w.email or "") or "").strip().lower()
    if email and not EMAIL_RE.match(email): raise ApiError("Please enter a valid email address.")
    phone = re.sub(r"\D", "", str(d.get("phone", w.phone or "") or ""))
    if phone and not re.fullmatch(r"\d{10}", phone[-10:]): raise ApiError("Phone number must contain 10 digits.")
    dup = Warehouses.objects.filter(name__iexact=name, is_deleted=False)
    if w.pk: dup = dup.exclude(pk=w.pk)
    if dup.exists(): raise ApiError("A warehouse with this name already exists.", 409)
    w.name = name; w.location = " ".join(str(d.get("location", w.location or "") or "").split()) or None
    w.manager_name = " ".join(str(d.get("managerName", w.manager_name or "") or "").split()) or None
    w.phone = phone[-10:] or None; w.email = email or None
    w.status = str(d.get("status") or w.status or "active").lower()
    code = str(d.get("warehouseCode") or d.get("code") or "").strip().upper()
    w.warehouse_code = code or w.warehouse_code or _wh_code()
    if Warehouses.objects.filter(warehouse_code__iexact=w.warehouse_code).exclude(pk=w.pk or 0).exists(): raise ApiError("Warehouse code already exists.", 409)
    if new: w.created_at = utcnow(); w.is_deleted = False
    w.updated_at = utcnow(); w.save()
    log_audit(request, "Create" if new else "Update", "Warehouses", w.pk, f"Warehouse {'created' if new else 'updated'}: {w.name}", "warehouses")
    return ok(_wh_rows([w])[0], f"Warehouse {'created' if new else 'updated'} successfully.", 201 if new else 200)


@api_view(["GET", "POST"])
def warehouses(request):
    if request.method == "POST": return _wh_save(request, Warehouses())
    return ok(_wh_rows(Warehouses.objects.filter(is_deleted=False).order_by("name")))


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def warehouse_detail(request, pk):
    w = Warehouses.objects.filter(pk=pk, is_deleted=False).first()
    if not w: return fail("Warehouse not found.", 404)
    if request.method == "GET": return ok(_wh_rows([w])[0])
    if request.method in ("PUT", "PATCH"): return _wh_save(request, w)
    if Stock.objects.filter(warehouse_id=pk, quantity__gt=0, is_deleted=False).exists():
        return fail("This warehouse still holds stock. Transfer or adjust the stock before deleting it.")
    w.is_deleted = True; w.deleted_at = utcnow(); w.updated_at = utcnow(); w.save()
    log_audit(request, "Delete", "Warehouses", pk, f"Warehouse deleted: {w.name}", "warehouses")
    return ok(None, "Warehouse deleted successfully.")


@api_view(["GET"])
def warehouse_summary(request):
    return Response({"warehouses": Warehouses.objects.filter(is_deleted=False).count(),
                     "stockUnits": float(Stock.objects.filter(is_deleted=False).aggregate(t=Sum("quantity"))["t"] or 0),
                     "racks": Racks.objects.count(), "bins": Bins.objects.count()})


def _warehouse_products(wid):
    bs = {}
    for b in BinStock.objects.filter(warehouse_id=wid, quantity__gt=0):
        bs.setdefault(b.product_id, b)
    bins = {b.pk: b for b in Bins.objects.filter(warehouse_id=wid)}; racks = {r.pk: r for r in Racks.objects.filter(warehouse_id=wid)}
    rows = {}
    for s in Stock.objects.filter(warehouse_id=wid, quantity__gt=0, is_deleted=False): rows.setdefault(s.product_id, 0); rows[s.product_id] += float(s.quantity)
    names = {p.pk: p.name for p in Products.objects.filter(pk__in=rows.keys())}
    out = []
    for pid, q in rows.items():
        b = bs.get(pid); bin_ = bins.get(b.bin_id) if b else None; rack = racks.get(bin_.rack_id) if bin_ else None
        out.append({"productId": pid, "productName": names.get(pid), "rackCode": rack.rack_code if rack else "", "binCode": bin_.bin_code if bin_ else "", "quantity": q})
    return out


@api_view(["GET"])
def warehouse_details(request, pk):
    w = Warehouses.objects.filter(pk=pk, is_deleted=False).first()
    if not w: return fail("Warehouse not found", 404)
    prods = _warehouse_products(pk)
    return Response({"warehouseId": pk, "warehouseName": w.name, "totalRacks": Racks.objects.filter(warehouse_id=pk).count(),
                     "totalBins": Bins.objects.filter(warehouse_id=pk).count(), "totalProducts": len(prods),
                     "totalStockUnits": sum(p["quantity"] for p in prods), "products": prods})


@api_view(["GET"])
def warehouse_products(request, pk):
    return ok(_warehouse_products(pk))


# ------------------------------------------------------------------ racks & bins (generic CRUD with duplicate protection)
def _rack_extra(objs):
    wh = {w.pk: w.name for w in Warehouses.objects.filter(pk__in={o.warehouse_id for o in objs})}
    return {o.pk: {"warehouseName": wh.get(o.warehouse_id), "id": o.pk} for o in objs}


def _bin_extra(objs):
    wh = {w.pk: w.name for w in Warehouses.objects.filter(pk__in={o.warehouse_id for o in objs})}
    rk = {r.pk: r.rack_code for r in Racks.objects.filter(pk__in={o.rack_id for o in objs})}
    return {o.pk: {"warehouseName": wh.get(o.warehouse_id), "rackCode": rk.get(o.rack_id), "id": o.pk} for o in objs}


def _rack_validate(self, obj, data, is_new):
    if not obj.warehouse_id: raise ApiError("Warehouse is required.")
    if not (obj.rack_code or "").strip(): raise ApiError("Rack code is required.")
    obj.rack_code = obj.rack_code.strip().upper()
    if Racks.objects.filter(warehouse_id=obj.warehouse_id, rack_code__iexact=obj.rack_code).exclude(pk=obj.pk or 0).exists():
        raise ApiError("This rack code already exists in the selected warehouse.", 409)


def _bin_validate(self, obj, data, is_new):
    if not obj.warehouse_id or not obj.rack_id: raise ApiError("Warehouse and rack are required.")
    if not (obj.bin_code or "").strip(): raise ApiError("Bin code is required.")
    rack = Racks.objects.filter(pk=obj.rack_id).first()
    if not rack or rack.warehouse_id != obj.warehouse_id: raise ApiError("The selected rack does not belong to the selected warehouse.")
    obj.bin_code = obj.bin_code.strip().upper()
    if Bins.objects.filter(warehouse_id=obj.warehouse_id, bin_code__iexact=obj.bin_code).exclude(pk=obj.pk or 0).exists():
        raise ApiError("This bin code already exists in the selected warehouse.", 409)


def _bin_delete(self, request, obj):
    if BinStock.objects.filter(bin_id=obj.pk, quantity__gt=0).exists(): raise ApiError("This bin still contains stock and cannot be deleted.")


def _rack_delete(self, request, obj):
    if Bins.objects.filter(rack_id=obj.pk).exists(): raise ApiError("This rack has bins and cannot be deleted.")


RackList, RackDetail = make_crud(Racks, "Rack", module="Racks", order=["rack_code"], bulk_extra=staticmethod(_rack_extra), validate=_rack_validate, before_delete=_rack_delete)
BinList, BinDetail = make_crud(Bins, "Bin", module="Bins", order=["bin_code"], bulk_extra=staticmethod(_bin_extra), validate=_bin_validate, before_delete=_bin_delete)


@api_view(["POST"])
def stock_from_grn(request, grn_id):
    """Kept for API compatibility. In this backend stock is created the moment a goods receipt is saved,
    so this endpoint only confirms that (it never double-counts stock)."""
    from ..models import GoodsReceipts
    g = GoodsReceipts.objects.filter(pk=grn_id, is_deleted=False).first()
    if not g:
        return Response({"message": "GRN not found."}, status=404)
    if str(g.status).lower() in ("reversed", "cancelled"):
        return Response({"message": "A reversed goods receipt cannot create stock.", "currentStatus": g.status}, status=400)
    return Response({"message": "Stock for this goods receipt was already added when it was received.", "grnId": grn_id, "warehouseId": g.warehouse_id})
