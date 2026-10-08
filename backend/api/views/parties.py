"""Suppliers and customers, each with contacts / addresses / bank accounts / payment terms."""
import math
import os
import random
import re
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.fieldtypes import utcnow
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import (CustomerActivity, CustomerAddresses, CustomerBankDetails, CustomerContacts, CustomerPaymentTerms, Customers,
                      Invoices, GoodsReceipts, PurchaseOrders, SupplierAddresses, SupplierBankDetails, SupplierContacts,
                      SupplierDocuments, SupplierPaymentTerms, Suppliers)

GST_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$"); PAN_RE = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
SUPPLIER_STATUSES = {"active", "blocked", "inactive", "pending"}


def s(v):
    return " ".join(str(v or "").split())


def next_code(model, attr, prefix):
    n = model.objects.count() + 1
    while model.objects.filter(**{attr: f"{prefix}{n:04d}"}).exists():
        n += 1
    return f"{prefix}{n:04d}"


def page_args(qp, default=500, cap=500):
    return max(int(qp.get("page", 1) or 1), 1), min(max(int(qp.get("pageSize", default) or default), 1), cap)


def paged(rows, total, page, size):
    return Response({"success": True, "page": page, "pageSize": size, "totalRecords": total,
                     "totalPages": math.ceil(total / size) if total else 0, "data": rows, "message": None, "errors": None})


# ================================================================ suppliers
def _sup_rows(sups):
    sups = list(sups); ids = [x.pk for x in sups]
    contacts, addrs, banks, terms = {}, {}, {}, {}
    for c in SupplierContacts.objects.filter(supplier_id__in=ids): contacts.setdefault(c.supplier_id, []).append(to_dict(c, extra={"id": c.pk}))
    for a in SupplierAddresses.objects.filter(supplier_id__in=ids): addrs.setdefault(a.supplier_id, []).append(to_dict(a, extra={"id": a.pk, "type": a.address_type, "addressLine1": a.address_line}))
    for b in SupplierBankDetails.objects.filter(supplier_id__in=ids): banks.setdefault(b.supplier_id, []).append(to_dict(b, extra={"id": b.pk}))
    for t in SupplierPaymentTerms.objects.filter(supplier_id__in=ids): terms[t.supplier_id] = to_dict(t, extra={"preferredPaymentMethod": t.payment_method})
    out = []
    for x in sups:
        cs = contacts.get(x.pk, []); primary = next((c for c in cs if c.get("isPrimary")), cs[0] if cs else {})
        out.append(to_dict(x, extra={"id": x.pk, "contact": primary.get("name") or x.name, "contacts": cs, "addresses": addrs.get(x.pk, []),
                                     "bankAccounts": banks.get(x.pk, []), "paymentTerm": terms.get(x.pk), "isArchived": x.is_deleted}))
    return out


@api_view(["GET", "POST"])
def suppliers(request):
    if request.method == "POST":
        return _sup_save(request, Suppliers())
    qp = request.query_params; page, size = page_args(qp)
    q = Suppliers.objects.all(); status = (qp.get("status") or "").strip().lower()
    if status == "archived": q = q.filter(is_deleted=True)
    elif qp.get("includeDeleted") != "true" and qp.get("includeArchived") != "true": q = q.filter(is_deleted=False)
    if status in SUPPLIER_STATUSES: q = q.filter(status__iexact=status)
    term = (qp.get("search") or "").strip()
    if term: q = q.filter(Q(name__icontains=term) | Q(supplier_code__icontains=term) | Q(email__icontains=term) | Q(phone__icontains=term) | Q(gst_number__icontains=term))
    sort = {"name": "name", "suppliercode": "supplier_code", "status": "status"}.get((qp.get("sortBy") or "").lower(), "created_at")
    q = q.order_by(("" if (qp.get("sortOrder") or "desc").lower() == "asc" else "-") + sort)
    total = q.count()
    return paged(_sup_rows(q[(page - 1) * size: page * size]), total, page, size)


def _sup_validate(sup, d, pk=None):
    if not s(sup.name): raise ApiError("Supplier name is required.", errors={"Name": ["Supplier name is required."]})
    if sup.email and not EMAIL_RE.match(sup.email): raise ApiError("Please enter a valid email address.")
    if sup.phone and not re.fullmatch(r"\d{10}", re.sub(r"\D", "", sup.phone)[-10:] if sup.phone else ""): raise ApiError("Phone number must contain 10 digits.")
    if sup.gst_number and not GST_RE.match(sup.gst_number): raise ApiError("Please enter a valid GST number.")
    if sup.pan_number and not PAN_RE.match(sup.pan_number): raise ApiError("Please enter a valid PAN number.")
    base = Suppliers.objects.filter(is_deleted=False)
    if pk: base = base.exclude(pk=pk)
    if sup.supplier_code and base.filter(supplier_code__iexact=sup.supplier_code).exists(): raise ApiError("Supplier code already exists.", 409)
    if sup.gst_number and base.filter(gst_number__iexact=sup.gst_number).exists(): raise ApiError("A supplier with this GST number already exists.", 409)
    if sup.email and base.filter(email__iexact=sup.email).exists(): raise ApiError("A supplier with this email already exists.", 409)


def _sup_children(sup, d):
    if isinstance(d.get("contacts"), list):
        SupplierContacts.objects.filter(supplier_id=sup.pk).delete()
        for i, c in enumerate(d["contacts"]):
            if s(c.get("name")): SupplierContacts.objects.create(supplier_id=sup.pk, name=s(c.get("name")), designation=s(c.get("designation")) or None,
                                                                 phone=s(c.get("phone")) or None, email=s(c.get("email")) or None,
                                                                 is_primary=bool(c.get("isPrimary")) or i == 0, department=s(c.get("department")) or None)
    if isinstance(d.get("addresses"), list):
        SupplierAddresses.objects.filter(supplier_id=sup.pk).delete()
        for a in d["addresses"]:
            line = s(a.get("addressLine1") or a.get("addressLine"))
            if line or s(a.get("city")):
                SupplierAddresses.objects.create(supplier_id=sup.pk, address_type=s(a.get("addressType") or a.get("type")) or "Billing", address_line=line or None,
                                                 city=s(a.get("city")) or None, state=s(a.get("state")) or None, country=s(a.get("country")) or "India", pincode=s(a.get("pincode")) or None)
    if isinstance(d.get("bankAccounts"), list):
        SupplierBankDetails.objects.filter(supplier_id=sup.pk).delete()
        for b in d["bankAccounts"]:
            if s(b.get("accountNumber")) or s(b.get("bankName")):
                SupplierBankDetails.objects.create(supplier_id=sup.pk, account_name=s(b.get("accountName")) or None, account_number=s(b.get("accountNumber")) or None,
                                                   bank_name=s(b.get("bankName")) or None, ifsc_code=s(b.get("ifscCode")).upper() or None, branch=s(b.get("branch")) or None,
                                                   bank_state=s(b.get("bankState")) or None, bank_city=s(b.get("bankCity")) or None)
    pt = d.get("paymentTerm") or d.get("paymentTermsProfile")
    if isinstance(pt, dict):
        SupplierPaymentTerms.objects.filter(supplier_id=sup.pk).delete()
        SupplierPaymentTerms.objects.create(supplier_id=sup.pk, credit_days=int(pt.get("creditDays") or 0),
                                            credit_limit=Decimal(str(pt["creditLimit"])) if pt.get("creditLimit") not in (None, "") else None,
                                            payment_method=s(pt.get("paymentMethod") or pt.get("preferredPaymentMethod")) or None, notes=s(pt.get("notes")) or None)


def _sup_save(request, sup):
    d = request.data; new = sup.pk is None
    with transaction.atomic():
        for attr, key in (("name", "name"), ("website", "website"), ("category", "category"), ("phone", "phone"), ("email", "email")):
            if key in d or new: setattr(sup, attr, s(d.get(key)) or None if attr != "name" else s(d.get(key)))
        if "gstNumber" in d or "gstin" in d or new: sup.gst_number = s(d.get("gstNumber") or d.get("gstin") or d.get("gst")).upper() or None
        if "panNumber" in d or "pan" in d or new: sup.pan_number = s(d.get("panNumber") or d.get("pan")).upper() or None
        if sup.email: sup.email = sup.email.lower()
        if "status" in d or new:
            st = str(d.get("status") or "active").lower(); sup.status = st if st in SUPPLIER_STATUSES else "active"
        if "supplierCode" in d and s(d.get("supplierCode")): sup.supplier_code = s(d["supplierCode"]).upper()
        elif new: sup.supplier_code = next_code(Suppliers, "supplier_code", "SUP-")
        if new: sup.created_at = utcnow(); sup.is_deleted = False
        sup.updated_at = utcnow()
        _sup_validate(sup, d, sup.pk)
        sup.save(); _sup_children(sup, d)
    log_audit(request, "Create" if new else "Update", "Suppliers", sup.pk, f"Supplier {'created' if new else 'updated'}: {sup.name}", "suppliers")
    return Response({"success": True, "data": _sup_rows([sup])[0], "message": f"Supplier {'created' if new else 'updated'} successfully.", "errors": None}, status=201 if new else 200)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def supplier_detail(request, pk):
    sup = Suppliers.objects.filter(pk=pk).first()
    if not sup: return fail("Supplier was not found.", 404)
    if request.method == "GET": return ok(_sup_rows([sup])[0])
    if request.method in ("PUT", "PATCH"): return _sup_save(request, sup)
    if PurchaseOrders.objects.filter(supplier_id=pk, is_deleted=False).exclude(status__in=["Cancelled", "Completed", "Received"]).exists():
        return fail("This supplier has open purchase orders and cannot be archived.")
    sup.is_deleted = True; sup.deleted_at = utcnow(); sup.updated_at = utcnow(); sup.save()
    log_audit(request, "Archive", "Suppliers", pk, f"Supplier archived: {sup.name}", "suppliers")
    return ok(None, "Supplier archived successfully.")


@api_view(["POST"])
def supplier_restore(request, pk):
    sup = Suppliers.objects.filter(pk=pk).first()
    if not sup: return fail("Supplier was not found.", 404)
    sup.is_deleted = False; sup.deleted_at = None; sup.updated_at = utcnow(); sup.save()
    return ok(_sup_rows([sup])[0], "Supplier restored successfully.")


@api_view(["GET"])
def supplier_ifsc(request, code):
    code = code.strip().upper()
    if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", code): return fail("Invalid IFSC code.")
    return ok({"ifsc": code, "bank": None, "branch": None, "city": None, "state": None}, "IFSC format is valid. Bank details lookup is unavailable offline.")


def _doc_row(d):
    return to_dict(d, extra={"id": d.pk, "documentId": d.pk, "type": d.document_type, "fileName": d.original_file_name, "fileSize": d.file_size_bytes})


@api_view(["GET"])
def supplier_documents(request, supplier_id):
    return ok([_doc_row(d) for d in SupplierDocuments.objects.filter(supplier_id=supplier_id, is_deleted=False, is_temporary=False).order_by("-uploaded_at")])


@api_view(["POST"])
def supplier_document_upload(request, supplier_id):
    f = request.FILES.get("file") or next(iter(request.FILES.values()), None)
    if not f: return fail("No file was uploaded.")
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".pdf", ".docx", ".xlsx"): return fail("This file type is not allowed.")
    if f.size > 10 * 1024 * 1024: return fail("File must be 10 MB or smaller.")
    folder = settings.MEDIA_ROOT / "uploads" / "suppliers"; folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    with open(folder / stored, "wb") as out:
        for chunk in f.chunks(): out.write(chunk)
    dtype = request.data.get("documentType") or request.data.get("type") or "Other"
    d = SupplierDocuments.objects.create(supplier_id=supplier_id, display_name=request.data.get("displayName") or f.name, file_path=f"/uploads/suppliers/{stored}",
                                         uploaded_at=utcnow(), document_type=dtype, original_file_name=f.name, stored_file_name=stored, content_type=f.content_type,
                                         file_size_bytes=f.size, status="Uploaded", is_deleted=False, is_temporary=str(request.data.get("isTemporary", "")).lower() == "true")
    return ok(_doc_row(d), "Document uploaded successfully.", 201)


@api_view(["DELETE"])
def supplier_document_delete(request, document_id):
    SupplierDocuments.objects.filter(pk=document_id).update(is_deleted=True, deleted_at=utcnow())
    return ok(None, "Document deleted successfully.")


@api_view(["DELETE"])
def supplier_documents_temp(request, supplier_id):
    SupplierDocuments.objects.filter(supplier_id=supplier_id, is_temporary=True).update(is_deleted=True, deleted_at=utcnow())
    return ok(None, "Temporary documents removed.")


@api_view(["GET"])
def supplier_document_download(request, document_id):
    d = SupplierDocuments.objects.filter(pk=document_id, is_deleted=False).first()
    path = settings.MEDIA_ROOT / "uploads" / "suppliers" / (d.stored_file_name or "") if d else None
    if not d or not path or not path.exists(): raise Http404()
    return FileResponse(open(path, "rb"), as_attachment=True, filename=d.original_file_name or d.stored_file_name)


# ================================================================ customers
def _cust_rows(custs):
    custs = list(custs); ids = [c.pk for c in custs]
    contacts, addrs, banks, terms = {}, {}, {}, {}
    for c in CustomerContacts.objects.filter(customer_id__in=ids): contacts.setdefault(c.customer_id, []).append(to_dict(c, extra={"id": c.pk, "contactName": c.name}))
    for a in CustomerAddresses.objects.filter(customer_id__in=ids): addrs.setdefault(a.customer_id, []).append(to_dict(a, extra={"id": a.pk, "type": a.address_type, "addressLine1": a.address_line}))
    for b in CustomerBankDetails.objects.filter(customer_id__in=ids): banks.setdefault(b.customer_id, []).append(to_dict(b, extra={"id": b.pk}))
    for t in CustomerPaymentTerms.objects.filter(customer_id__in=ids): terms[t.customer_id] = to_dict(t, extra={"paymentMode": t.payment_mode or t.payment_method})
    out = []
    for c in custs:
        out.append(to_dict(c, extra={"id": c.pk, "address": c.city, "taxNumber": c.gst_number, "contacts": contacts.get(c.pk, []), "addresses": addrs.get(c.pk, []),
                                     "bankDetails": banks.get(c.pk, []), "bankAccounts": banks.get(c.pk, []), "paymentTerms": terms.get(c.pk),
                                     "creditDays": (terms.get(c.pk) or {}).get("creditDays", 0)}))
    return out


@api_view(["GET", "POST"])
def customers(request):
    if request.method == "POST":
        return _cust_save(request, Customers())
    qp = request.query_params; page, size = page_args(qp, 500, 500)
    q = Customers.objects.all()
    if qp.get("status") and qp["status"].lower() != "all": q = q.filter(status__iexact=qp["status"])
    term = (qp.get("search") or "").strip()
    if term: q = q.filter(Q(name__icontains=term) | Q(customer_code__icontains=term) | Q(email__icontains=term) | Q(phone__icontains=term) | Q(company__icontains=term))
    q = q.order_by("-created_at", "-customer_id"); total = q.count()
    return paged(_cust_rows(q[(page - 1) * size: page * size]), total, page, size)


def _cust_children(c, d):
    if isinstance(d.get("contacts"), list):
        CustomerContacts.objects.filter(customer_id=c.pk).delete()
        for i, x in enumerate(d["contacts"]):
            nm = s(x.get("contactName") or x.get("name"))
            if nm: CustomerContacts.objects.create(customer_id=c.pk, name=nm, designation=s(x.get("designation")) or None, phone=s(x.get("phone")) or None,
                                                   email=s(x.get("email")) or None, is_primary=bool(x.get("isPrimary")) or i == 0, role=s(x.get("role")) or None)
    if isinstance(d.get("addresses"), list):
        CustomerAddresses.objects.filter(customer_id=c.pk).delete()
        for i, a in enumerate(d["addresses"]):
            line = s(a.get("addressLine") or a.get("addressLine1"))
            if line or s(a.get("city")):
                CustomerAddresses.objects.create(customer_id=c.pk, address_type=s(a.get("addressType") or a.get("type")) or "Billing", address_line=line or None,
                                                 address_line2=s(a.get("addressLine2")) or None, city=s(a.get("city")) or None, state=s(a.get("state")) or None,
                                                 country=s(a.get("country")) or "India", pincode=s(a.get("pincode")) or None, is_primary=bool(a.get("isPrimary")) or i == 0)
    banks = d.get("bankDetails") if isinstance(d.get("bankDetails"), list) else d.get("bankAccounts")
    if isinstance(banks, list):
        CustomerBankDetails.objects.filter(customer_id=c.pk).delete()
        for i, b in enumerate(banks):
            if s(b.get("accountNumber")) or s(b.get("bankName")):
                CustomerBankDetails.objects.create(customer_id=c.pk, account_name=s(b.get("accountName")) or None, account_number=s(b.get("accountNumber")) or None,
                                                   bank_name=s(b.get("bankName")) or None, ifsc_code=s(b.get("ifscCode")).upper() or None, branch=s(b.get("branch")) or None,
                                                   is_primary=bool(b.get("isPrimary")) or i == 0)
    pt = d.get("paymentTerms") or d.get("paymentTerm")
    if isinstance(pt, dict) or "creditDays" in d or "paymentMode" in d:
        pt = pt if isinstance(pt, dict) else {}
        CustomerPaymentTerms.objects.filter(customer_id=c.pk).delete()
        CustomerPaymentTerms.objects.create(customer_id=c.pk, credit_days=int(pt.get("creditDays", d.get("creditDays")) or 0),
                                            credit_limit=Decimal(str(pt.get("creditLimit", d.get("creditLimit")) or 0)),
                                            payment_mode=s(pt.get("paymentMode", d.get("paymentMode"))) or None, notes=s(pt.get("notes")) or None)


def _cust_save(request, c):
    d = request.data; new = c.pk is None
    with transaction.atomic():
        for attr, key in (("name", "name"), ("company", "company"), ("phone", "phone"), ("email", "email"), ("city", "address")):
            if key in d or new: setattr(c, attr, s(d.get(key) if key in d else (d.get("city") if key == "address" else "")) or (None if attr != "name" else ""))
        if "gstNumber" in d or "taxNumber" in d or new: c.gst_number = s(d.get("gstNumber") or d.get("taxNumber")).upper() or None
        if "panNumber" in d or new: c.pan_number = s(d.get("panNumber")).upper() or None
        if "status" in d or new: c.status = (str(d.get("status") or "active").lower()) if str(d.get("status") or "active").lower() in ("active", "inactive", "blocked") else "active"
        if "creditLimit" in d or new: c.credit_limit = Decimal(str(d.get("creditLimit") or 0))
        if "outstandingBalance" in d and not new: pass
        if c.email: c.email = c.email.lower()
        if "customerCode" in d and s(d.get("customerCode")): c.customer_code = s(d["customerCode"]).upper()
        elif new: c.customer_code = next_code(Customers, "customer_code", "CUS-")
        if not s(c.name): raise ApiError("Customer name is required.", errors={"Name": ["Customer name is required."]})
        if c.email and not EMAIL_RE.match(c.email): raise ApiError("Please enter a valid email address.")
        if c.gst_number and not GST_RE.match(c.gst_number): raise ApiError("Please enter a valid GST number.")
        if c.pan_number and not PAN_RE.match(c.pan_number): raise ApiError("Please enter a valid PAN number.")
        dup = Customers.objects.exclude(pk=c.pk) if c.pk else Customers.objects.all()
        if c.customer_code and dup.filter(customer_code__iexact=c.customer_code).exists(): raise ApiError("Customer code already exists.", 409)
        if c.email and dup.filter(email__iexact=c.email).exists(): raise ApiError("A customer with this email already exists.", 409)
        if c.phone and dup.filter(phone=c.phone).exists(): raise ApiError("A customer with this phone number already exists.", 409)
        if new: c.created_at = utcnow(); c.outstanding_balance = Decimal("0")
        c.updated_at = utcnow(); c.save(); _cust_children(c, d)
        CustomerActivity.objects.create(customer_id=c.pk, activity_type="Created" if new else "Updated", description=f"Customer {'created' if new else 'updated'}", created_at=utcnow())
    log_audit(request, "Create" if new else "Update", "Customers", c.pk, f"Customer {'created' if new else 'updated'}: {c.name}", "customers")
    return Response({"success": True, "data": _cust_rows([c])[0], "message": f"Customer {'created' if new else 'updated'} successfully.", "errors": None}, status=201 if new else 200)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def customer_detail(request, pk):
    c = Customers.objects.filter(pk=pk).first()
    if not c: return fail("Customer was not found.", 404)
    if request.method == "GET": return ok(_cust_rows([c])[0])
    if request.method in ("PUT", "PATCH"): return _cust_save(request, c)
    if Invoices.objects.filter(customer_id=pk, is_deleted=False, is_cancelled=False).exists():
        return fail("This customer has invoices and cannot be deleted. Mark the customer inactive instead.")
    for m in (CustomerContacts, CustomerAddresses, CustomerBankDetails, CustomerPaymentTerms, CustomerActivity): m.objects.filter(customer_id=pk).delete()
    c.delete(); log_audit(request, "Delete", "Customers", pk, f"Customer deleted: {c.name}", "customers")
    return ok(None, "Customer deleted successfully.")


@api_view(["PATCH", "PUT"])
def customer_status(request, pk):
    c = Customers.objects.filter(pk=pk).first()
    if not c: return fail("Customer was not found.", 404)
    st = str(request.data.get("status") or "").lower()
    if st not in ("active", "inactive", "blocked"): return fail("Invalid status.")
    c.status = st; c.updated_at = utcnow(); c.save(update_fields=["status", "updated_at"])
    CustomerActivity.objects.create(customer_id=pk, activity_type="Status", description=f"Status changed to {st}", created_at=utcnow())
    return ok(_cust_rows([c])[0], "Customer status updated.")


@api_view(["GET"])
def customers_summary(request):
    from django.db.models import Sum
    total = Customers.objects.count(); cutoff = utcnow().replace(hour=0, minute=0) - __import__("datetime").timedelta(days=30)
    out = Customers.objects.aggregate(o=Sum("outstanding_balance"), l=Sum("credit_limit"))
    o, l = float(out["o"] or 0), float(out["l"] or 0)
    return ok({"totalCustomers": total, "activeCustomers": Customers.objects.filter(Q(status__isnull=True) | Q(status__iexact="active")).count(), "repeatCustomers": 0,
               "newCustomers": Customers.objects.filter(created_at__gte=cutoff).count(), "outstandingReceivables": o,
               "creditUtilization": round(o / l * 100, 2) if l > 0 else 0, "customerGrowth": 0})


@api_view(["GET"])
def customer_history(request, pk):
    return ok([to_dict(a, extra={"id": a.pk, "type": a.activity_type}) for a in CustomerActivity.objects.filter(customer_id=pk).order_by("-created_at")])
