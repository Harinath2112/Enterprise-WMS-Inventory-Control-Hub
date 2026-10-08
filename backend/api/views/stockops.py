"""Stock register, ledger, movements, adjustments, transfers, audits, put-away, bin stock & bin transfers."""
import math
from decimal import Decimal

from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit, notify
from ..core.crud import CrudBase, Detail, ListCreate, make_crud
from ..core.fieldtypes import utcnow
from ..core.inventory import adjust_stock, get_stock_row, sync_product_stock
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import (BinStock, BinTransferAudits, Bins, ProductVariants, Products, PutawayAudits, Racks, Stock, StockAdjustmentItems,
                      StockAdjustments, StockAuditItems, StockAudits, StockLedger, StockMovements, StockTransferItems, StockTransfers,
                      Warehouses, LocationMovements, Users)


def _lookup(model, ids, attr="name"):
    ids = {i for i in ids if i}
    return {o.pk: getattr(o, attr, None) for o in model.objects.filter(pk__in=ids)} if ids else {}


def _enrich(objs, with_variant=True):
    pn = _lookup(Products, [o.product_id for o in objs]); sk = _lookup(Products, [o.product_id for o in objs], "sku")
    wn = _lookup(Warehouses, [getattr(o, "warehouse_id", None) for o in objs]); vn = _lookup(ProductVariants, [getattr(o, "variant_id", None) for o in objs], "variant_name")
    return {o.pk: {"productName": pn.get(o.product_id), "sku": sk.get(o.product_id), "warehouseName": wn.get(getattr(o, "warehouse_id", None)),
                   "variantName": vn.get(getattr(o, "variant_id", None)), "id": o.pk} for o in objs}


def _paged_or_list(request, qs, rows_fn):
    qp = request.query_params
    if qp.get("page") and qp.get("paged") == "true":
        page = max(int(qp["page"]), 1); size = min(max(int(qp.get("pageSize", 100)), 1), 500); total = qs.count()
        return Response({"success": True, "page": page, "pageSize": size, "totalRecords": total, "totalPages": math.ceil(total / size) if total else 0,
                         "data": rows_fn(qs[(page - 1) * size: page * size])})
    return ok(rows_fn(qs))


# ------------------------------------------------------------------ stock register
class StockCrud(CrudBase):
    model = Stock; label = "Stock"

    def bulk_extra(self, objs): return _enrich(objs)


class StockList(StockCrud, ListCreate):
    def post(self, request):
        d = request.data; pid, wid = d.get("productId"), d.get("warehouseId")
        if not pid or not wid: raise ApiError("Product and warehouse are required.")
        qty = Decimal(str(d.get("quantity") or 0))
        if qty < 0: raise ApiError("Quantity cannot be negative.")
        with transaction.atomic():
            row = adjust_stock(int(pid), int(wid), qty, "Manual", variant_id=d.get("variantId") or None, ref_type="Stock", notes="Manual stock entry") if qty > 0 else get_stock_row(int(pid), d.get("variantId") or None, int(wid))
            if not row.pk: row.save()
        log_audit(request, "Create", "Stock", row.pk, f"Stock entry for product {pid} in warehouse {wid}", "stock")
        return ok(self.dump(row), "Stock saved successfully.", 201)


class StockDetail(StockCrud, Detail):
    def put(self, request, pk):
        row = self.get_obj(request, pk); target = Decimal(str(request.data.get("quantity", row.quantity)))
        if target < 0: raise ApiError("Quantity cannot be negative.")
        diff = target - row.quantity
        if diff != 0: adjust_stock(row.product_id, row.warehouse_id, diff, "Manual", variant_id=row.variant_id, ref_id=row.pk, ref_type="Stock", notes="Stock corrected")
        row.refresh_from_db(); log_audit(request, "Update", "Stock", pk, f"Stock quantity set to {target}", "stock")
        return ok(self.dump(row), "Stock updated successfully.")
    patch = put

    def delete(self, request, pk):
        row = self.get_obj(request, pk)
        if row.quantity > 0: adjust_stock(row.product_id, row.warehouse_id, -row.quantity, "Manual", variant_id=row.variant_id, ref_id=pk, ref_type="Stock", notes="Stock removed")
        Stock.objects.filter(pk=pk).update(is_deleted=True, updated_at=utcnow()); sync_product_stock(row.product_id)
        return ok(None, "Stock deleted successfully.")


class ReadOnlyEnriched(CrudBase):
    def bulk_extra(self, objs): return _enrich(objs)


def _readonly(model, label, order):
    cls = type(f"{model.__name__}List", (ReadOnlyEnriched, ListCreate), {"model": model, "label": label, "order": order})
    det = type(f"{model.__name__}Detail", (ReadOnlyEnriched, Detail), {"model": model, "label": label, "order": order})
    def _no(self, request, *a, **k): raise ApiError(f"{label} records are created automatically by stock transactions.", 405)
    for c in (cls, det):
        c.post = c.put = c.patch = c.delete = _no
    return cls, det


LedgerList, LedgerDetail = _readonly(StockLedger, "Stock ledger entry", ["-created_at", "-ledger_id"])
MovementList, MovementDetail = _readonly(StockMovements, "Stock movement", ["-created_at", "-movement_id"])


# ------------------------------------------------------------------ adjustments
def _adj_extra(objs):
    wn = _lookup(Warehouses, [o.warehouse_id for o in objs])
    cnt = {}
    for it in StockAdjustmentItems.objects.filter(adjustment_id__in=[o.pk for o in objs]): cnt[it.adjustment_id] = cnt.get(it.adjustment_id, 0) + 1
    return {o.pk: {"id": o.pk, "warehouseName": wn.get(o.warehouse_id), "itemCount": cnt.get(o.pk, 0)} for o in objs}


def _adj_validate(self, obj, data, is_new):
    if not obj.warehouse_id or not Warehouses.objects.filter(pk=obj.warehouse_id, is_deleted=False).exists(): raise ApiError("A valid warehouse is required.")
    if str(obj.adjustment_type or "").strip().lower() not in ("increase", "decrease", "adjustment_in", "adjustment_out"):
        raise ApiError("Adjustment type must be increase or decrease.")


AdjustmentList, AdjustmentDetail = make_crud(StockAdjustments, "Stock adjustment", module="Stock", order=["-created_at"], bulk_extra=staticmethod(_adj_extra), validate=_adj_validate)


class AdjItemCrud(CrudBase):
    model = StockAdjustmentItems; label = "Stock adjustment item"

    def bulk_extra(self, objs): return _enrich_items(objs)


def _enrich_items(objs):
    pn = _lookup(Products, [o.product_id for o in objs]); vn = _lookup(ProductVariants, [o.variant_id for o in objs], "variant_name")
    return {o.pk: {"id": o.pk, "productName": pn.get(o.product_id), "variantName": vn.get(o.variant_id)} for o in objs}


class AdjItemList(AdjItemCrud, ListCreate):
    def post(self, request):
        d = request.data; adj = StockAdjustments.objects.filter(pk=d.get("adjustmentId")).first()
        if not adj: raise ApiError("Invalid AdjustmentId")
        pid = d.get("productId"); qty = Decimal(str(d.get("quantity") or 0))
        if not Products.objects.filter(pk=pid, is_deleted=False).exists(): raise ApiError("Invalid ProductId")
        if qty <= 0: raise ApiError("Quantity must be greater than zero.")
        t = str(adj.adjustment_type or "").strip().lower(); inc = t in ("increase", "adjustment_in")
        vid = d.get("variantId") or None
        with transaction.atomic():
            item = StockAdjustmentItems.objects.create(adjustment_id=adj.pk, product_id=int(pid), variant_id=vid, quantity=qty)
            adjust_stock(int(pid), adj.warehouse_id, qty if inc else -qty, "AdjustmentIn" if inc else "AdjustmentOut", variant_id=vid, ref_id=adj.pk, ref_type="StockAdjustment", notes=adj.reason)
        log_audit(request, "Create", "Stock", item.pk, f"Stock adjustment {'+' if inc else '-'}{qty} for product {pid}", "stock_adjustment_items")
        return ok(self.dump(item), "Adjustment item added.", 201)


class AdjItemDetail(AdjItemCrud, Detail):
    def put(self, request, pk): raise ApiError("Adjustment items cannot be edited after stock was posted. Create a new adjustment instead.", 405)
    patch = put

    def delete(self, request, pk):
        item = self.get_obj(request, pk); adj = StockAdjustments.objects.filter(pk=item.adjustment_id).first()
        if adj:
            inc = str(adj.adjustment_type or "").lower() in ("increase", "adjustment_in")
            adjust_stock(item.product_id, adj.warehouse_id, -item.quantity if inc else item.quantity, "AdjustmentReversal", variant_id=item.variant_id, ref_id=adj.pk, ref_type="StockAdjustment", notes="Adjustment item removed")
        item.delete(); return ok(None, "Adjustment item deleted.")


# ------------------------------------------------------------------ transfers
def _tr_extra(objs):
    wn = _lookup(Warehouses, [o.from_warehouse_id for o in objs] + [o.to_warehouse_id for o in objs])
    items = {}
    for it in StockTransferItems.objects.filter(transfer_id__in=[o.pk for o in objs]): items.setdefault(it.transfer_id, []).append(it)
    pn = _lookup(Products, [i.product_id for l in items.values() for i in l])
    out = {}
    for o in objs:
        its = items.get(o.pk, []); first = its[0] if its else None
        out[o.pk] = {"id": o.pk, "fromWarehouseName": wn.get(o.from_warehouse_id), "toWarehouseName": wn.get(o.to_warehouse_id),
                     "items": [to_dict(i, extra={"productName": pn.get(i.product_id)}) for i in its],
                     "productId": first.product_id if first else None, "productName": pn.get(first.product_id) if first else None,
                     "variantId": first.variant_id if first else None, "quantity": float(sum(i.quantity for i in its))}
    return out


class TransferCrud(CrudBase):
    model = StockTransfers; label = "Stock transfer"; order = ["-transfer_date", "-transfer_id"]

    def bulk_extra(self, objs): return _tr_extra(objs)


class TransferList(TransferCrud, ListCreate):
    def post(self, request):
        d = request.data; pid, fw, tw = d.get("productId"), d.get("fromWarehouseId"), d.get("toWarehouseId")
        qty = Decimal(str(d.get("quantity") or 0)); vid = d.get("variantId") or None
        if not pid or not fw or not tw: raise ApiError("Product, source warehouse, and destination warehouse are required.")
        if int(fw) == int(tw): raise ApiError("Source and destination warehouses must be different.")
        if qty <= 0: raise ApiError("Quantity must be greater than zero.")
        if not Products.objects.filter(pk=pid, is_deleted=False).exists(): raise ApiError("Invalid product.")
        for w, label in ((fw, "Source"), (tw, "Destination")):
            if not Warehouses.objects.filter(pk=w, is_deleted=False).exists(): raise ApiError(f"{label} warehouse does not exist.")
        src = get_stock_row(int(pid), vid, int(fw), create=False)
        if not src: raise ApiError("Source warehouse stock not found.")
        if src.quantity < qty: raise ApiError(f"Insufficient stock in source warehouse. Available: {src.quantity}.")
        with transaction.atomic():
            tr = StockTransfers.objects.create(from_warehouse_id=int(fw), to_warehouse_id=int(tw), transfer_date=utcnow(), status="pending")
            item = StockTransferItems.objects.create(transfer_id=tr.pk, product_id=int(pid), variant_id=vid, quantity=qty)
            adjust_stock(int(pid), int(fw), -qty, "TransferOut", variant_id=vid, ref_id=tr.pk, ref_type="StockTransfer", notes="Warehouse transfer out")
            # bins in the source warehouse are depleted first so bin stock stays aligned with the register
            remaining = qty
            for bs in BinStock.objects.filter(product_id=int(pid), warehouse_id=int(fw), variant_id=vid, quantity__gt=0).order_by("bin_id"):
                if remaining <= 0: break
                take = min(bs.quantity, remaining); bs.quantity -= take; bs.save(); remaining -= take
            if tr.status.lower() in ("completed", "received"): pass
        log_audit(request, "Create", "Stock", tr.pk, f"Stock transfer #{tr.pk}: {qty} of product {pid} from warehouse {fw} to {tw}", "stock_transfers")
        return ok(self.dump(tr), "Stock transfer created successfully.", 201)


class TransferDetail(TransferCrud, Detail):
    def put(self, request, pk):
        tr = self.get_obj(request, pk); new = str(request.data.get("status") or tr.status).strip().lower()
        if new not in ("pending", "in transit", "completed", "received", "cancelled"): raise ApiError("Invalid transfer status.")
        old = str(tr.status or "").lower()
        if old in ("completed", "received", "cancelled") and new != old: raise ApiError(f"A {old} transfer cannot be changed.")
        with transaction.atomic():
            if new in ("completed", "received") and old not in ("completed", "received"):
                for it in StockTransferItems.objects.filter(transfer_id=pk):
                    adjust_stock(it.product_id, tr.to_warehouse_id, it.quantity, "TransferIn", variant_id=it.variant_id, ref_id=pk, ref_type="StockTransfer", notes="Warehouse transfer in")
            if new == "cancelled" and old != "cancelled":
                for it in StockTransferItems.objects.filter(transfer_id=pk):
                    adjust_stock(it.product_id, tr.from_warehouse_id, it.quantity, "TransferCancelled", variant_id=it.variant_id, ref_id=pk, ref_type="StockTransfer", notes="Transfer cancelled - stock returned")
            tr.status = new; tr.save()
        log_audit(request, "Update", "Stock", pk, f"Stock transfer #{pk} marked {new}", "stock_transfers")
        return ok(self.dump(tr), "Stock transfer updated successfully.")
    patch = put

    def delete(self, request, pk):
        tr = self.get_obj(request, pk)
        if str(tr.status).lower() == "pending": raise ApiError("Cancel the transfer first so the stock is returned to the source warehouse.")
        StockTransferItems.objects.filter(transfer_id=pk).delete(); tr.delete(); return ok(None, "Stock transfer deleted.")


TransferItemList, TransferItemDetail = make_crud(StockTransferItems, "Stock transfer item", module="Stock", order=["-id"], bulk_extra=staticmethod(_enrich_items))


# ------------------------------------------------------------------ audits
def _audit_extra(objs):
    wn = _lookup(Warehouses, [o.warehouse_id for o in objs]); cnt = {}
    for it in StockAuditItems.objects.filter(audit_id__in=[o.pk for o in objs]): cnt[it.audit_id] = cnt.get(it.audit_id, 0) + 1
    return {o.pk: {"id": o.pk, "warehouseName": wn.get(o.warehouse_id), "itemCount": cnt.get(o.pk, 0)} for o in objs}


def _audit_validate(self, obj, data, is_new):
    if not obj.warehouse_id or not Warehouses.objects.filter(pk=obj.warehouse_id, is_deleted=False).exists(): raise ApiError("A valid warehouse is required.")
    if str(obj.status or "Draft").title() not in ("Draft", "Pending", "Approved", "Posted", "Cancelled"):
        raise ApiError("Invalid Status. Allowed values: Draft, Pending, Approved, Posted, Cancelled.")
    obj.status = str(obj.status or "Draft").title()
    if is_new and not obj.audit_date: obj.audit_date = utcnow().date()


class AuditCrud(CrudBase):
    model = StockAudits; label = "Stock audit"; order = ["-audit_date", "-audit_id"]

    def bulk_extra(self, objs): return _audit_extra(objs)

    def validate(self, obj, data, is_new): _audit_validate(self, obj, data, is_new)

    def after_save(self, request, obj, data, is_new):
        if obj.status == "Posted" and not data.get("_skipPost"): self.post_variances(obj)

    def post_variances(self, audit):
        if getattr(audit, "_posted", False): return
        for it in StockAuditItems.objects.filter(audit_id=audit.pk):
            diff = it.difference or 0
            if diff:
                adjust_stock(it.product_id, audit.warehouse_id, diff, "AuditAdjustment", variant_id=it.variant_id, ref_id=audit.pk, ref_type="StockAudit", notes="Stock audit variance posted", allow_negative=False)
                bs = BinStock.objects.filter(product_id=it.product_id, variant_id=it.variant_id, warehouse_id=audit.warehouse_id, bin_id=it.bin_id).first()
                if bs: bs.quantity = it.physical_quantity; bs.save()


class AuditList(AuditCrud, ListCreate): pass


class AuditDetail(AuditCrud, Detail):
    def put(self, request, pk):
        before = self.get_obj(request, pk); was_posted = str(before.status).title() == "Posted"
        if was_posted: raise ApiError("A posted audit cannot be modified.")
        return super().put(request, pk)
    patch = put


class AuditItemCrud(CrudBase):
    model = StockAuditItems; label = "Stock audit item"

    def bulk_extra(self, objs): return _enrich_items(objs)

    def validate(self, obj, data, is_new):
        audit = StockAudits.objects.filter(pk=obj.audit_id).first()
        if not audit: raise ApiError("AuditId is required.")
        if str(audit.status).title() in ("Posted", "Cancelled"): raise ApiError("Items cannot be changed on a posted or cancelled audit.")
        if not obj.product_id or not Products.objects.filter(pk=obj.product_id).exists(): raise ApiError("ProductId is required.")
        if not obj.bin_id: raise ApiError("BinId is required.")
        b = Bins.objects.filter(pk=obj.bin_id).first()
        if not b: raise ApiError("Invalid BinId.")
        if b.warehouse_id != audit.warehouse_id: raise ApiError("Selected Bin does not belong to the Audit's warehouse.")
        if obj.physical_quantity is None: raise ApiError("PhysicalQuantity is required.")
        q = BinStock.objects.filter(warehouse_id=audit.warehouse_id, product_id=obj.product_id, bin_id=obj.bin_id)
        if obj.variant_id: q = q.filter(variant_id=obj.variant_id)
        existing = q.first()
        obj.system_quantity = existing.quantity if existing else (obj.system_quantity or 0)
        obj.difference = (obj.physical_quantity or 0) - obj.system_quantity


class AuditItemList(AuditItemCrud, ListCreate): pass
class AuditItemDetail(AuditItemCrud, Detail): pass


# ------------------------------------------------------------------ bins: stock, put-away, transfers
@api_view(["GET"])
def bin_stocks(request):
    qs = BinStock.objects.filter(quantity__gt=0) if request.query_params.get("includeZero") != "true" else BinStock.objects.all()
    for k, a in (("warehouseId", "warehouse_id"), ("binId", "bin_id"), ("productId", "product_id")):
        if request.query_params.get(k): qs = qs.filter(**{a: request.query_params[k]})
    rows = list(qs); pn = _lookup(Products, [r.product_id for r in rows]); sk = _lookup(Products, [r.product_id for r in rows], "sku")
    bn = {b.pk: b for b in Bins.objects.filter(pk__in={r.bin_id for r in rows})}; rn = _lookup(Racks, [b.rack_id for b in bn.values()], "rack_code")
    wn = _lookup(Warehouses, [r.warehouse_id for r in rows])
    return ok([to_dict(r, extra={"id": r.pk, "productName": pn.get(r.product_id), "sku": sk.get(r.product_id), "warehouseName": wn.get(r.warehouse_id),
                                 "binCode": bn[r.bin_id].bin_code if r.bin_id in bn else None, "rackCode": rn.get(bn[r.bin_id].rack_id) if r.bin_id in bn else None})
               for r in rows])


def _unallocated(pid, vid, wid):
    stock = Stock.objects.filter(product_id=pid, variant_id=vid, warehouse_id=wid, is_deleted=False).first()
    allocated = sum(b.quantity for b in BinStock.objects.filter(product_id=pid, variant_id=vid, warehouse_id=wid))
    return (stock.quantity if stock else Decimal("0")) - allocated


@api_view(["GET", "POST"])
def putaway(request):
    if request.method == "GET":
        rows = list(PutawayAudits.objects.order_by("-created_at")[:500]); pn = _lookup(Products, [r.product_id for r in rows])
        wn = _lookup(Warehouses, [r.warehouse_id for r in rows]); bn = _lookup(Bins, [r.bin_id for r in rows], "bin_code"); rn = _lookup(Racks, [r.rack_id for r in rows], "rack_code")
        return ok([to_dict(r, extra={"id": r.pk, "productName": pn.get(r.product_id), "warehouseName": wn.get(r.warehouse_id), "binCode": bn.get(r.bin_id), "rackCode": rn.get(r.rack_id)}) for r in rows])
    d = request.data; pid, wid, rid, bid = (d.get(k) for k in ("productId", "warehouseId", "rackId", "binId")); vid = d.get("variantId") or None
    qty = Decimal(str(d.get("quantity") or 0))
    if not all((pid, wid, rid, bid)): raise ApiError("Product, warehouse, rack and bin are required.")
    if qty <= 0: raise ApiError("Quantity must be greater than zero.")
    b = Bins.objects.filter(pk=bid).first()
    if not b or b.warehouse_id != int(wid) or b.rack_id != int(rid): raise ApiError("The selected bin does not belong to the selected rack and warehouse.")
    free = _unallocated(int(pid), vid, int(wid))
    if qty > free: raise ApiError(f"Only {free} unit(s) are waiting for put-away in this warehouse.")
    if b.capacity:
        used = sum(x.quantity for x in BinStock.objects.filter(bin_id=bid))
        if used + qty > b.capacity: raise ApiError(f"Bin capacity exceeded. Free space: {b.capacity - used}.")
    with transaction.atomic():
        bs = BinStock.objects.filter(product_id=pid, variant_id=vid, warehouse_id=wid, bin_id=bid).first() or BinStock(product_id=int(pid), variant_id=vid, warehouse_id=int(wid), bin_id=int(bid), quantity=0)
        bs.quantity += qty; bs.save()
        uid = request.user.id; PutawayAudits.objects.create(product_id=int(pid), variant_id=vid, warehouse_id=int(wid), rack_id=int(rid), bin_id=int(bid), quantity=qty, user_id=uid, user_name=request.user.name, created_at=utcnow())
        LocationMovements.objects.create(product_id=int(pid), variant_id=vid, warehouse_id=int(wid), from_bin_id=None, to_bin_id=int(bid), quantity=qty, movement_date=utcnow())
    log_audit(request, "Create", "Stock", bs.pk, f"Put-away {qty} of product {pid} into bin {b.bin_code}", "bin_stock")
    return ok(to_dict(bs, extra={"id": bs.pk}), "Stock put away successfully.", 201)


@api_view(["GET", "POST"])
def bin_transfers(request):
    if request.method == "GET":
        rows = list(BinTransferAudits.objects.order_by("-created_at")[:500]); pn = _lookup(Products, [r.product_id for r in rows])
        bn = _lookup(Bins, [r.from_bin_id for r in rows] + [r.to_bin_id for r in rows], "bin_code"); wn = _lookup(Warehouses, [r.warehouse_id for r in rows])
        return ok([to_dict(r, extra={"id": r.pk, "productName": pn.get(r.product_id), "warehouseName": wn.get(r.warehouse_id), "fromBinCode": bn.get(r.from_bin_id), "toBinCode": bn.get(r.to_bin_id)}) for r in rows])
    d = request.data; pid, fb, tb = d.get("productId"), d.get("fromBinId"), d.get("toBinId"); vid = d.get("variantId") or None; qty = Decimal(str(d.get("quantity") or 0))
    if not all((pid, fb, tb)): raise ApiError("Product, source bin and destination bin are required.")
    if int(fb) == int(tb): raise ApiError("Source and destination bins must be different.")
    if qty <= 0: raise ApiError("Quantity must be greater than zero.")
    fbin, tbin = Bins.objects.filter(pk=fb).first(), Bins.objects.filter(pk=tb).first()
    if not fbin or not tbin: raise ApiError("Invalid bin selected.")
    if fbin.warehouse_id != tbin.warehouse_id: raise ApiError("Bin transfers must stay within the same warehouse. Use a warehouse transfer instead.")
    src = BinStock.objects.filter(product_id=pid, variant_id=vid, bin_id=fb).first()
    if not src or src.quantity < qty: raise ApiError(f"Insufficient stock in the source bin. Available: {src.quantity if src else 0}.")
    if tbin.capacity and sum(x.quantity for x in BinStock.objects.filter(bin_id=tb)) + qty > tbin.capacity: raise ApiError("Destination bin capacity exceeded.")
    with transaction.atomic():
        src.quantity -= qty; src.save()
        dst = BinStock.objects.filter(product_id=pid, variant_id=vid, bin_id=tb).first() or BinStock(product_id=int(pid), variant_id=vid, warehouse_id=fbin.warehouse_id, bin_id=int(tb), quantity=0)
        dst.quantity += qty; dst.save()
        a = BinTransferAudits.objects.create(product_id=int(pid), variant_id=vid, warehouse_id=fbin.warehouse_id, from_bin_id=int(fb), to_bin_id=int(tb), quantity=qty, user_id=request.user.id, user_name=request.user.name, created_at=utcnow())
        LocationMovements.objects.create(product_id=int(pid), variant_id=vid, warehouse_id=fbin.warehouse_id, from_bin_id=int(fb), to_bin_id=int(tb), quantity=qty, movement_date=utcnow())
    return ok(to_dict(a, extra={"id": a.pk}), "Bin transfer completed successfully.", 201)
