"""System settings (company profile + rule sections), dashboard and global search."""
import os
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings as dj
from django.db.models import Count, F, Q, Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.fieldtypes import utcnow
from ..core.response import ApiError, fail, ok
from ..core.serial import to_dict
from ..models import (AuditLogs, Brands, Categories, Customers, InvoiceItems, Invoices, Products, PurchaseOrders, Stock, SubCategories,
                      Suppliers, SystemSettingRules, SystemSettingSections, SystemSettings, Users, Warehouses)

SECTIONS = {"product-rules": "product_rules", "purchase-goods-receipt": "purchase_goods_receipt", "sales-invoice": "sales_invoice",
            "return-refund": "return_refund", "tax-billing": "tax_billing", "advanced-stock-control": "advanced_stock_control",
            "warehouse-bin-rack": "warehouse_bin_rack", "audit-log-rules": "audit_log_rules", "report-export": "report_export",
            "system-security-policy": "system_security_policy", "integration-settings": "integration_settings"}


def _section(key):
    sec = SystemSettingSections.objects.filter(section_key=key, is_active=True).first()
    if not sec:
        raise ApiError("Settings section not found.", 404)
    return sec


def _rule(r):
    return {"ruleId": r.rule_id, "ruleKey": r.rule_key, "ruleName": r.rule_name, "ruleDescription": r.rule_description, "ruleType": r.rule_type,
            "ruleValue": r.rule_value, "defaultValue": r.default_value, "isEnabled": bool(r.is_enabled), "displayOrder": r.display_order}


def make_section_views(key):
    @api_view(["GET", "PUT"])
    def rules(request):
        sec = _section(key)
        if request.method == "PUT":
            items = request.data if isinstance(request.data, list) else request.data.get("rules", [])
            by_id = {r.rule_id: r for r in SystemSettingRules.objects.filter(section_id=sec.section_id)}
            for it in items:
                r = by_id.get(it.get("ruleId"))
                if r:
                    r.rule_value = it.get("ruleValue"); r.is_enabled = bool(it.get("isEnabled")); r.updated_at = utcnow(); r.save()
            log_audit(request, "Update", "System Settings", sec.section_id, f"{sec.section_name} updated", "system_setting_rules")
            return Response({"message": f"{sec.section_name} updated successfully."})
        rs = list(SystemSettingRules.objects.filter(section_id=sec.section_id).order_by("display_order"))
        return Response({"sectionId": sec.section_id, "sectionKey": sec.section_key, "sectionName": sec.section_name, "ruleCount": len(rs),
                         "enabledCount": sum(1 for r in rs if r.is_enabled), "rules": [_rule(r) for r in rs]})

    @api_view(["POST"])
    def reset(request):
        sec = _section(key)
        for r in SystemSettingRules.objects.filter(section_id=sec.section_id):
            r.rule_value = r.default_value if r.rule_type != "toggle" else None
            r.is_enabled = (str(r.default_value).lower() == "true") if r.rule_type == "toggle" else True
            r.updated_at = utcnow(); r.save()
        return Response({"message": f"{sec.section_name} reset to defaults."})
    return rules, reset


def rule_value(section_key, rule_key, default=None):
    """Read one configured rule (used by business logic, e.g. negative stock)."""
    r = SystemSettingRules.objects.filter(section__isnull=False, rule_key=rule_key).first() if False else None
    sec = SystemSettingSections.objects.filter(section_key=section_key).first()
    if not sec:
        return default
    r = SystemSettingRules.objects.filter(section_id=sec.section_id, rule_key=rule_key).first()
    if not r:
        return default
    return r.is_enabled if r.rule_type == "toggle" else (r.rule_value if r.rule_value not in (None, "") else default)


def _ensure_settings():
    row = SystemSettings.objects.first()
    if not row:
        row = SystemSettings.objects.create(company_name="IMS", currency="INR", timezone="Asia/Kolkata", invoice_prefix="INV", invoice_start_number=1,
                                            created_at=utcnow(), default_reorder_level=10, stock_valuation_method="FIFO", enable_audit_logs=True,
                                            audit_retention_days=365, theme_mode="dark", language="en")
    return row


@api_view(["GET"])
def system_settings(request):
    row = _ensure_settings()
    return Response(to_dict(row, extra={"id": row.pk}))


@api_view(["PUT", "PATCH"])
def system_settings_update(request, pk):
    row = SystemSettings.objects.filter(pk=pk).first() or _ensure_settings()
    from ..core.serial import apply_payload
    apply_payload(row, request.data, exclude=("settingId", "createdAt", "companyLogo"))
    row.save()
    log_audit(request, "Update", "System Settings", row.pk, "System settings updated", "system_settings")
    return Response({"success": True, "message": "Settings updated successfully.", "data": to_dict(row)})


@api_view(["POST"])
def system_logo_upload(request, pk):
    row = SystemSettings.objects.filter(pk=pk).first() or _ensure_settings()
    f = request.FILES.get("file") or request.FILES.get("logo") or next(iter(request.FILES.values()), None)
    if not f: return fail("No file was uploaded.")
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".svg"): return fail("Only JPG, PNG, WEBP or SVG images are allowed.")
    folder = dj.MEDIA_ROOT / "companylogos"; folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    with open(folder / name, "wb") as out:
        for c in f.chunks(): out.write(c)
    row.company_logo = f"/companylogos/{name}"; row.save(update_fields=["company_logo"])
    return Response({"success": True, "companyLogo": row.company_logo, "message": "Logo uploaded successfully."})


@api_view(["DELETE"])
def system_logo_remove(request, pk):
    SystemSettings.objects.filter(pk=pk).update(company_logo=None)
    return Response({"success": True, "message": "Logo removed."})


# ------------------------------------------------------------------ dashboard
def inventory_rows():
    """[(product, current_stock)] for non-deleted, non-archived active products."""
    prods = list(Products.objects.filter(is_deleted=False, is_archived=False).exclude(status__iexact="inactive"))
    stock = {r["product_id"]: float(r["t"] or 0) for r in Stock.objects.filter(is_deleted=False).values("product_id").annotate(t=Sum("quantity"))}
    default = dj.LOW_STOCK_THRESHOLD
    out = []
    for p in prods:
        level = p.reorder_level if p.reorder_level not in (None, 0) else default
        out.append((p, stock.get(p.pk, 0.0), level))
    return out


def low_stock_list():
    rows = [(p, s, lvl) for p, s, lvl in inventory_rows() if s <= lvl]
    rows.sort(key=lambda x: (x[1], x[0].name))
    return rows


@api_view(["GET"])
def dashboard_summary(request):
    low = low_stock_list(); out_ = sum(1 for _, s, _ in low if s <= 0); lowc = sum(1 for _, s, _ in low if s > 0)
    status = "Healthy" if not low else ("Critical" if out_ else "Attention")
    return ok({"totalProducts": Products.objects.filter(is_deleted=False).count(), "totalCustomers": Customers.objects.count(),
               "totalSuppliers": Suppliers.objects.count(),
               "totalSales": float(Invoices.objects.filter(is_cancelled=False).aggregate(t=Sum("total_amount"))["t"] or 0),
               "totalPurchases": float(PurchaseOrders.objects.filter(is_cancelled=False).aggregate(t=Sum("total_amount"))["t"] or 0),
               "lowStockProducts": lowc, "outOfStockProducts": out_, "inventoryHealthStatus": status,
               "inventoryHealthTone": "success" if not low else "danger",
               "inventoryHealthMessage": "Operations Healthy" if not low else "Inventory Attention Required"})


@api_view(["GET"])
def dashboard_low_stock(request):
    return ok([{"stockId": p.pk, "productId": p.pk, "name": p.name, "sku": p.sku, "quantity": s, "currentStock": s, "reorderLevel": lvl,
                "reservedQuantity": 0, "availableQuantity": s, "status": "Out of Stock" if s <= 0 else "Low Stock"} for p, s, lvl in low_stock_list()])


@api_view(["GET"])
def dashboard_recent_sales(request):
    rows = list(Invoices.objects.filter(is_cancelled=False).order_by("-invoice_date", "-invoice_id")[:10])
    names = {c.pk: c.name for c in Customers.objects.filter(pk__in={r.customer_id for r in rows})}
    return ok([{"invoiceId": r.invoice_id, "invoiceNumber": r.invoice_number, "invoiceDate": r.invoice_date.isoformat() if r.invoice_date else None,
                "customerName": names.get(r.customer_id), "totalAmount": float(r.total_amount or 0), "paidAmount": float(r.paid_amount or 0),
                "balanceAmount": float(r.balance_amount or 0), "status": r.status} for r in rows])


@api_view(["GET"])
def dashboard_top_products(request):
    rows = (InvoiceItems.objects.filter(invoice_id__in=Invoices.objects.filter(is_cancelled=False).values("invoice_id"))
            .values("product_id").annotate(sold=Sum("quantity"), revenue=Sum("total")).order_by("-revenue")[:10])
    prods = {p.pk: p for p in Products.objects.filter(pk__in=[r["product_id"] for r in rows], is_deleted=False)}
    return ok([{"productId": r["product_id"], "name": prods[r["product_id"]].name, "sku": prods[r["product_id"]].sku, "totalSold": float(r["sold"] or 0),
                "revenue": float(r["revenue"] or 0)} for r in rows if r["product_id"] in prods])


def _monthly(model, date_attr, amount_attr, key_total, key_count, last_n=12):
    buckets = {}
    for o in model.objects.filter(**{f"{date_attr}__isnull": False, "is_cancelled": False}):
        d = getattr(o, date_attr); k = (d.year, d.month)
        b = buckets.setdefault(k, [0.0, 0]); b[0] += float(getattr(o, amount_attr) or 0); b[1] += 1
    keys = sorted(buckets)[-last_n:]
    import calendar
    return [{"year": y, "month": m, "monthLabel": f"{calendar.month_abbr[m]} {y}", key_total: buckets[(y, m)][0], key_count: buckets[(y, m)][1]} for y, m in keys]


@api_view(["GET"])
def dashboard_monthly_sales(request):
    rows = _monthly(Invoices, "invoice_date", "total_amount", "totalSales", "totalInvoices")
    return Response({"success": True, "monthlySales": rows, "data": rows, "message": None})


@api_view(["GET"])
def dashboard_monthly_purchases(request):
    return ok(_monthly(PurchaseOrders, "order_date", "total_amount", "totalPurchases", "totalOrders"))


@api_view(["GET"])
def dashboard_recent_activities(request):
    rows = list(AuditLogs.objects.order_by("-created_at", "-log_id")[:10]); users = {u.pk: u.name for u in Users.objects.filter(pk__in={r.user_id for r in rows})}
    return ok([{"id": r.log_id, "action": r.action, "module": r.module, "description": r.description, "userName": users.get(r.user_id) or "System",
                "createdAt": (r.created_at.isoformat() + "Z") if r.created_at else None} for r in rows])


# ------------------------------------------------------------------ global search
@api_view(["GET"])
def search_global(request):
    q = (request.query_params.get("query") or request.query_params.get("q") or "").strip()
    if len(q) < 2:
        return ok([])
    out = []
    def add(type_, qs, title, sub, route, icon):
        for o in qs[:5]:
            out.append({"type": type_, "id": o.pk, "title": title(o), "subtitle": sub(o), "route": route, "icon": icon})
    add("Product", Products.objects.filter(is_deleted=False).filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q)), lambda o: o.name, lambda o: f"SKU: {o.sku}", "/inventory/products", "package")
    add("Customer", Customers.objects.filter(Q(name__icontains=q) | Q(customer_code__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q)), lambda o: o.name, lambda o: o.email or o.phone, "/masters/customers", "users")
    add("Supplier", Suppliers.objects.filter(is_deleted=False).filter(Q(name__icontains=q) | Q(supplier_code__icontains=q) | Q(email__icontains=q)), lambda o: o.name, lambda o: o.email or o.phone, "/masters/suppliers", "truck")
    add("Brand", Brands.objects.filter(is_deleted=False, name__icontains=q), lambda o: o.name, lambda o: "Brand", "/masters/brands", "tag")
    add("Category", Categories.objects.filter(is_deleted=False, name__icontains=q), lambda o: o.name, lambda o: "Category", "/masters/categories", "folder")
    add("SubCategory", SubCategories.objects.filter(is_deleted=False, name__icontains=q), lambda o: o.name, lambda o: "Sub-category", "/masters/subcategories", "folder")
    add("Warehouse", Warehouses.objects.filter(is_deleted=False).filter(Q(name__icontains=q) | Q(warehouse_code__icontains=q)), lambda o: o.name, lambda o: o.location, "/management/warehouses", "warehouse")
    add("Invoice", Invoices.objects.filter(is_deleted=False, invoice_number__icontains=q), lambda o: o.invoice_number, lambda o: o.status, "/pos/invoices", "receipt")
    add("Purchase Order", PurchaseOrders.objects.filter(is_deleted=False, po_number__icontains=q), lambda o: o.po_number, lambda o: o.status, "/inventory/purchase-orders", "file")
    return ok(out)
