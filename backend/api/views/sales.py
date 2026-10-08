"""Sales: invoices (+PDF/email), customer & supplier payments, sales returns."""
import io
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.fieldtypes import utcnow
from ..core.inventory import adjust_stock, get_stock_row
from ..core.mail import send_email
from ..core.response import ApiError, ok
from ..core.serial import to_dict
from ..models import (Customers, CustomerPayments, InvoiceItems, Invoices, ProductVariants, Products, PurchaseOrders, SalesReturnItems,
                      SalesReturns, Stock, SupplierPayments, Suppliers, SystemSettings, Warehouses)

METHODS = {"cash": "Cash", "bank transfer": "Bank Transfer", "upi": "UPI", "card": "Card", "cheque": "Cheque"}


def D(v, default=0): return Decimal(str(v if v not in (None, "") else default))
def iso(v): return v.isoformat() if v else None
def lower(s): return str(s or "").strip().lower()


def dt(v, default=None):
    if not v: return default or utcnow()
    return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(v, str) else v


def names(model, ids, attr="name"):
    ids = {i for i in ids if i}
    return {o.pk: getattr(o, attr, None) for o in model.objects.filter(pk__in=ids)} if ids else {}


def money(v): return Decimal(v).quantize(Decimal("0.01"))


# ================================================================== invoices
def resolve_status(paid, balance, due):
    if balance <= 0: return "Paid"
    d = due.date() if isinstance(due, datetime) else due
    if d and d < utcnow().date() and balance > 0: return "Overdue"
    return "Partial" if paid > 0 else "Unpaid"


def invoice_rows(invs):
    invs = list(invs); ids = [i.pk for i in invs]; items = {}
    for it in InvoiceItems.objects.filter(invoice_id__in=ids): items.setdefault(it.invoice_id, []).append(it)
    cust = names(Customers, [i.customer_id for i in invs]); wh = names(Warehouses, [i.warehouse_id for i in invs])
    pn = names(Products, [x.product_id for l in items.values() for x in l]); sk = names(Products, [x.product_id for l in items.values() for x in l], "sku")
    pay = {}
    for p in CustomerPayments.objects.filter(invoice_id__in=ids, is_cancelled=False).order_by("payment_id"): pay.setdefault(p.invoice_id, []).append(p)
    out = []
    for i in invs:
        its = items.get(i.pk, []); ps = pay.get(i.pk, []); last = ps[-1] if ps else None
        out.append({"id": i.pk, "invoiceId": i.pk, "invoiceNumber": i.invoice_number, "soId": i.so_id, "customerId": i.customer_id, "customerName": cust.get(i.customer_id), "customer": cust.get(i.customer_id),
                    "warehouseId": i.warehouse_id, "warehouseName": wh.get(i.warehouse_id), "invoiceDate": iso(i.invoice_date), "dueDate": iso(i.due_date), "status": i.status,
                    "totalAmount": float(i.total_amount or 0), "paidAmount": float(i.paid_amount or 0), "balanceAmount": float(i.balance_amount or 0), "isCancelled": bool(i.is_cancelled),
                    "paymentMethod": last.payment_method if last else None, "referenceNumber": last.reference_number if last else None, "createdAt": iso(i.created_at),
                    "subtotal": float(sum(D(x.price) * D(x.quantity) for x in its)), "taxAmount": float(sum(D(x.tax_amount) for x in its)), "itemCount": len(its),
                    "items": [to_dict(x, extra={"productName": pn.get(x.product_id), "sku": sk.get(x.product_id), "taxPercent": float(x.tax_percent or 0), "lineTotal": float(x.total or 0)}) for x in its]})
    return out


def _next_invoice_number(d):
    ss = SystemSettings.objects.first(); prefix = (ss.invoice_prefix if ss and ss.invoice_prefix else "INV")
    n = Invoices.objects.count() + 1
    while Invoices.objects.filter(invoice_number=f"{prefix}-{d:%Y%m%d}-{n:04d}").exists(): n += 1
    return f"{prefix}-{d:%Y%m%d}-{n:04d}"


@api_view(["GET", "POST"])
def invoices(request):
    if request.method == "GET":
        q = Invoices.objects.filter(is_deleted=False).order_by("-invoice_id")
        if request.query_params.get("customerId"): q = q.filter(customer_id=request.query_params["customerId"])
        if request.query_params.get("status"): q = q.filter(status__iexact=request.query_params["status"])
        return ok(invoice_rows(q))
    d = request.data
    if not d.get("customerId"): raise ApiError("Customer is required.")
    items = d.get("items") or []
    if not items: raise ApiError("At least one invoice item is required.")
    cust = Customers.objects.filter(pk=d["customerId"]).first()
    if not cust: raise ApiError("Selected customer was not found.")
    if lower(cust.status) == "blocked": raise ApiError("This customer is blocked and cannot be invoiced.")
    wid = d.get("warehouseId")
    if not wid: raise ApiError("Invalid warehouse selection.")
    if not Warehouses.objects.filter(pk=wid, is_deleted=False).exists(): raise ApiError("Selected warehouse was not found.")
    inv_date = dt(d.get("invoiceDate")); due = dt(d.get("dueDate")) if d.get("dueDate") else None
    if due and due < inv_date.replace(hour=0, minute=0, second=0): raise ApiError("Due date cannot be before invoice date.")
    lines = []; demand = {}
    for it in items:
        pid, qty, price = it.get("productId"), D(it.get("quantity")), D(it.get("price"))
        p = Products.objects.filter(pk=pid, is_deleted=False).first() if pid else None
        if not p or qty <= 0 or price < 0: raise ApiError("Each invoice item must include a valid product, quantity greater than zero, and non-negative unit price.")
        vid = it.get("variantId") or None
        if vid and not ProductVariants.objects.filter(pk=vid, product_id=pid).exists(): raise ApiError(f"Selected variant {vid} is not valid for product {pid}.")
        tp = D(it.get("taxPercent")); ta = D(it.get("taxAmount")) if it.get("taxAmount") not in (None, "") else qty * price * tp / 100
        lines.append((p, vid, qty, price, tp, ta)); demand[(p.pk, vid)] = demand.get((p.pk, vid), Decimal(0)) + qty
    for (pid, vid), qty in demand.items():
        row = get_stock_row(pid, vid, int(wid), create=False); avail = D(row.quantity) if row else Decimal(0)
        if avail < qty: raise ApiError(f"Insufficient stock for {Products.objects.get(pk=pid).name}. Available: {avail}, requested: {qty}.")
    total = sum(q * p + ta for _, _, q, p, _, ta in lines)
    if total <= 0: raise ApiError("Invoice total must be greater than zero.")
    paid = D(d.get("paidAmount"))
    if paid < 0: raise ApiError("Paid amount cannot be negative.")
    if paid > total: raise ApiError("Paid amount cannot exceed invoice total.")
    method = None
    if paid > 0:
        method = METHODS.get(lower(d.get("paymentMethod")))
        if not method: raise ApiError("Invalid payment method. Allowed values are Cash, Bank Transfer, UPI, Card, and Cheque.")
        ref = (d.get("referenceNumber") or "").strip()
        if ref and CustomerPayments.objects.filter(reference_number__iexact=ref, is_cancelled=False).exists(): raise ApiError("Payment reference number already exists.")
    balance = total - paid
    with transaction.atomic():
        inv = Invoices.objects.create(so_id=d.get("soId") or None, customer_id=cust.pk, warehouse_id=int(wid), invoice_number=_next_invoice_number(inv_date), invoice_date=inv_date, due_date=due,
                                      status=resolve_status(paid, balance, due), total_amount=total, paid_amount=paid, balance_amount=balance, is_cancelled=False, is_deleted=False, created_at=utcnow(), updated_at=utcnow())
        for p, vid, qty, price, tp, ta in lines:
            InvoiceItems.objects.create(invoice_id=inv.pk, product_id=p.pk, variant_id=vid, quantity=qty, price=price, total=qty * price + ta, tax_amount=ta, tax_percent=tp)
            adjust_stock(p.pk, int(wid), -qty, "SalesInvoice", variant_id=vid, ref_id=inv.pk, ref_type="Invoice", notes=f"Sold on invoice {inv.invoice_number}")
        if paid > 0:
            CustomerPayments.objects.create(customer_id=cust.pk, invoice_id=inv.pk, amount=paid, payment_date=utcnow(), payment_method=method, reference_number=(d.get("referenceNumber") or "").strip() or None,
                                            notes=f"Payment against {inv.invoice_number}", is_cancelled=False)
        cust.outstanding_balance = D(cust.outstanding_balance) + balance; cust.updated_at = utcnow(); cust.save(update_fields=["outstanding_balance", "updated_at"])
    log_audit(request, "INVOICE_CREATED", "Sales", inv.pk, f"Invoice {inv.invoice_number} created for {cust.name}", "invoices")
    return ok(invoice_rows([inv])[0], "Invoice created successfully.", 201)


def _inv(pk):
    i = Invoices.objects.filter(pk=pk, is_deleted=False).first()
    if not i: raise ApiError("Invoice not found.", 404)
    return i


@api_view(["GET", "DELETE"])
def invoice_detail(request, pk):
    inv = _inv(pk)
    if request.method == "GET": return ok(invoice_rows([inv])[0])
    if not inv.is_cancelled: raise ApiError("Cancel the invoice before deleting it so stock and balances stay correct.")
    inv.is_deleted = True; inv.updated_at = utcnow(); inv.save(); return ok(None, "Invoice deleted successfully.")


@api_view(["POST"])
def invoice_cancel(request, pk):
    inv = _inv(pk)
    if inv.is_cancelled: raise ApiError("This invoice is already cancelled.")
    if SalesReturns.objects.filter(invoice_id=pk, is_deleted=False).exclude(status__in=["Rejected", "Draft"]).exists(): raise ApiError("This invoice has sales returns and cannot be cancelled.")
    with transaction.atomic():
        for it in InvoiceItems.objects.filter(invoice_id=pk):
            adjust_stock(it.product_id, inv.warehouse_id, D(it.quantity), "InvoiceCancelled", variant_id=it.variant_id, ref_id=pk, ref_type="Invoice", notes=f"Invoice {inv.invoice_number} cancelled")
        CustomerPayments.objects.filter(invoice_id=pk, is_cancelled=False).update(is_cancelled=True, cancelled_at=utcnow(), cancellation_reason="Invoice cancelled")
        c = Customers.objects.filter(pk=inv.customer_id).first()
        if c: c.outstanding_balance = max(D(c.outstanding_balance) - D(inv.balance_amount), Decimal(0)); c.save(update_fields=["outstanding_balance"])
        inv.is_cancelled = True; inv.cancelled_at = utcnow(); inv.cancellation_reason = str(request.data.get("reason") or "Cancelled by user")[:500]; inv.status = "Cancelled"; inv.updated_at = utcnow(); inv.save()
    log_audit(request, "INVOICE_CANCELLED", "Sales", pk, f"Invoice {inv.invoice_number} cancelled", "invoices")
    return ok(invoice_rows([inv])[0], "Invoice cancelled successfully.")


def invoice_pdf_bytes(inv_row):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    ss = SystemSettings.objects.first(); company = (ss.company_name if ss and ss.company_name else "IMS")
    buf = io.BytesIO(); doc = SimpleDocTemplate(buf, pagesize=A4, title=f"Invoice {inv_row['invoiceNumber']}", leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    st = getSampleStyleSheet(); els = [Paragraph(f"<b>{company}</b>", st["Title"]), Paragraph(f"Tax Invoice <b>{inv_row['invoiceNumber']}</b>", st["Heading2"]),
                                      Paragraph(f"Date: {(inv_row['invoiceDate'] or '')[:10]} &nbsp;&nbsp; Status: {inv_row['status']}<br/>Customer: {inv_row['customerName'] or ''}", st["Normal"]), Spacer(1, 12)]
    data = [["#", "Product", "Qty", "Price", "Tax", "Total"]] + [[str(n), (x["productName"] or "")[:44], f"{x['quantity']:g}", f"{x['price']:.2f}", f"{x['taxAmount']:.2f}", f"{x['total']:.2f}"] for n, x in enumerate(inv_row["items"], 1)]
    t = Table(data, colWidths=[24, 230, 44, 70, 60, 80]); t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#5a49d6")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                                                         ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9c5ee")), ("ALIGN", (2, 0), (-1, -1), "RIGHT"), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    els += [t, Spacer(1, 12), Paragraph(f"Subtotal: {inv_row['subtotal']:.2f} &nbsp; Tax: {inv_row['taxAmount']:.2f}<br/><b>Total: {inv_row['totalAmount']:.2f}</b> &nbsp; Paid: {inv_row['paidAmount']:.2f} &nbsp; Balance: {inv_row['balanceAmount']:.2f}", st["Normal"])]
    doc.build(els); return buf.getvalue()


@api_view(["GET"])
def invoice_pdf(request, pk):
    row = invoice_rows([_inv(pk)])[0]
    resp = HttpResponse(invoice_pdf_bytes(row), content_type="application/pdf"); resp["Content-Disposition"] = f'inline; filename="{row["invoiceNumber"]}.pdf"'; return resp


@api_view(["POST"])
def invoice_send_email(request, pk):
    inv = _inv(pk); row = invoice_rows([inv])[0]; c = Customers.objects.filter(pk=inv.customer_id).first()
    to = (request.data.get("email") or (c.email if c else "") or "").strip()
    if not to: raise ApiError("The customer has no email address. Enter an email to send the invoice.")
    sent = send_email(to, f"Invoice {inv.invoice_number}", f"<p>Dear {row['customerName'] or 'Customer'},</p><p>Please find your invoice <b>{inv.invoice_number}</b> attached.</p><p>Total: {row['totalAmount']:.2f}</p>",
                      [(f"{inv.invoice_number}.pdf", invoice_pdf_bytes(row), "application/pdf")])
    if not sent: raise ApiError("The email could not be sent. Check the email settings.", 502)
    return ok(None, f"Invoice emailed to {to}.")


# ================================================================== payments
def _recalc_invoice(inv):
    paid = sum(D(p.amount) for p in CustomerPayments.objects.filter(invoice_id=inv.pk, is_cancelled=False))
    new_bal = max(D(inv.total_amount) - paid, Decimal(0)); delta = new_bal - D(inv.balance_amount)
    inv.paid_amount, inv.balance_amount = paid, new_bal
    inv.status = "Cancelled" if inv.is_cancelled else resolve_status(paid, new_bal, inv.due_date); inv.updated_at = utcnow(); inv.save()
    c = Customers.objects.filter(pk=inv.customer_id).first()
    if c: c.outstanding_balance = max(D(c.outstanding_balance) + delta, Decimal(0)); c.save(update_fields=["outstanding_balance"])


def cpay_rows(rows):
    rows = list(rows); cn = names(Customers, [r.customer_id for r in rows]); inv = names(Invoices, [r.invoice_id for r in rows], "invoice_number")
    return [to_dict(r, extra={"id": r.pk, "paymentId": r.pk, "customerName": cn.get(r.customer_id), "invoiceNumber": inv.get(r.invoice_id),
                              "status": "Cancelled" if r.is_cancelled else "Completed"}) for r in rows]


@api_view(["GET", "POST"])
def customer_payments(request):
    if request.method == "GET":
        q = CustomerPayments.objects.order_by("-payment_date", "-payment_id")
        if request.query_params.get("customerId"): q = q.filter(customer_id=request.query_params["customerId"])
        return ok(cpay_rows(q))
    d = request.data; cust = Customers.objects.filter(pk=d.get("customerId")).first(); amt = D(d.get("amount"))
    if not cust: raise ApiError("Selected customer was not found.")
    if amt <= 0: raise ApiError("Payment amount must be greater than zero.")
    method = METHODS.get(lower(d.get("paymentMethod")))
    if not method: raise ApiError("Invalid payment method. Allowed values are Cash, Bank Transfer, UPI, Card, and Cheque.")
    ref = (d.get("referenceNumber") or "").strip()
    if ref and CustomerPayments.objects.filter(reference_number__iexact=ref, is_cancelled=False).exists(): raise ApiError("Payment reference number already exists.")
    inv = None
    if d.get("invoiceId"):
        inv = Invoices.objects.filter(pk=d["invoiceId"], is_deleted=False).first()
        if not inv or inv.customer_id != cust.pk: raise ApiError("The selected invoice does not belong to this customer.")
        if inv.is_cancelled: raise ApiError("Payments cannot be recorded against a cancelled invoice.")
        if amt > D(inv.balance_amount): raise ApiError(f"Payment exceeds the invoice balance of {D(inv.balance_amount)}.")
    with transaction.atomic():
        p = CustomerPayments.objects.create(customer_id=cust.pk, invoice_id=inv.pk if inv else None, amount=amt, payment_date=dt(d.get("paymentDate")), payment_method=method,
                                            reference_number=ref or None, notes=(d.get("notes") or "").strip() or None, is_cancelled=False)
        if inv: _recalc_invoice(inv)
        else: cust.outstanding_balance = max(D(cust.outstanding_balance) - amt, Decimal(0)); cust.save(update_fields=["outstanding_balance"])
    log_audit(request, "PAYMENT_RECEIVED", "Payments", p.pk, f"Payment of {amt} received from {cust.name}", "customer_payments")
    return ok(cpay_rows([p])[0], "Payment recorded successfully.", 201)


@api_view(["GET", "PUT", "DELETE"])
def customer_payment_detail(request, pk):
    p = CustomerPayments.objects.filter(pk=pk).first()
    if not p: raise ApiError("Payment not found.", 404)
    if request.method == "GET": return ok(cpay_rows([p])[0])
    if request.method == "DELETE": return _void_customer_payment(request, p, delete=True)
    if p.is_cancelled: raise ApiError("A voided payment cannot be edited.")
    d = request.data; amt = D(d.get("amount", p.amount))
    if amt <= 0: raise ApiError("Payment amount must be greater than zero.")
    inv = Invoices.objects.filter(pk=p.invoice_id).first()
    if inv and amt > D(inv.balance_amount) + D(p.amount): raise ApiError("Payment exceeds the invoice balance.")
    if d.get("paymentMethod"):
        m = METHODS.get(lower(d["paymentMethod"]))
        if not m: raise ApiError("Invalid payment method.")
        p.payment_method = m
    p.amount = amt
    if "referenceNumber" in d: p.reference_number = (d.get("referenceNumber") or "").strip() or None
    if "notes" in d: p.notes = d.get("notes")
    p.save()
    if inv: _recalc_invoice(inv)
    return ok(cpay_rows([p])[0], "Payment updated successfully.")


def _void_customer_payment(request, p, delete=False):
    if p.is_cancelled and not delete: raise ApiError("This payment is already voided.")
    with transaction.atomic():
        if not p.is_cancelled:
            p.is_cancelled = True; p.cancelled_at = utcnow(); p.cancellation_reason = str(request.data.get("reason") or "Voided by user")[:500]; p.save()
            inv = Invoices.objects.filter(pk=p.invoice_id).first()
            if inv: _recalc_invoice(inv)
            else:
                c = Customers.objects.filter(pk=p.customer_id).first()
                if c: c.outstanding_balance = D(c.outstanding_balance) + D(p.amount); c.save(update_fields=["outstanding_balance"])
        if delete: p.delete()
    return ok(None, "Payment deleted successfully." if delete else "Payment voided successfully.")


@api_view(["POST"])
def customer_payment_void(request, pk):
    p = CustomerPayments.objects.filter(pk=pk).first()
    if not p: raise ApiError("Payment not found.", 404)
    return _void_customer_payment(request, p)


def _po_payment_status(po_id):
    po = PurchaseOrders.objects.filter(pk=po_id).first()
    if not po: return
    paid = sum(D(p.amount) for p in SupplierPayments.objects.filter(po_id=po_id, is_cancelled=False))
    po.payment_status = "paid" if paid >= D(po.total_amount) and paid > 0 else ("partial" if paid > 0 else "unpaid"); po.save(update_fields=["payment_status"])


def spay_rows(rows):
    rows = list(rows); sn = names(Suppliers, [r.supplier_id for r in rows]); po = names(PurchaseOrders, [r.po_id for r in rows], "po_number")
    return [to_dict(r, extra={"id": r.pk, "paymentId": r.pk, "supplierName": sn.get(r.supplier_id), "poNumber": po.get(r.po_id), "status": "Cancelled" if r.is_cancelled else "Completed"}) for r in rows]


@api_view(["GET", "POST"])
def supplier_payments(request):
    if request.method == "GET": return ok(spay_rows(SupplierPayments.objects.order_by("-payment_date", "-payment_id")))
    d = request.data; sup = Suppliers.objects.filter(pk=d.get("supplierId")).first(); amt = D(d.get("amount"))
    if not sup: raise ApiError("Selected supplier was not found.")
    if amt <= 0: raise ApiError("Payment amount must be greater than zero.")
    method = METHODS.get(lower(d.get("paymentMethod")))
    if not method: raise ApiError("Invalid payment method. Allowed values are Cash, Bank Transfer, UPI, Card, and Cheque.")
    po = None
    if d.get("poId"):
        po = PurchaseOrders.objects.filter(pk=d["poId"], is_deleted=False).first()
        if not po or po.supplier_id != sup.pk: raise ApiError("The selected purchase order does not belong to this supplier.")
        paid = sum(D(p.amount) for p in SupplierPayments.objects.filter(po_id=po.pk, is_cancelled=False))
        if paid + amt > D(po.total_amount) + Decimal("0.01"): raise ApiError(f"Payment exceeds the purchase order balance of {D(po.total_amount) - paid}.")
    p = SupplierPayments.objects.create(supplier_id=sup.pk, po_id=po.pk if po else None, amount=amt, payment_date=dt(d.get("paymentDate")), payment_method=method,
                                        reference_number=(d.get("referenceNumber") or "").strip() or None, notes=(d.get("notes") or "").strip() or None, is_cancelled=False)
    if po: _po_payment_status(po.pk)
    log_audit(request, "SUPPLIER_PAYMENT", "Payments", p.pk, f"Payment of {amt} made to {sup.name}", "supplier_payments")
    return ok(spay_rows([p])[0], "Supplier payment recorded successfully.", 201)


@api_view(["GET", "DELETE"])
def supplier_payment_detail(request, pk):
    p = SupplierPayments.objects.filter(pk=pk).first()
    if not p: raise ApiError("Payment not found.", 404)
    if request.method == "GET": return ok(spay_rows([p])[0])
    po = p.po_id; p.delete()
    if po: _po_payment_status(po)
    return ok(None, "Payment deleted successfully.")


@api_view(["POST"])
def supplier_payment_void(request, pk):
    p = SupplierPayments.objects.filter(pk=pk).first()
    if not p: raise ApiError("Payment not found.", 404)
    if p.is_cancelled: raise ApiError("This payment is already voided.")
    p.is_cancelled = True; p.cancelled_at = utcnow(); p.cancellation_reason = str(request.data.get("reason") or "Voided by user")[:500]; p.save()
    if p.po_id: _po_payment_status(p.po_id)
    return ok(None, "Payment voided successfully.")


# ================================================================== sales returns
def _returned_qty(invoice_id, product_id, variant_id, exclude=None):
    q = SalesReturnItems.objects.filter(sales_return_id__in=SalesReturns.objects.filter(invoice_id=invoice_id, is_deleted=False).exclude(status__in=["Rejected"]).values("return_id"), product_id=product_id)
    if exclude: q = q.exclude(sales_return_id=exclude)
    return sum(D(x.return_quantity) for x in q if x.variant_id == variant_id)


def sr_rows(rows):
    rows = list(rows); ids = [r.pk for r in rows]; items = {}
    for it in SalesReturnItems.objects.filter(sales_return_id__in=ids): items.setdefault(it.sales_return_id, []).append(it)
    cn = names(Customers, [r.customer_id for r in rows]); inv = names(Invoices, [r.invoice_id for r in rows], "invoice_number"); wh = names(Warehouses, [r.warehouse_id for r in rows])
    pn = names(Products, [x.product_id for l in items.values() for x in l]); sk = names(Products, [x.product_id for l in items.values() for x in l], "sku")
    return [to_dict(r, extra={"id": r.pk, "returnId": r.pk, "customerName": cn.get(r.customer_id), "invoiceNumber": inv.get(r.invoice_id), "warehouseName": wh.get(r.warehouse_id),
                              "itemCount": len(items.get(r.pk, [])), "totalQuantity": float(sum(D(x.return_quantity) for x in items.get(r.pk, []))),
                              "items": [to_dict(x, extra={"productName": pn.get(x.product_id), "sku": sk.get(x.product_id), "quantity": float(x.return_quantity or 0), "lineTotal": float(x.total or 0)}) for x in items.get(r.pk, [])]}) for r in rows]


def _sr(pk):
    r = SalesReturns.objects.filter(pk=pk, is_deleted=False).first()
    if not r: raise ApiError("Sales return not found.", 404)
    return r


def _sr_items_for_invoice(invoice_id, exclude=None):
    inv = Invoices.objects.filter(pk=invoice_id, is_deleted=False, is_cancelled=False).first()
    if not inv: raise ApiError("Invoice not found or cancelled.", 404)
    its = list(InvoiceItems.objects.filter(invoice_id=invoice_id)); pn = names(Products, [i.product_id for i in its]); sk = names(Products, [i.product_id for i in its], "sku"); out = []
    for i in its:
        done = _returned_qty(invoice_id, i.product_id, i.variant_id, exclude); avail = D(i.quantity) - done
        out.append({"productId": i.product_id, "productName": pn.get(i.product_id), "sku": sk.get(i.product_id), "variantId": i.variant_id, "invoicedQuantity": float(i.quantity), "returnedQuantity": float(done),
                    "returnableQuantity": float(avail), "availableQuantity": float(avail), "price": float(i.price or 0), "taxPercent": float(i.tax_percent or 0)})
    return inv, out


@api_view(["GET", "POST"])
def sales_returns(request):
    if request.method == "GET":
        q = SalesReturns.objects.filter(is_deleted=False).order_by("-return_id")
        if request.query_params.get("status"): q = q.filter(status__iexact=request.query_params["status"])
        return ok(sr_rows(q))
    d = request.data; inv, avail = _sr_items_for_invoice(d.get("invoiceId")); a = {(x["productId"], x["variantId"]): x for x in avail}
    if not (d.get("reason") or "").strip(): raise ApiError("A return reason is required.")
    lines = []
    for it in d.get("items") or []:
        q = D(it.get("returnQuantity", it.get("quantity")))
        if q <= 0: continue
        x = a.get((int(it["productId"]), it.get("variantId") or None))
        if not x: raise ApiError("A returned product is not part of this invoice.")
        if q > D(x["returnableQuantity"]): raise ApiError(f"Return quantity exceeds the returnable quantity ({x['returnableQuantity']}) for {x['productName']}.")
        lines.append((x, q))
    if not lines: raise ApiError("Enter a return quantity for at least one item.")
    with transaction.atomic():
        net = sum(q * D(x["price"]) for x, q in lines); tax = sum(q * D(x["price"]) * D(x["taxPercent"]) / 100 for x, q in lines)
        n = SalesReturns.objects.count() + 1
        while SalesReturns.objects.filter(return_number=f"SR-{utcnow():%Y%m%d}-{n:04d}").exists(): n += 1
        r = SalesReturns.objects.create(return_number=f"SR-{utcnow():%Y%m%d}-{n:04d}", customer_id=inv.customer_id, warehouse_id=inv.warehouse_id, invoice_id=inv.pk, return_date=dt(d.get("returnDate")),
                                        reason=d["reason"].strip(), notes=d.get("notes"), total_amount=net, tax_amount=tax, discount_amount=0, grand_total=net + tax, refund_amount=0,
                                        status="Pending" if d.get("submitForApproval") else "Draft", created_at=utcnow(), updated_at=utcnow(), is_deleted=False)
        for x, q in lines:
            SalesReturnItems.objects.create(sales_return_id=r.pk, product_id=x["productId"], variant_id=x["variantId"], invoiced_quantity=x["invoicedQuantity"], return_quantity=q, price=x["price"],
                                            tax=x["taxPercent"], tax_amount=q * D(x["price"]) * D(x["taxPercent"]) / 100, discount=0, total=q * D(x["price"]), created_at=utcnow())
    log_audit(request, "SALES_RETURN_CREATED", "Sales", r.pk, f"Sales return {r.return_number} created", "sales_returns")
    return ok(sr_rows([r])[0], "Sales return created successfully.", 201)


@api_view(["GET", "DELETE"])
def sales_return_detail(request, pk):
    r = _sr(pk)
    if request.method == "GET": return ok(sr_rows([r])[0])
    if r.status not in ("Draft", "Rejected"): raise ApiError("Only draft or rejected returns can be deleted.")
    r.is_deleted = True; r.save(); return ok(None, "Sales return deleted successfully.")


def _move(pk, frm, to, **fields):
    r = _sr(pk)
    if (r.status or "Draft") not in frm: raise ApiError(f"Only {' / '.join(frm)} returns can move to {to}.")
    r.status = to; r.updated_at = utcnow()
    for k, v in fields.items(): setattr(r, k, v)
    r.save(); return r


@api_view(["POST"])
def sales_return_submit(request, pk): return ok(sr_rows([_move(pk, ("Draft",), "Pending")])[0], "Sales return submitted for approval.")


@api_view(["POST"])
def sales_return_approve(request, pk): return ok(sr_rows([_move(pk, ("Pending",), "Approved", approved_by=request.user.id, approved_at=utcnow())])[0], "Sales return approved.")


@api_view(["POST"])
def sales_return_reject(request, pk): return ok(sr_rows([_move(pk, ("Pending",), "Rejected", rejection_reason=str(request.data.get("reason") or "")[:500])])[0], "Sales return rejected.")


@api_view(["POST"])
def sales_return_refund(request, pk):
    r = _sr(pk)
    if r.status != "Approved": raise ApiError("Only approved returns can be refunded.")
    amt = D(request.data.get("refundAmount", r.grand_total))
    if amt < 0 or amt > D(r.grand_total): raise ApiError("Refund amount must be between zero and the return total.")
    r.refund_amount = amt; r.refund_method = request.data.get("refundMethod") or "Cash"; r.refund_reference = request.data.get("refundReference"); r.refund_date = utcnow(); r.updated_at = utcnow(); r.save()
    return ok(sr_rows([r])[0], "Refund processed.")


@api_view(["POST"])
def sales_return_complete(request, pk):
    r = _sr(pk)
    if r.status != "Approved": raise ApiError("Only approved returns can be completed.")
    with transaction.atomic():
        for it in SalesReturnItems.objects.filter(sales_return_id=pk):
            adjust_stock(it.product_id, r.warehouse_id, D(it.return_quantity), "SalesReturn", variant_id=it.variant_id, ref_id=pk, ref_type="SalesReturn", notes=f"Customer return {r.return_number}")
        c = Customers.objects.filter(pk=r.customer_id).first(); inv = Invoices.objects.filter(pk=r.invoice_id).first()
        if c and inv and D(inv.balance_amount) > 0:       # reduce what the customer still owes, up to the open balance
            credit = min(D(r.grand_total), D(inv.balance_amount)); inv.balance_amount = D(inv.balance_amount) - credit; inv.total_amount = D(inv.total_amount) - credit
            inv.status = resolve_status(D(inv.paid_amount), D(inv.balance_amount), inv.due_date); inv.save(); c.outstanding_balance = max(D(c.outstanding_balance) - credit, Decimal(0)); c.save(update_fields=["outstanding_balance"])
        r.status = "Completed"; r.updated_at = utcnow(); r.save()
    log_audit(request, "SALES_RETURN_COMPLETED", "Sales", pk, f"Sales return {r.return_number} completed; stock restored", "sales_returns")
    return ok(sr_rows([r])[0], "Sales return completed and stock updated.")


@api_view(["GET"])
def sales_return_customers(request):
    ids = set(Invoices.objects.filter(is_deleted=False, is_cancelled=False).values_list("customer_id", flat=True))
    return ok([{"customerId": c.pk, "id": c.pk, "name": c.name, "customerName": c.name, "customerCode": c.customer_code} for c in Customers.objects.filter(pk__in=ids)])


@api_view(["GET"])
def sales_return_customer_invoices(request, customer_id):
    return ok(invoice_rows(Invoices.objects.filter(customer_id=customer_id, is_deleted=False, is_cancelled=False).order_by("-invoice_id")))


@api_view(["GET"])
def sales_return_invoice_items(request, invoice_id): return ok(_sr_items_for_invoice(invoice_id)[1])


@api_view(["GET"])
def sales_return_returnable_invoices(request):
    out = []
    for inv in invoice_rows(Invoices.objects.filter(is_deleted=False, is_cancelled=False).order_by("-invoice_id")[:200]):
        if any(x["returnableQuantity"] > 0 for x in _sr_items_for_invoice(inv["invoiceId"])[1]): out.append(inv)
    return ok(out)
