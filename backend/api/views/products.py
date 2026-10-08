"""Products (+variants, image upload, dependencies) and barcodes."""
import math
import os
import random
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..core.audit import log_audit
from ..core.fieldtypes import utcnow
from ..core.inventory import adjust_stock, total_stock
from ..core.response import ApiError, fail, ok
from ..core.serial import apply_payload, lookup, to_dict
from ..models import (Barcodes, Brands, Categories, GoodsReceiptItems, InvoiceItems, ProductImages, ProductVariants, Products,
                      PurchaseOrderItems, Stock, SubCategories, Suppliers, Units, VariantAttributeValues, Warehouses, Attributes, AttributeValues)


def _names(model, ids, attr="name"):
    ids = {i for i in ids if i}
    return {o.pk: getattr(o, attr) for o in model.objects.filter(pk__in=ids)} if ids else {}


def product_rows(products):
    products = list(products)
    ids = [p.pk for p in products]
    cat = _names(Categories, [p.category_id for p in products]); sub = _names(SubCategories, [p.sub_category_id for p in products])
    brd = _names(Brands, [p.brand_id for p in products]); unt = _names(Units, [p.unit_id for p in products])
    sup = _names(Suppliers, [p.supplier_id for p in products]); wh = _names(Warehouses, [p.warehouse_id for p in products])
    stock = {r["product_id"]: r["t"] for r in Stock.objects.filter(product_id__in=ids, is_deleted=False).values("product_id").annotate(t=Sum("quantity"))}
    out = []
    for p in products:
        d = to_dict(p, exclude=("isDeleted",))
        d.update({"productId": p.pk, "sku": p.sku, "categoryName": cat.get(p.category_id), "subCategoryName": sub.get(p.sub_category_id),
                  "brandName": brd.get(p.brand_id), "unitName": unt.get(p.unit_id), "supplierName": sup.get(p.supplier_id),
                  "warehouseName": wh.get(p.warehouse_id), "stock": float(stock.get(p.pk, 0) or 0), "imageUrl": p.image_url})
        out.append(d)
    return out


def _clean_sku(v):
    return " ".join(str(v or "").split()).upper()


def _validate(data, pid=None):
    name = " ".join(str(lookup(data, "name")[1] or "").split())
    sku = _clean_sku(lookup(data, "sku")[1])
    if not name: raise ApiError("Product name is required.", errors={"Name": ["Product name is required."]})
    if not sku: raise ApiError("SKU is required.", errors={"SKU": ["SKU is required."]})
    for key, label in (("price", "Selling price"), ("costPrice", "Purchase price"), ("stock", "Stock"), ("reorderLevel", "Reorder level")):
        ok_, v = lookup(data, key)
        if ok_ and v not in (None, ""):
            try:
                if float(v) < 0: raise ApiError(f"{label} cannot be negative.")
            except (TypeError, ValueError):
                raise ApiError(f"{label} must be a number.")
    q = Products.objects.filter(sku__iexact=sku, is_deleted=False)
    if pid: q = q.exclude(pk=pid)
    if q.exists(): raise ApiError("A product with this SKU already exists.", 409)
    return name, sku


def _save_variants(product, variants):
    for v in variants or []:
        vname = " ".join(str(v.get("variantName") or v.get("name") or "").split())
        if not vname: continue
        base = Decimal(str(product.price or 0)); delta = Decimal(str(v.get("priceDelta") or 0))
        var = ProductVariants.objects.create(product_id=product.pk, variant_name=vname, sku=_clean_sku(v.get("sku")) or None,
                                             price=Decimal(str(v["price"])) if v.get("price") not in (None, "") else base + delta,
                                             cost_price=Decimal(str(v["costPrice"])) if v.get("costPrice") not in (None, "") else product.cost_price)
        for a in v.get("attributes") or []:
            aid = a.get("attributeId"); vid = a.get("valueId") or a.get("attributeValueId")
            if aid: VariantAttributeValues.objects.create(variant_id=var.pk, attribute_id=int(aid), value_id=int(vid) if vid else None)


@api_view(["GET", "POST"])
def products(request):
    if request.method == "POST":
        return _create(request)
    qp = request.query_params
    page = max(int(qp.get("page", 1) or 1), 1); size = min(max(int(qp.get("pageSize", 100) or 100), 1), 100)
    q = Products.objects.filter(is_deleted=False)
    arch = qp.get("isArchived", "false").lower()
    if arch in ("true", "false"): q = q.filter(is_archived=(arch == "true"))
    term = (qp.get("search") or "").strip()
    if term: q = q.filter(Q(name__icontains=term) | Q(sku__icontains=term) | Q(barcode__icontains=term))
    for key, attr in (("categoryId", "category_id"), ("brandId", "brand_id"), ("supplierId", "supplier_id"), ("warehouseId", "warehouse_id")):
        if qp.get(key): q = q.filter(**{attr: qp.get(key)})
    if qp.get("status"): q = q.filter(status__iexact=qp.get("status"))
    sort = {"name": "name", "price": "price", "sku": "sku"}.get((qp.get("sortBy") or "").lower(), "product_id")
    q = q.order_by(("" if (qp.get("sortOrder") or "desc").lower() == "asc" else "-") + sort)
    total = q.count()
    rows = product_rows(q[(page - 1) * size: page * size])
    return Response({"page": page, "pageSize": size, "totalRecords": total, "totalPages": math.ceil(total / size) if total else 0, "data": rows})


def _create(request):
    d = request.data
    name, sku = _validate(d)
    with transaction.atomic():
        p = Products(created_at=utcnow(), updated_at=utcnow(), is_deleted=False, is_archived=False)
        apply_payload(p, d, exclude=("productId", "stock", "createdAt", "updatedAt", "isDeleted"))
        p.name, p.sku = name, sku
        p.status = str(p.status or "active").lower()
        p.stock = 0
        if not p.barcode: p.barcode = f"BAR-{utcnow():%Y%m%d}-{random.randint(100000, 999999)}"
        if Products.objects.filter(barcode=p.barcode, is_deleted=False).exists(): raise ApiError("This barcode is already used by another product.", 409)
        p.save()
        _save_variants(p, d.get("variants"))
        opening = lookup(d, "stock")[1]
        if opening not in (None, "") and float(opening) > 0:
            wh = p.warehouse_id or (Warehouses.objects.filter(is_deleted=False).order_by("warehouse_id").values_list("warehouse_id", flat=True).first())
            if not wh: raise ApiError("A warehouse is required to record opening stock.")
            p.warehouse_id = wh; p.save(update_fields=["warehouse_id"])
            adjust_stock(p.pk, wh, opening, "OpeningStock", ref_id=p.pk, ref_type="Product", notes="Opening stock")
    log_audit(request, "Create", "Products", p.pk, f"Product created: {p.name} ({p.sku})", "products")
    return Response({"success": True, "data": product_rows([p])[0], "message": "Product created successfully.", "errors": None}, status=201)


@api_view(["POST"])
def products_full(request):
    return _create(request)


def _detail(p):
    row = product_rows([p])[0]
    variants = list(ProductVariants.objects.filter(product_id=p.pk))
    attrs = _names(Attributes, [a.attribute_id for a in VariantAttributeValues.objects.filter(variant_id__in=[v.pk for v in variants])])
    vals = {v.pk: v.value for v in AttributeValues.objects.all()}
    links = {}
    for a in VariantAttributeValues.objects.filter(variant_id__in=[v.pk for v in variants]):
        links.setdefault(a.variant_id, []).append({"attributeId": a.attribute_id, "attributeName": attrs.get(a.attribute_id), "valueId": a.value_id, "value": vals.get(a.value_id)})
    row["variants"] = [to_dict(v, extra={"attributes": links.get(v.pk, [])}) for v in variants]
    row["images"] = [to_dict(i) for i in ProductImages.objects.filter(product_id=p.pk)]
    return row


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def product_detail(request, pk):
    p = Products.objects.filter(pk=pk, is_deleted=False).first()
    if not p: return fail("Product was not found.", 404)
    if request.method == "GET":
        return Response({"success": True, "data": _detail(p), "message": None, "errors": None})
    if request.method == "DELETE":
        if InvoiceItems.objects.filter(product_id=pk).exists() or PurchaseOrderItems.objects.filter(product_id=pk).exists() or GoodsReceiptItems.objects.filter(product_id=pk).exists():
            if request.query_params.get("archive") == "true" or request.query_params.get("force") != "true":
                p.is_archived = True; p.status = "archived"; p.updated_at = utcnow(); p.save()
                log_audit(request, "Archive", "Products", pk, f"Product archived (has transactions): {p.name}", "products")
                return ok(None, "This product has transactions, so it was archived instead of deleted.")
        p.is_deleted = True; p.updated_at = utcnow(); p.save()
        log_audit(request, "Delete", "Products", pk, f"Product deleted: {p.name}", "products")
        return ok(None, "Product deleted successfully.")
    d = request.data
    partial = request.method == "PATCH"
    if not partial or "name" in d or "sku" in d:
        merged = {"name": p.name, "sku": p.sku, **{k: v for k, v in d.items()}}
        name, sku = _validate(merged, pk)
    else:
        name, sku = p.name, p.sku
    with transaction.atomic():
        apply_payload(p, d, exclude=("productId", "stock", "createdAt", "isDeleted", "barcode") if "barcode" not in d else ("productId", "stock", "createdAt", "isDeleted"))
        p.name, p.sku, p.updated_at = name, sku, utcnow()
        p.status = str(p.status or "active").lower()
        if "isArchived" in d and not d["isArchived"] and p.status == "archived": p.status = "active"
        p.save()
        if isinstance(d.get("variants"), list):
            keep = {v.get("variantId") for v in d["variants"] if v.get("variantId")}
            for old in ProductVariants.objects.filter(product_id=pk).exclude(pk__in=keep):
                VariantAttributeValues.objects.filter(variant_id=old.pk).delete(); old.delete()
            _save_variants(p, [v for v in d["variants"] if not v.get("variantId")])
    log_audit(request, "Update", "Products", pk, f"Product updated: {p.name}", "products")
    return Response({"success": True, "data": _detail(p), "message": "Product updated successfully.", "errors": None})


@api_view(["GET"])
def product_dependencies(request, pk):
    return ok({"invoices": InvoiceItems.objects.filter(product_id=pk).count(), "purchaseOrders": PurchaseOrderItems.objects.filter(product_id=pk).count(),
               "goodsReceipts": GoodsReceiptItems.objects.filter(product_id=pk).count(), "stockQuantity": float(total_stock(pk)),
               "variants": ProductVariants.objects.filter(product_id=pk).count()})


@api_view(["POST"])
def product_upload_image(request, pk):
    p = Products.objects.filter(pk=pk, is_deleted=False).first()
    if not p: return fail("Product was not found.", 404)
    f = request.FILES.get("file") or request.FILES.get("image") or next(iter(request.FILES.values()), None)
    if not f: return fail("No image file was uploaded.")
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"): return fail("Only JPG, PNG, WEBP or GIF images are allowed.")
    if f.size > 10 * 1024 * 1024: return fail("Image must be 10 MB or smaller.")
    folder = settings.MEDIA_ROOT / "uploads" / "products"; folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    with open(folder / name, "wb") as out:
        for chunk in f.chunks(): out.write(chunk)
    p.image_url = f"/uploads/products/{name}"; p.updated_at = utcnow(); p.save(update_fields=["image_url", "updated_at"])
    return ok({"imageUrl": p.image_url}, "Image uploaded successfully.")


# ---------------------------------------------------------------- barcodes
def _barcode_row(b, names):
    return to_dict(b, extra={"id": b.pk, "productName": names.get(b.product_id), "value": b.code_value, "code": b.code_value, "date": b.created_at.isoformat() if b.created_at else None})


@api_view(["GET"])
def barcodes(request):
    rows = list(Barcodes.objects.order_by("-barcode_id"))
    names = _names(Products, [b.product_id for b in rows])
    return ok([_barcode_row(b, names) for b in rows])


@api_view(["POST"])
def barcode_generate(request):
    pid = request.query_params.get("productId") or request.data.get("productId")
    p = Products.objects.filter(pk=pid, is_deleted=False).first() if pid else None
    if not p: return fail("Product was not found.", 404)
    ctype = request.data.get("codeType") or request.query_params.get("codeType") or "Barcode"
    value = p.barcode or f"BAR-{utcnow():%Y%m%d}-{random.randint(100000, 999999)}"
    if str(ctype).lower().startswith("qr"): value = f"QR:{p.sku}:{p.pk}"
    b = Barcodes.objects.create(product_id=p.pk, code_value=value, code_type=ctype, created_at=utcnow())
    if not p.barcode: Products.objects.filter(pk=p.pk).update(barcode=value)
    return ok(_barcode_row(b, {p.pk: p.name}), "Barcode generated successfully.", 201)
