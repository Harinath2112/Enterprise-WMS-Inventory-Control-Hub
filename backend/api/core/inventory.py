"""Stock engine: every stock change goes through adjust_stock() so Stock, StockLedger and StockMovements stay consistent."""
from decimal import Decimal

from django.db.models import Sum

from ..models import Products, Stock, StockLedger, StockMovements
from .fieldtypes import utcnow
from .response import ApiError


def _d(v):
    return Decimal(str(v if v not in (None, "") else 0))


def total_stock(product_id):
    return Stock.objects.filter(product_id=product_id, is_deleted=False).aggregate(t=Sum("quantity"))["t"] or Decimal("0")


def sync_product_stock(product_id):
    Products.objects.filter(pk=product_id).update(stock=int(total_stock(product_id)), updated_at=utcnow())


def get_stock_row(product_id, variant_id, warehouse_id, create=True):
    row = Stock.objects.filter(product_id=product_id, variant_id=variant_id, warehouse_id=warehouse_id, is_deleted=False).first()
    if not row and create:
        row = Stock(product_id=product_id, variant_id=variant_id, warehouse_id=warehouse_id, quantity=0, reserved_quantity=0,
                    is_deleted=False, created_at=utcnow(), updated_at=utcnow())
    return row


def adjust_stock(product_id, warehouse_id, delta, txn_type, *, variant_id=None, ref_id=None, ref_type=None, notes=None,
                 allow_negative=False):
    """Apply a signed quantity change. Returns the Stock row."""
    delta = _d(delta)
    if not warehouse_id:
        raise ApiError("A warehouse is required for stock movement.")
    row = get_stock_row(product_id, variant_id, warehouse_id)
    opening = _d(row.quantity)
    closing = opening + delta
    if closing < 0 and not allow_negative:
        name = Products.objects.filter(pk=product_id).values_list("name", flat=True).first() or f"product {product_id}"
        raise ApiError(f"Insufficient stock for {name}. Available: {opening}, requested: {abs(delta)}.")
    row.quantity = closing
    row.updated_at = utcnow()
    row.save()
    now = utcnow()
    StockLedger.objects.create(product_id=product_id, variant_id=variant_id, warehouse_id=warehouse_id, opening_qty=opening,
                               change_qty=delta, closing_qty=closing, transaction_type=txn_type, transaction_id=ref_id,
                               created_at=now, is_cancelled=False, is_deleted=False)
    StockMovements.objects.create(product_id=product_id, variant_id=variant_id, warehouse_id=warehouse_id, movement_type=txn_type,
                                  quantity=delta, reference_id=ref_id, reference_type=ref_type, notes=notes, created_at=now,
                                  is_cancelled=False, is_deleted=False)
    sync_product_stock(product_id)
    return row
