"""Purchasing: purchase orders, goods receipts (GRN), purchase indents and purchase returns."""
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit, notify
from ..core.fieldtypes import utcnow
from ..core.inventory import adjust_stock
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import (GoodsReceiptItems, GoodsReceipts, ProductVariants, Products, PurchaseIndentItems, PurchaseIndents, PurchaseOrderItems,
                      PurchaseOrders, PurchaseReturnItems, PurchaseReturns, Suppliers, Units, Users, Warehouses)


def D(v, default=0):
    return Decimal(str(v if v not in (None, "") else default))


def dt(v, default=None):
    if not v: return default or utcnow()
    return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(v, str) else v


def names(model, ids, attr="name"):
    ids = {i for i in ids if i}
    return {o.pk: getattr(o, attr, None) for o in model.objects.filter(pk__in=ids)} if ids else {}


def iso(v): return v.isoformat() if v else None


def seq_number(prefix, model, attr):
    stamp = utcnow().strftime("%Y%m%d"); n = model.objects.count() + 1
    while model.objects.filter(**{attr: f"{prefix}-{stamp}-{n:04d}"}).exists(): n += 1
    return f"{prefix}-{stamp}-{n:04d}"


def lower(s): return str(s or "").strip().lower().replace(" ", "_")


# ================================================================== purchase orders
def po_rows(pos):
    pos = list(pos); ids = [p.pk for p in pos]
    items = {}
    for it in PurchaseOrderItems.objects.filter(po_id__in=ids).order_by("id"): items.setdefault(it.po_id, []).append(it)
    sup = names(Suppliers, [p.supplier_id for p in pos]); pn = names(Products, [i.product_id for l in items.values() for i in l])
    sk = names(Products, [i.product_id for l in items.values() for i in l], "sku")
    out = []
    for p in pos:
        its = items.get(p.pk, []); first = its[0] if its else None
        recv = sum(D(i.received_quantity) for i in its); qty = sum(D(i.quantity) for i in its)
        rs = p.receiving_status or ("received" if lower(p.status) == "received" else "partial" if lower(p.status) == "partially_received" else "pending")
        out.append({"id": p.pk, "poId": p.pk, "poNumber": p.po_number, "supplierId": p.supplier_id, "supplier": sup.get(p.supplier_id), "supplierName": sup.get(p.supplier_id),
                    "productId": first.product_id if first else None, "productName": pn.get(first.product_id) if first else None, "productSku": sk.get(first.product_id) if first else None,
                    "variantId": first.variant_id if first else None, "quantity": float(qty), "price": float(first.price) if first else None, "receivedQuantity": float(recv),
                    "orderDate": iso(p.order_date), "expectedDate": iso(p.expected_date), "status": p.status, "receivingStatus": rs, "paymentStatus": p.payment_status,
                    "totalAmount": float(p.total_amount or 0), "notes": p.notes, "isCancelled": bool(p.is_cancelled), "createdAt": iso(p.created_at),
                    "items": [to_dict(i, extra={"productName": pn.get(i.product_id), "sku": sk.get(i.product_id)}) for i in its]})
    return out


def _calc(qty, price, disc, tax):
    sub = qty * price; taxable = sub - sub * disc / 100; return taxable + taxable * tax / 100


@api_view(["GET", "POST"])
def purchase_orders(request):
    if request.method == "GET":
        return ok(po_rows(PurchaseOrders.objects.filter(is_cancelled=False, is_deleted=False).order_by("-po_id")))
    d = request.data
    lines = d.get("items") if isinstance(d.get("items"), list) and d["items"] else [d]
    if not d.get("supplierId") or not Suppliers.objects.filter(pk=d["supplierId"], is_deleted=False).exists(): raise ApiError("Selected supplier was not found.")
    clean = []
    for l in lines:
        pid, qty, price = l.get("productId"), D(l.get("quantity")), D(l.get("price"))
        if not pid or qty <= 0 or price < 0: raise ApiError("Supplier, product, quantity greater than zero, and non-negative price are required.")
        if not Products.objects.filter(pk=pid, is_deleted=False).exists(): raise ApiError("Selected supplier or product was not found.")
        clean.append((int(pid), l.get("variantId") or None, qty, price, D(l.get("discount")), D(l.get("tax"))))
    with transaction.atomic():
        total = sum(_calc(q, p, di, t) for _, _, q, p, di, t in clean)
        po = PurchaseOrders.objects.create(supplier_id=int(d["supplierId"]), po_number="PO-" + str(int(utcnow().timestamp() * 1000)), order_date=dt(d.get("orderDate")),
                                           expected_date=dt(d.get("expectedDate")) if d.get("expectedDate") else None, status="pending", receiving_status="pending",
                                           total_amount=total, notes=(d.get("notes") or "").strip() or None, created_at=utcnow(), updated_at=utcnow(), is_cancelled=False, is_deleted=False)
        for pid, vid, q, p, di, t in clean:
            PurchaseOrderItems.objects.create(po_id=po.pk, product_id=pid, variant_id=vid, quantity=q, received_quantity=0, price=p, total=_calc(q, p, di, t), discount=di, tax=t)
    log_audit(request, "CREATE_PURCHASE_ORDER", "Purchases", po.pk, f"Purchase Order {po.po_number} created", "purchase_orders")
    return ok({"poId": po.pk, "poNumber": po.po_number}, "Purchase order created successfully.")


def _po_or_404(pk):
    po = PurchaseOrders.objects.filter(pk=pk, is_deleted=False).first()
    if not po: raise ApiError("Purchase order not found.", 404)
    return po


def _has_receipts(pk): return GoodsReceipts.objects.filter(po_id=pk, is_cancelled=False, is_deleted=False).exists()


@api_view(["GET", "PUT", "DELETE"])
def purchase_order_detail(request, pk):
    po = _po_or_404(pk)
    if request.method == "GET": return ok(po_rows([po])[0])
    if request.method == "DELETE":
        if _has_receipts(pk) or lower(po.status) in ("received", "partially_received"): raise ApiError("This purchase order has goods receipts and cannot be deleted.")
        po.is_deleted = True; po.updated_at = utcnow(); po.save(); log_audit(request, "DELETE_PURCHASE_ORDER", "Purchases", pk, f"Purchase Order {po.po_number} deleted", "purchase_orders")
        return ok(None, "Purchase order deleted successfully.")
    if _has_receipts(pk) or lower(po.status) in ("received", "partially_received") or lower(po.receiving_status) in ("received", "partial"):
        raise ApiError("Purchase orders with received goods cannot be edited.")
    if lower(po.status) == "cancelled": raise ApiError("A cancelled purchase order cannot be edited.")
    d = request.data
    with transaction.atomic():
        if d.get("supplierId"): po.supplier_id = int(d["supplierId"])
        if d.get("orderDate"): po.order_date = dt(d["orderDate"])
        if "expectedDate" in d: po.expected_date = dt(d["expectedDate"]) if d.get("expectedDate") else None
        if "notes" in d: po.notes = (d.get("notes") or "").strip() or None
        lines = d.get("items") if isinstance(d.get("items"), list) and d["items"] else ([d] if d.get("productId") else None)
        if lines:
            PurchaseOrderItems.objects.filter(po_id=pk).delete(); total = Decimal(0)
            for l in lines:
                q, pr, di, t = D(l.get("quantity")), D(l.get("price")), D(l.get("discount")), D(l.get("tax"))
                if q <= 0 or pr < 0: raise ApiError("Quantity must be greater than zero and price cannot be negative.")
                PurchaseOrderItems.objects.create(po_id=pk, product_id=int(l["productId"]), variant_id=l.get("variantId") or None, quantity=q, received_quantity=0, price=pr, total=_calc(q, pr, di, t), discount=di, tax=t)
                total += _calc(q, pr, di, t)
            po.total_amount = total
        po.updated_at = utcnow(); po.save()
    log_audit(request, "UPDATE_PURCHASE_ORDER", "Purchases", pk, f"Purchase Order {po.po_number} updated", "purchase_orders")
    return ok(po_rows([po])[0], "Purchase order updated successfully.")


@api_view(["POST"])
def purchase_order_approve(request, pk):
    po = _po_or_404(pk)
    if lower(po.status) == "approved": raise ApiError("This purchase order is already approved.")
    if lower(po.status) == "cancelled": raise ApiError("A cancelled purchase order cannot be approved.")
    po.status = "approved"; po.receiving_status = "pending"; po.updated_at = utcnow(); po.save()
    log_audit(request, "APPROVE_PURCHASE_ORDER", "Purchases", pk, f"Purchase Order {po.po_number} approved", "purchase_orders")
    return ok(po_rows([po])[0], "Purchase order approved successfully.")


@api_view(["POST"])
def purchase_order_cancel(request, pk):
    po = _po_or_404(pk)
    if lower(po.status) == "cancelled": raise ApiError("This purchase order is already cancelled.")
    if _has_receipts(pk) or lower(po.status) in ("received", "partially_received"): raise ApiError("Purchase orders with received goods cannot be cancelled.")
    po.status = "cancelled"; po.receiving_status = "pending"; po.is_cancelled = True; po.cancelled_at = utcnow()
    po.cancellation_reason = str(request.data.get("reason") or request.data.get("cancellationReason") or "Cancelled by user")[:500]; po.updated_at = utcnow(); po.save()
    log_audit(request, "CANCEL_PURCHASE_ORDER", "Purchases", pk, f"Purchase Order {po.po_number} cancelled", "purchase_orders")
    return ok(None, "Purchase order cancelled successfully.")


# ================================================================== goods receipts
def _refresh_po_status(po_id):
    po = PurchaseOrders.objects.filter(pk=po_id).first()
    if not po or lower(po.status) == "cancelled": return
    items = list(PurchaseOrderItems.objects.filter(po_id=po_id)); ordered = sum(D(i.quantity) for i in items); got = sum(D(i.received_quantity) for i in items)
    if got <= 0: po.status, po.receiving_status = "Ordered", "Ordered"
    elif got < ordered: po.status, po.receiving_status = "Partially Received", "Partially Received"
    else: po.status, po.receiving_status = "Received", "Received"
    po.updated_at = utcnow(); po.save()


def grn_rows(grns, with_items=False):
    grns = list(grns); ids = [g.pk for g in grns]
    items = {}
    for it in GoodsReceiptItems.objects.filter(grn_id__in=ids): items.setdefault(it.grn_id, []).append(it)
    sup = names(Suppliers, [g.supplier_id for g in grns]); wh = names(Warehouses, [g.warehouse_id for g in grns]); po = names(PurchaseOrders, [g.po_id for g in grns], "po_number")
    pn = names(Products, [i.product_id for l in items.values() for i in l]); sk = names(Products, [i.product_id for l in items.values() for i in l], "sku")
    ordered = {(i.po_id, i.product_id): i.quantity for i in PurchaseOrderItems.objects.filter(po_id__in={g.po_id for g in grns})}
    out = []
    for g in grns:
        its = items.get(g.pk, [])
        row = {"id": g.pk, "grnId": g.pk, "grnNumber": g.grn_number or f"GRN-{g.pk}", "poId": g.po_id, "poNumber": po.get(g.po_id), "supplierId": g.supplier_id, "supplierName": sup.get(g.supplier_id),
               "warehouseId": g.warehouse_id, "warehouseName": wh.get(g.warehouse_id), "receiptDate": iso(g.receipt_date), "status": g.status, "notes": g.notes,
               "supplierInvoice": g.supplier_invoice, "supplierInvoiceDate": iso(g.supplier_invoice_date), "isCancelled": bool(g.is_cancelled), "createdAt": iso(g.created_at),
               "totalAmount": float(sum(D(i.line_total) for i in its)), "totalQuantity": float(sum(D(i.quantity_received) for i in its)), "itemCount": len(its)}
        if with_items or True:
            row["items"] = [to_dict(i, extra={"productName": pn.get(i.product_id), "productSku": sk.get(i.product_id), "sku": sk.get(i.product_id), "unitPrice": float(i.price or 0),
                                              "orderedQuantity": float(ordered.get((g.po_id, i.product_id), 0)), "orderedQty": float(ordered.get((g.po_id, i.product_id), 0))}) for i in its]
        out.append(row)
    return out


@api_view(["GET", "POST"])
def goods_receipts(request):
    if request.method == "GET":
        return ok(grn_rows(GoodsReceipts.objects.filter(is_deleted=False).order_by("-grn_id")))
    d = request.data
    po = PurchaseOrders.objects.filter(pk=d.get("poId"), is_deleted=False).first()
    if not po: raise ApiError("Purchase order not found.")
    if lower(po.status) in ("pending", "cancelled", "draft"): raise ApiError("The purchase order must be approved before goods can be received.")
    wid = d.get("warehouseId")
    if not wid or not Warehouses.objects.filter(pk=wid, is_deleted=False).exists(): raise ApiError("A valid warehouse is required.")
    items = d.get("items") or []
    if not items: raise ApiError("At least one item is required.")
    po_items = {(i.product_id, i.variant_id): i for i in PurchaseOrderItems.objects.filter(po_id=po.pk)}
    lines = []
    for it in items:
        pid = int(it.get("productId") or 0); vid = it.get("variantId") or None; qty = D(it.get("quantityReceived", it.get("quantity")))
        if qty <= 0: continue
        poi = po_items.get((pid, vid)) or next((v for (p, _), v in po_items.items() if p == pid), None)
        if not poi: raise ApiError("A received product is not part of this purchase order.")
        if D(poi.received_quantity) + qty > D(poi.quantity): raise ApiError(f"Received quantity exceeds the remaining order quantity. Remaining: {D(poi.quantity) - D(poi.received_quantity)}.")
        price = D(it.get("price", it.get("unitPrice", poi.price))); disc = D(it.get("discount")); taxp = D(it.get("taxPercentage", it.get("tax")))
        taxable = qty * price * (1 - disc / 100); tax_amt = taxable * taxp / 100
        lines.append((poi, pid, poi.variant_id, qty, price, disc, taxp, taxable, tax_amt))
    if not lines: raise ApiError("Enter a received quantity greater than zero for at least one item.")
    with transaction.atomic():
        g = GoodsReceipts.objects.create(po_id=po.pk, supplier_id=po.supplier_id, warehouse_id=int(wid), receipt_date=dt(d.get("receiptDate")), status="completed",
                                         notes=(d.get("notes") or "").strip() or None, is_cancelled=False, is_deleted=False, created_at=utcnow(), updated_at=utcnow(),
                                         grn_number=seq_number("GRN", GoodsReceipts, "grn_number"), supplier_invoice=(d.get("supplierInvoice") or "").strip() or None,
                                         supplier_invoice_date=dt(d.get("supplierInvoiceDate")) if d.get("supplierInvoiceDate") else None)
        for poi, pid, vid, qty, price, disc, taxp, taxable, tax_amt in lines:
            GoodsReceiptItems.objects.create(grn_id=g.pk, product_id=pid, variant_id=vid, quantity_received=qty, price=price, discount=disc, line_total=taxable + tax_amt,
                                             tax=taxp, tax_percentage=taxp, taxable_amount=taxable, tax_amount=tax_amt)
            adjust_stock(pid, int(wid), qty, "PurchaseReceipt", variant_id=vid, ref_id=g.pk, ref_type="GoodsReceipt", notes=f"Stock added from goods receipt {g.grn_number}")
            poi.received_quantity = D(poi.received_quantity) + qty; poi.save()
        _refresh_po_status(po.pk)
    log_audit(request, "GOODS_RECEIPT_CREATED", "Inventory", g.pk, f"Goods receipt {g.grn_number} created for {po.po_number}", "goods_receipts")
    return ok(grn_rows([g])[0], "Goods receipt created successfully.", 201)


@api_view(["GET", "DELETE"])
def goods_receipt_detail(request, pk):
    g = GoodsReceipts.objects.filter(pk=pk, is_deleted=False).first()
    if not g: raise ApiError("Goods receipt not found.", 404)
    if request.method == "GET": return ok(grn_rows([g])[0])
    if lower(g.status) not in ("reversed", "cancelled"): raise ApiError("Reverse the goods receipt before deleting it so stock stays correct.")
    g.is_deleted = True; g.updated_at = utcnow(); g.save(); log_audit(request, "GOODS_RECEIPT_DELETED", "Inventory", pk, f"Goods receipt {g.grn_number} deleted", "goods_receipts")
    return ok(None, "Goods receipt deleted successfully.")


@api_view(["POST"])
def goods_receipt_reverse(request, pk):
    g = GoodsReceipts.objects.filter(pk=pk, is_deleted=False).first()
    if not g: raise ApiError("Goods receipt not found.", 404)
    if lower(g.status) in ("reversed", "cancelled"): raise ApiError("This goods receipt is already reversed.")
    if PurchaseReturns.objects.filter(grn_id=pk).exclude(status__in=["Rejected", "Draft"]).exists(): raise ApiError("This goods receipt has purchase returns and cannot be reversed.")
    with transaction.atomic():
        for it in GoodsReceiptItems.objects.filter(grn_id=pk):
            adjust_stock(it.product_id, g.warehouse_id, -D(it.quantity_received), "GRNReversal", variant_id=it.variant_id, ref_id=pk, ref_type="GoodsReceipt", notes=f"Goods receipt {g.grn_number} reversed")
            poi = PurchaseOrderItems.objects.filter(po_id=g.po_id, product_id=it.product_id).first()
            if poi: poi.received_quantity = max(D(poi.received_quantity) - D(it.quantity_received), Decimal(0)); poi.save()
        g.status = "reversed"; g.is_cancelled = True; g.cancelled_at = utcnow(); g.cancellation_reason = str(request.data.get("reason") or "Reversed by user")[:500]; g.updated_at = utcnow(); g.save()
        _refresh_po_status(g.po_id)
    log_audit(request, "GOODS_RECEIPT_REVERSED", "Inventory", pk, f"Goods receipt {g.grn_number} reversed", "goods_receipts")
    return ok(grn_rows([g])[0], "Goods receipt reversed successfully.")


@api_view(["GET"])
def goods_receipts_by_po(request, po_id):
    return ok(grn_rows(GoodsReceipts.objects.filter(po_id=po_id, is_deleted=False, is_cancelled=False).order_by("-grn_id")))


def _returnable(grn_id):
    rows = []; returned = {}
    for r in PurchaseReturnItems.objects.filter(purchase_return_id__in=PurchaseReturns.objects.filter(grn_id=grn_id).exclude(status="Rejected").values("purchase_return_id")):
        returned[(r.product_id, r.variant_id)] = returned.get((r.product_id, r.variant_id), Decimal(0)) + D(r.return_quantity)
    its = list(GoodsReceiptItems.objects.filter(grn_id=grn_id)); pn = names(Products, [i.product_id for i in its]); sk = names(Products, [i.product_id for i in its], "sku")
    for i in its:
        done = returned.get((i.product_id, i.variant_id), Decimal(0)); avail = D(i.quantity_received) - done
        rows.append({"productId": i.product_id, "productName": pn.get(i.product_id), "sku": sk.get(i.product_id), "variantId": i.variant_id, "receivedQuantity": float(i.quantity_received),
                     "returnedQuantity": float(done), "availableQuantity": float(avail), "returnableQuantity": float(avail), "price": float(i.price or 0), "unitPrice": float(i.price or 0)})
    return rows


@api_view(["GET"])
def goods_receipt_return_items(request, grn_id):
    return ok(_returnable(grn_id))


# ================================================================== purchase indents
def indent_rows(rows):
    rows = list(rows); ids = [r.pk for r in rows]; items = {}
    for it in PurchaseIndentItems.objects.filter(purchase_indent_id__in=ids): items.setdefault(it.purchase_indent_id, []).append(it)
    pn = names(Products, [i.product_id for l in items.values() for i in l]); sk = names(Products, [i.product_id for l in items.values() for i in l], "sku")
    un = names(Units, [i.unit_id for l in items.values() for i in l]); usr = names(Users, [r.requested_by for r in rows] + [r.approved_by for r in rows]); sup = names(Suppliers, [r.supplier_id for r in rows])
    out = []
    for r in rows:
        out.append(to_dict(r, extra={"id": r.pk, "requestedByName": usr.get(r.requested_by), "approvedByName": usr.get(r.approved_by), "supplierName": sup.get(r.supplier_id),
                                     "items": [to_dict(i, extra={"id": i.pk, "productName": pn.get(i.product_id), "sku": sk.get(i.product_id), "unitName": un.get(i.unit_id)}) for i in items.get(r.pk, [])]}))
    return out


def _indent_items(ind, items):
    PurchaseIndentItems.objects.filter(purchase_indent_id=ind.pk).delete(); tq = Decimal(0)
    for it in items or []:
        q = D(it.get("requiredQty"))
        if q <= 0 or not it.get("productId"): raise ApiError("Each item needs a product and a quantity greater than zero.")
        PurchaseIndentItems.objects.create(purchase_indent_id=ind.pk, product_id=int(it["productId"]), required_qty=q, unit_id=int(it.get("unitId") or Products.objects.get(pk=it["productId"]).unit_id or 1),
                                           available_stock=D(it.get("availableStock")), required_date=dt(it.get("requiredDate")) if it.get("requiredDate") else ind.required_date, remarks=it.get("remarks"))
        tq += q
    ind.total_items = len(items or []); ind.total_quantity = tq; ind.save()


@api_view(["GET", "POST"])
def purchase_indents(request):
    if request.method == "GET":
        q = PurchaseIndents.objects.filter(is_deleted=False)
        if request.query_params.get("status"): q = q.filter(status__iexact=request.query_params["status"])
        return ok(indent_rows(q.order_by("-purchase_indent_id")))
    d = request.data
    if not d.get("items"): raise ApiError("At least one item is required.")
    with transaction.atomic():
        n = PurchaseIndents.objects.count() + 1
        while PurchaseIndents.objects.filter(indent_number=f"PI-{utcnow().year}-{n:04d}").exists(): n += 1
        ind = PurchaseIndents.objects.create(indent_number=f"PI-{utcnow().year}-{n:04d}", indent_date=dt(d.get("indentDate")), required_date=dt(d.get("requiredDate")),
                                             requested_by=int(d.get("requestedBy") or request.user.id), department_id=int(d.get("departmentId") or 0), supplier_id=d.get("supplierId") or None,
                                             priority=d.get("priority") or "Medium", status="Pending", remarks=d.get("remarks"), total_items=0, total_quantity=0, created_at=utcnow(), updated_at=utcnow(), is_deleted=False)
        _indent_items(ind, d["items"])
    log_audit(request, "CREATE_PURCHASE_INDENT", "Purchases", ind.pk, f"Purchase indent {ind.indent_number} created", "purchase_indents")
    return ok(indent_rows([ind])[0], "Purchase indent created successfully.", 201)


def _indent(pk):
    i = PurchaseIndents.objects.filter(pk=pk, is_deleted=False).first()
    if not i: raise ApiError("Purchase Indent not found.", 404)
    return i


@api_view(["GET", "PUT", "DELETE"])
def purchase_indent_detail(request, pk):
    ind = _indent(pk)
    if request.method == "GET": return ok(indent_rows([ind])[0])
    if lower(ind.status) in ("approved", "converted"): raise ApiError("Approved or converted indents cannot be changed.")
    if request.method == "DELETE":
        ind.is_deleted = True; ind.deleted_at = utcnow(); ind.save(); return ok(None, "Purchase indent deleted successfully.")
    d = request.data
    with transaction.atomic():
        for k, a in (("requiredDate", "required_date"), ("indentDate", "indent_date")):
            if d.get(k): setattr(ind, a, dt(d[k]))
        for k, a in (("priority", "priority"), ("remarks", "remarks"), ("supplierId", "supplier_id")):
            if k in d: setattr(ind, a, d[k] or None)
        ind.updated_at = utcnow()
        if d.get("items"): _indent_items(ind, d["items"])
        else: ind.save()
    return ok(indent_rows([ind])[0], "Purchase indent updated successfully.")


@api_view(["PUT", "POST"])
def purchase_indent_approve(request, pk):
    ind = _indent(pk)
    if lower(ind.status) != "pending": raise ApiError("Only pending indents can be approved.")
    ind.status = "Approved"; ind.approved_by = request.user.id; ind.updated_at = utcnow(); ind.save()
    log_audit(request, "APPROVE_PURCHASE_INDENT", "Purchases", pk, f"Purchase indent {ind.indent_number} approved", "purchase_indents")
    return ok(indent_rows([ind])[0], "Purchase indent approved.")


@api_view(["PUT", "POST"])
def purchase_indent_reject(request, pk):
    ind = _indent(pk)
    if lower(ind.status) != "pending": raise ApiError("Only pending indents can be rejected.")
    ind.status = "Rejected"; ind.remarks = (f"{ind.remarks or ''} | Rejected: {request.data.get('reason') or ''}").strip(" |"); ind.updated_at = utcnow(); ind.save()
    return ok(indent_rows([ind])[0], "Purchase indent rejected.")


@api_view(["POST"])
def purchase_indent_convert(request, pk):
    ind = _indent(pk)
    if lower(ind.status) == "converted": raise ApiError("Purchase Indent has already been converted to a Purchase Order.")
    if lower(ind.status) != "approved": raise ApiError("Only approved Purchase Indents can be converted.")
    if not ind.supplier_id: raise ApiError("Select a supplier on the indent before converting it.")
    its = list(PurchaseIndentItems.objects.filter(purchase_indent_id=pk))
    with transaction.atomic():
        prods = {p.pk: p for p in Products.objects.filter(pk__in=[i.product_id for i in its])}
        total = sum(D(i.required_qty) * D(prods[i.product_id].cost_price) for i in its)
        po = PurchaseOrders.objects.create(supplier_id=ind.supplier_id, po_number="PO-" + str(int(utcnow().timestamp() * 1000)), order_date=utcnow(), expected_date=ind.required_date, status="pending",
                                           receiving_status="pending", total_amount=total, notes=f"Created from Purchase Indent {ind.indent_number}", created_at=utcnow(), updated_at=utcnow(), is_cancelled=False, is_deleted=False)
        for i in its:
            pr = D(prods[i.product_id].cost_price); PurchaseOrderItems.objects.create(po_id=po.pk, product_id=i.product_id, quantity=i.required_qty, received_quantity=0, price=pr, total=D(i.required_qty) * pr, discount=0, tax=0)
        ind.status = "Converted"; ind.updated_at = utcnow(); ind.save()
    log_audit(request, "CONVERT_PURCHASE_INDENT", "Purchases", pk, f"Indent {ind.indent_number} converted to {po.po_number}", "purchase_indents")
    return ok({"poId": po.pk, "poNumber": po.po_number}, "Purchase indent converted to purchase order.")


@api_view(["GET"])
def purchase_indents_dashboard(request):
    q = PurchaseIndents.objects.filter(is_deleted=False)
    return ok({"total": q.count(), "pending": q.filter(status="Pending").count(), "approved": q.filter(status="Approved").count(), "rejected": q.filter(status="Rejected").count(),
               "converted": q.filter(status="Converted").count()})


# ================================================================== purchase returns
def return_rows(rows):
    rows = list(rows); ids = [r.pk for r in rows]; items = {}
    for it in PurchaseReturnItems.objects.filter(purchase_return_id__in=ids): items.setdefault(it.purchase_return_id, []).append(it)
    sup = names(Suppliers, [r.supplier_id for r in rows]); sc = names(Suppliers, [r.supplier_id for r in rows], "supplier_code"); gn = names(GoodsReceipts, [r.grn_id for r in rows], "grn_number")
    gd = {g.pk: g.receipt_date for g in GoodsReceipts.objects.filter(pk__in={r.grn_id for r in rows})}
    pn = names(Products, [i.product_id for l in items.values() for i in l]); sk = names(Products, [i.product_id for l in items.values() for i in l], "sku")
    out = []
    for r in rows:
        its = items.get(r.pk, []); st = r.status or "Draft"
        out.append({"returnId": r.pk, "id": r.pk, "returnNumber": r.return_number, "supplierId": r.supplier_id, "supplierName": sup.get(r.supplier_id), "supplierCode": sc.get(r.supplier_id),
                    "grnId": r.grn_id, "grnNumber": gn.get(r.grn_id), "grnDate": iso(gd.get(r.grn_id)), "returnDate": iso(r.return_date), "totalAmount": float(r.total_return_amount or 0),
                    "totalReturnAmount": float(r.total_return_amount or 0), "grandTotal": float(r.total_return_amount or 0), "reason": r.reason, "status": st, "createdAt": iso(r.created_at), "updatedAt": iso(r.updated_at),
                    "itemCount": len(its), "totalQuantity": float(sum(D(i.return_quantity) for i in its)),
                    "items": [{"id": i.pk, "returnId": r.pk, "productId": i.product_id, "productName": pn.get(i.product_id), "sku": sk.get(i.product_id), "variantId": i.variant_id,
                               "quantity": float(i.return_quantity or 0), "returnQuantity": float(i.return_quantity or 0), "receivedQuantity": float(i.received_quantity or 0),
                               "price": float(i.price or 0), "unitPrice": float(i.price or 0), "lineTotal": float(i.total or 0)} for i in its]})
    return out


@api_view(["GET", "POST"])
def purchase_returns(request):
    if request.method == "GET":
        q = PurchaseReturns.objects.order_by("-purchase_return_id")
        if request.query_params.get("status"): q = q.filter(status__iexact=request.query_params["status"])
        return ok(return_rows(q))
    d = request.data; g = GoodsReceipts.objects.filter(pk=d.get("grnId"), is_deleted=False).first()
    if not g: raise ApiError("Goods receipt not found.")
    if lower(g.status) in ("reversed", "cancelled"): raise ApiError("Returns cannot be created against a reversed goods receipt.")
    if not (d.get("reason") or "").strip(): raise ApiError("A return reason is required.")
    avail = {(r["productId"], r["variantId"]): r for r in _returnable(g.pk)}; lines = []
    for it in d.get("items") or []:
        q = D(it.get("quantity", it.get("returnQuantity")))
        if q <= 0: continue
        a = avail.get((int(it["productId"]), it.get("variantId") or None))
        if not a: raise ApiError("A product in the return is not part of the selected goods receipt.")
        if q > D(a["availableQuantity"]): raise ApiError(f"Return quantity exceeds the returnable quantity ({a['availableQuantity']}) for {a['productName']}.")
        lines.append((int(it["productId"]), it.get("variantId") or None, D(a["receivedQuantity"]), q, D(it.get("price", a["price"]))))
    if not lines: raise ApiError("Enter a return quantity for at least one item.")
    with transaction.atomic():
        total = sum(q * p for _, _, _, q, p in lines)
        r = PurchaseReturns.objects.create(return_number=seq_number("PRN", PurchaseReturns, "return_number"), supplier_id=g.supplier_id, grn_id=g.pk, return_date=dt(d.get("returnDate")),
                                           reason=d["reason"].strip(), total_return_amount=total, status="Pending" if d.get("submitForApproval") else "Draft", created_at=utcnow(), updated_at=utcnow())
        for pid, vid, rec, q, p in lines: PurchaseReturnItems.objects.create(purchase_return_id=r.pk, product_id=pid, variant_id=vid, received_quantity=rec, return_quantity=q, price=p, total=q * p, created_at=utcnow())
    log_audit(request, "PURCHASE_RETURN_CREATED", "Purchases", r.pk, f"Purchase return {r.return_number} created", "purchase_returns")
    return ok(return_rows([r])[0], "Purchase return created successfully.", 201)


def _pr(pk):
    r = PurchaseReturns.objects.filter(pk=pk).first()
    if not r: raise ApiError("Purchase return not found.", 404)
    return r


def _transition(request, pk, allowed, new, action, msg_):
    r = _pr(pk)
    if (r.status or "Draft") not in allowed: raise ApiError(f"Only {' / '.join(allowed)} returns can be {action}.")
    return r, new


@api_view(["GET", "DELETE"])
def purchase_return_detail(request, pk):
    r = _pr(pk)
    if request.method == "GET": return ok(return_rows([r])[0])
    if r.status not in ("Draft", "Rejected"): raise ApiError("Only draft or rejected returns can be deleted.")
    PurchaseReturnItems.objects.filter(purchase_return_id=pk).delete(); r.delete(); return ok(None, "Purchase return deleted successfully.")


@api_view(["POST"])
def purchase_return_submit(request, pk):
    r, new = _transition(request, pk, ("Draft",), "Pending", "submitted", ""); r.status = new; r.updated_at = utcnow(); r.save(); return ok(return_rows([r])[0], "Purchase return submitted for approval.")


@api_view(["POST"])
def purchase_return_approve(request, pk):
    r, new = _transition(request, pk, ("Pending",), "Approved", "approved", ""); r.status = new; r.updated_at = utcnow(); r.save()
    log_audit(request, "PURCHASE_RETURN_APPROVED", "Purchases", pk, f"Purchase return {r.return_number} approved", "purchase_returns"); return ok(return_rows([r])[0], "Purchase return approved.")


@api_view(["POST"])
def purchase_return_reject(request, pk):
    r, new = _transition(request, pk, ("Pending",), "Rejected", "rejected", ""); r.status = new; r.reason = f"{r.reason or ''} | Rejected: {request.data.get('reason') or ''}"[:500]; r.updated_at = utcnow(); r.save()
    return ok(return_rows([r])[0], "Purchase return rejected.")


@api_view(["POST"])
def purchase_return_complete(request, pk):
    r, new = _transition(request, pk, ("Approved",), "Completed", "completed", "")
    g = GoodsReceipts.objects.filter(pk=r.grn_id).first()
    with transaction.atomic():
        for it in PurchaseReturnItems.objects.filter(purchase_return_id=pk):
            adjust_stock(it.product_id, g.warehouse_id, -D(it.return_quantity), "PurchaseReturn", variant_id=it.variant_id, ref_id=pk, ref_type="PurchaseReturn", notes=f"Returned to supplier ({r.return_number})")
        r.status = new; r.updated_at = utcnow(); r.save()
    log_audit(request, "PURCHASE_RETURN_COMPLETED", "Purchases", pk, f"Purchase return {r.return_number} completed; stock reduced", "purchase_returns")
    return ok(return_rows([r])[0], "Purchase return completed and stock updated.")


@api_view(["GET"])
def purchase_return_suppliers(request):
    ids = set(GoodsReceipts.objects.filter(is_deleted=False, is_cancelled=False).values_list("supplier_id", flat=True))
    return ok([{"supplierId": s.pk, "id": s.pk, "name": s.name, "supplierName": s.name, "supplierCode": s.supplier_code} for s in Suppliers.objects.filter(pk__in=ids)])


@api_view(["GET"])
def purchase_return_grns(request):
    q = GoodsReceipts.objects.filter(is_deleted=False, is_cancelled=False)
    if request.query_params.get("supplierId"): q = q.filter(supplier_id=request.query_params["supplierId"])
    return ok([{"grnId": g["grnId"], "id": g["grnId"], "grnNumber": g["grnNumber"], "receiptDate": g["receiptDate"], "supplierId": g["supplierId"], "supplierName": g["supplierName"],
                "totalAmount": g["totalAmount"], "poNumber": g["poNumber"]} for g in grn_rows(q.order_by("-grn_id"))])


@api_view(["GET"])
def purchase_return_grn_items(request, grn_id):
    return ok(_returnable(grn_id))


@api_view(["POST"])
def goods_receipt_approve(request, pk):
    g = GoodsReceipts.objects.filter(pk=pk, is_deleted=False).first()
    if not g: raise ApiError("Goods receipt not found.", 404)
    return ok(grn_rows([g])[0], "Goods receipt is already approved and stock has been updated.")
