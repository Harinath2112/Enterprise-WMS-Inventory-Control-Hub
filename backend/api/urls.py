"""Route table. Paths are case-insensitive and tolerate a trailing slash, exactly like the ASP.NET Core API."""
import re

from django.urls import re_path
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny

from .core.response import ok
from .views import admin, auth, masters, parties, products, purchasing, reports, sales, stockops, system, warehouses

urlpatterns = []


def r(route, view):
    rx = re.sub(r"<int:(\w+)>", r"(?P<\1>\\d+)", route)
    rx = re.sub(r"<str:(\w+)>", r"(?P<\1>[^/]+)", rx)
    urlpatterns.append(re_path(rf"^api/(?i:{rx})/?$", view))


def crud(prefix, lst, det):
    r(prefix, lst.as_view())
    r(f"{prefix}/<int:pk>", det.as_view())


@api_view(["GET"])
def health(request):
    return ok({"status": "Healthy"})


health.cls.permission_classes = [AllowAny]
r("health", health)

# --- auth
for path, view in (("register", auth.register), ("login", auth.login), ("refresh-token", auth.refresh_token),
                   ("forgot-password", auth.forgot_password), ("reset-password", auth.reset_password), ("verify-email", auth.verify_email),
                   ("verify-otp", auth.verify_otp), ("verify-email-otp", auth.verify_email_otp), ("resend-login-otp", auth.resend_login_otp),
                   ("resend-verification", auth.resend_verification), ("claims", auth.claims)):
    r(f"auth/{path}", view)
r("auth/change-password/<int:user_id>", auth.change_password)
r("auth/logout/<int:user_id>", auth.logout)
r("auth/logout-all-devices/<int:user_id>", auth.logout_all_devices)

# --- profile
r("profile/me", admin.profile_me)
r("profile/upload-photo/<int:user_id>", admin.profile_photo)
r("profile/photo/<int:user_id>", admin.profile_photo_delete)
r("profile/logout/<int:user_id>", auth.logout)
r("profile/logout-all-devices/<int:user_id>", auth.logout_all_devices)
r("profile/<int:user_id>", admin.profile_detail)

# --- users, roles, permissions
r("users", admin.users); r("users/<int:pk>", admin.user_detail)
r("roles", admin.roles); r("roles/<int:pk>", admin.role_detail); r("roles/<int:pk>/status", admin.role_status)
r("permissions/roles", admin.permission_roles); r("permissions/role/<int:role_id>", admin.permissions_by_role)
r("permissions/my-permissions", admin.my_permissions); r("permissions/update", admin.update_permissions)
r("permissions/clone", admin.clone_permissions); r("permissions/reset/<int:role_id>", admin.reset_role_permissions)

# --- audit / login history / notifications
r("auditlogs", admin.audit_logs); r("auditlogs/module/<str:module>", admin.audit_logs_by_module)
r("auditlogs/user/<int:user_id>", admin.audit_logs_by_user)
r("loginhistory/current-session/<int:user_id>", admin.login_history_current); r("loginhistory/<int:user_id>", admin.login_history)
r("notifications", admin.notifications); r("notifications/unread-count", admin.notifications_unread)
r("notifications/<int:pk>/read", admin.notification_read); r("notifications/<int:pk>", admin.notification_delete)

# --- masters
crud("brands", masters.BrandList, masters.BrandDetail)
crud("units", masters.UnitList, masters.UnitDetail)
r("categories/main", masters.categories_main); r("categories/sub/<int:parent_id>", masters.categories_sub)
crud("categories", masters.CategoryList, masters.CategoryDetail)
crud("subcategories", masters.SubCategoryList, masters.SubCategoryDetail)
crud("attributes", masters.AttributeList, masters.AttributeDetail)
r("attribute-values/attribute/<int:attribute_id>", masters.attribute_values_by_attribute)
crud("attribute-values", masters.AttributeValueList, masters.AttributeValueDetail)
r("variant-attributes/variant/<int:variant_id>", masters.variant_attributes_by_variant)
crud("variant-attributes", masters.VariantAttrList, masters.VariantAttrDetail)
crud("productvariants", masters.VariantList, masters.VariantDetail)

# --- products & barcodes
r("products/full", products.products_full)
r("products/upload-image/<int:pk>", products.product_upload_image)
r("products/<int:pk>/delete-dependencies", products.product_dependencies)
r("products/<int:pk>/dependencies", products.product_dependencies)
r("products/<int:pk>", products.product_detail)
r("products", products.products)
r("barcode/generate", products.barcode_generate)
r("barcode", products.barcodes)

# --- suppliers
r("suppliers/ifsc/<str:code>", parties.supplier_ifsc)
r("suppliers/documents/<int:document_id>/download", parties.supplier_document_download)
r("suppliers/documents/<int:document_id>", parties.supplier_document_delete)
r("suppliers/<int:supplier_id>/documents/upload", parties.supplier_document_upload)
r("suppliers/<int:supplier_id>/documents/temp", parties.supplier_documents_temp)
r("suppliers/<int:supplier_id>/documents", parties.supplier_documents)
r("suppliers/<int:pk>/restore", parties.supplier_restore)
r("suppliers/<int:pk>", parties.supplier_detail)
r("suppliers", parties.suppliers)

# --- customers
r("customers/summary", parties.customers_summary)
r("customers/<int:pk>/history", parties.customer_history)
r("customers/<int:pk>/status", parties.customer_status)
r("customers/<int:pk>", parties.customer_detail)
r("customers", parties.customers)

# --- warehouses, racks, bins
r("warehouse-stats", warehouses.warehouse_summary)
r("warehouses/summary", warehouses.warehouse_summary)
r("warehouses/stock/from-grn/<int:grn_id>", warehouses.stock_from_grn)
r("warehouses/<int:pk>/details", warehouses.warehouse_details)
r("warehouses/<int:pk>/products", warehouses.warehouse_products)
r("warehouses/<int:pk>", warehouses.warehouse_detail)
r("warehouses", warehouses.warehouses)
crud("racks", warehouses.RackList, warehouses.RackDetail)
crud("bins", warehouses.BinList, warehouses.BinDetail)

# --- stock operations
crud("stock-ledger", stockops.LedgerList, stockops.LedgerDetail)
crud("stock-movements", stockops.MovementList, stockops.MovementDetail)
crud("stock-adjustment-items", stockops.AdjItemList, stockops.AdjItemDetail)
crud("stock-adjustments", stockops.AdjustmentList, stockops.AdjustmentDetail)
crud("stock-transfer-items", stockops.TransferItemList, stockops.TransferItemDetail)
crud("stock-transfers", stockops.TransferList, stockops.TransferDetail)
crud("stock-audit-items", stockops.AuditItemList, stockops.AuditItemDetail)
crud("stock-audits", stockops.AuditList, stockops.AuditDetail)
r("bin-stocks", stockops.bin_stocks)
r("bin-transfers", stockops.bin_transfers)
r("putaway-stock", stockops.putaway)
crud("stock", stockops.StockList, stockops.StockDetail)

# --- system settings, dashboard, search
for _path, _key in system.SECTIONS.items():
    _rules, _reset = system.make_section_views(_key)
    r(_path, _rules); r(f"{_path}/reset", _reset)
r("systemsettings", system.system_settings)
r("systemsettings/<int:pk>", system.system_settings_update)
r("systemsettings/upload-logo/<int:pk>", system.system_logo_upload)
r("systemsettings/remove-logo/<int:pk>", system.system_logo_remove)
r("dashboard/summary", system.dashboard_summary); r("dashboard/low-stock", system.dashboard_low_stock)
r("dashboard/recent-sales", system.dashboard_recent_sales); r("dashboard/top-products", system.dashboard_top_products)
r("dashboard/monthly-sales", system.dashboard_monthly_sales); r("dashboard/monthly-purchases", system.dashboard_monthly_purchases)
r("dashboard/recent-activities", system.dashboard_recent_activities)
r("search/global", system.search_global)

# --- purchasing
r("purchaseorders/<int:pk>/approve", purchasing.purchase_order_approve)
r("purchaseorders/<int:pk>/cancel", purchasing.purchase_order_cancel)
r("purchaseorders/<int:pk>", purchasing.purchase_order_detail)
r("purchaseorders", purchasing.purchase_orders)
r("goodsreceipts/by-po/<int:po_id>", purchasing.goods_receipts_by_po)
r("goodsreceipts/<int:grn_id>/return-items", purchasing.goods_receipt_return_items)
r("goodsreceipts/<int:pk>/reverse", purchasing.goods_receipt_reverse)
r("goodsreceipts/<int:pk>", purchasing.goods_receipt_detail)
r("goodsreceipts", purchasing.goods_receipts)
r("purchaseindents/dashboard", purchasing.purchase_indents_dashboard)
r("purchaseindents/<int:pk>/approve", purchasing.purchase_indent_approve)
r("purchaseindents/<int:pk>/reject", purchasing.purchase_indent_reject)
r("purchaseindents/<int:pk>/convert-po", purchasing.purchase_indent_convert)
r("purchaseindents/<int:pk>", purchasing.purchase_indent_detail)
r("purchaseindents", purchasing.purchase_indents)
r("purchasereturns/suppliers", purchasing.purchase_return_suppliers)
r("purchasereturns/grns", purchasing.purchase_return_grns)
r("purchasereturns/grn/<int:grn_id>/items", purchasing.purchase_return_grn_items)
for _a in ("submit", "approve", "reject", "complete"):
    r(f"purchasereturns/<int:pk>/{_a}", getattr(purchasing, f"purchase_return_{_a}"))
r("purchasereturns/<int:pk>", purchasing.purchase_return_detail)
r("purchasereturns", purchasing.purchase_returns)

# --- sales
r("invoices/<int:pk>/pdf", sales.invoice_pdf); r("invoices/<int:pk>/send-email", sales.invoice_send_email); r("invoices/<int:pk>/cancel", sales.invoice_cancel)
r("invoices/<int:pk>", sales.invoice_detail); r("invoices", sales.invoices)
r("customerpayments/<int:pk>/void", sales.customer_payment_void); r("customerpayments/<int:pk>", sales.customer_payment_detail); r("customerpayments", sales.customer_payments)
r("supplierpayments/<int:pk>/void", sales.supplier_payment_void); r("supplierpayments/<int:pk>", sales.supplier_payment_detail); r("supplierpayments", sales.supplier_payments)
r("salesreturns/customers/<int:customer_id>/invoices", sales.sales_return_customer_invoices)
r("salesreturns/invoices/<int:invoice_id>/items", sales.sales_return_invoice_items)
r("salesreturns/invoice-details/<int:invoice_id>", sales.sales_return_invoice_items)
r("salesreturns/returnable-invoices", sales.sales_return_returnable_invoices)
r("salesreturns/customers", sales.sales_return_customers)
for _a, _f in (("submit", "submit"), ("approve", "approve"), ("reject", "reject"), ("process-refund", "refund"), ("complete", "complete")):
    r(f"salesreturns/<int:pk>/{_a}", getattr(sales, f"sales_return_{_f}"))
r("salesreturns/<int:pk>", sales.sales_return_detail); r("salesreturns", sales.sales_returns)
r("goodsreceipts/<int:pk>/approve", purchasing.goods_receipt_approve)

# --- reports
for _p, _v in (("sales", "sales"), ("purchases", "purchases"), ("invoices", "invoices"), ("stock", "stock"), ("customer-balances", "customer_balances"),
               ("filters/warehouses", "f_warehouses"), ("filters/categories", "f_categories"), ("filters/products", "f_products"), ("filters/customers", "f_customers"),
               ("filters/suppliers", "f_suppliers"), ("transaction-trend", "transaction_trend"), ("stock-availability", "stock_availability"), ("top-customers", "top_customers"),
               ("top-suppliers", "top_suppliers"), ("customer-outstanding", "customer_outstanding"), ("supplier-outstanding", "supplier_outstanding"),
               ("inventory-valuation", "inventory_valuation"), ("low-stock", "low_stock"), ("fast-moving", "fast_moving"), ("slow-moving", "slow_moving"),
               ("profitability", "profitability"), ("gst-tax", "gst_tax"), ("forecasting", "forecasting"), ("warehouse-performance", "warehouse_performance"),
               ("summary", "summary"), ("returns", "returns_report"), ("exchanges", "empty_report"), ("damages", "empty_report"), ("credit-notes", "empty_report"),
               ("export-sales", "export_sales"), ("export-stock", "export_stock"), ("export-sales-pdf", "export_sales_pdf"), ("export-stock-pdf", "export_stock_pdf")):
    r(f"reports/{_p}", getattr(reports, _v))
