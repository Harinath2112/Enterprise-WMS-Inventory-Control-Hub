"""AUTO-GENERATED from the imsdatabase MySQL schema (see tools/gen_models.py). Maps every table 1:1 so the
existing database works unchanged. Python attributes are snake_case; the real column names are kept via
db_column, and the JSON API uses camelCase of the column name (same contract as the original backend)."""
from decimal import Decimal
from django.db import models
from django.db.models import F
from .core.fieldtypes import BitBooleanField, MANAGED, utcnow, today

TABLE_MODELS = {}

class AttributeValues(models.Model):
    value_id = models.AutoField(db_column='value_id', primary_key=True)
    attribute_id = models.IntegerField(db_column='attribute_id', null=True, blank=True, default=None)
    value = models.CharField(db_column='value', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'attribute_values'
        managed = MANAGED

TABLE_MODELS['attribute_values'] = AttributeValues

class Attributes(models.Model):
    attribute_id = models.AutoField(db_column='attribute_id', primary_key=True)
    name = models.CharField(db_column='name', max_length=100, default='')

    class Meta:
        db_table = 'attributes'
        managed = MANAGED

TABLE_MODELS['attributes'] = Attributes

class AuditLogs(models.Model):
    log_id = models.AutoField(db_column='log_id', primary_key=True)
    user_id = models.IntegerField(db_column='user_id', null=True, blank=True, default=None)
    action = models.CharField(db_column='action', max_length=100, null=True, blank=True, default=None)
    module = models.CharField(db_column='module', max_length=100, null=True, blank=True, default=None)
    record_id = models.IntegerField(db_column='record_id', null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    table_name = models.CharField(db_column='table_name', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'audit_logs'
        managed = MANAGED

TABLE_MODELS['audit_logs'] = AuditLogs

class Barcodes(models.Model):
    barcode_id = models.AutoField(db_column='barcode_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    code_value = models.CharField(db_column='code_value', max_length=255, null=True, blank=True, default=None)
    code_type = models.CharField(db_column='code_type', max_length=50, null=True, blank=True, default=None)
    image_url = models.TextField(db_column='image_url', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'barcodes'
        managed = MANAGED

TABLE_MODELS['barcodes'] = Barcodes

class BinStock(models.Model):
    bin_stock_id = models.AutoField(db_column='bin_stock_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    bin_id = models.IntegerField(db_column='bin_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))

    class Meta:
        db_table = 'bin_stock'
        managed = MANAGED

TABLE_MODELS['bin_stock'] = BinStock

class BinTransferAudits(models.Model):
    bin_transfer_audit_id = models.AutoField(db_column='bin_transfer_audit_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', default=0)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', default=0)
    from_bin_id = models.IntegerField(db_column='from_bin_id', default=0)
    to_bin_id = models.IntegerField(db_column='to_bin_id', default=0)
    quantity = models.DecimalField(db_column='quantity', max_digits=18, decimal_places=2, default=Decimal('0'))
    user_id = models.IntegerField(db_column='user_id', null=True, blank=True, default=None)
    user_name = models.CharField(db_column='user_name', max_length=255, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)

    class Meta:
        db_table = 'bin_transfer_audits'
        managed = MANAGED

TABLE_MODELS['bin_transfer_audits'] = BinTransferAudits

class Bins(models.Model):
    bin_id = models.AutoField(db_column='bin_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    rack_id = models.IntegerField(db_column='rack_id', null=True, blank=True, default=None)
    bin_code = models.CharField(db_column='bin_code', max_length=50, null=True, blank=True, default=None)
    capacity = models.DecimalField(db_column='capacity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='active')

    class Meta:
        db_table = 'bins'
        managed = MANAGED

TABLE_MODELS['bins'] = Bins

class Brands(models.Model):
    brand_id = models.AutoField(db_column='brand_id', primary_key=True)
    name = models.CharField(db_column='name', max_length=150, default='')
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'brands'
        managed = MANAGED

TABLE_MODELS['brands'] = Brands

class Categories(models.Model):
    category_id = models.AutoField(db_column='category_id', primary_key=True)
    name = models.CharField(db_column='name', max_length=150, default='')
    parent_id = models.IntegerField(db_column='parent_id', null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'categories'
        managed = MANAGED

TABLE_MODELS['categories'] = Categories

class CustomerActivity(models.Model):
    activity_id = models.AutoField(db_column='activity_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    activity_type = models.CharField(db_column='activity_type', max_length=50, null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'customer_activity'
        managed = MANAGED

TABLE_MODELS['customer_activity'] = CustomerActivity

class CustomerAddresses(models.Model):
    address_id = models.AutoField(db_column='address_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    address_type = models.CharField(db_column='address_type', max_length=64, null=True, blank=True, default='billing')
    address_line = models.TextField(db_column='address_line', null=True, blank=True, default=None)
    city = models.CharField(db_column='city', max_length=100, null=True, blank=True, default=None)
    state = models.CharField(db_column='state', max_length=100, null=True, blank=True, default=None)
    country = models.CharField(db_column='country', max_length=100, null=True, blank=True, default=None)
    pincode = models.CharField(db_column='pincode', max_length=20, null=True, blank=True, default=None)
    address_line2 = models.CharField(db_column='address_line2', max_length=255, null=True, blank=True, default=None)
    is_primary = models.BooleanField(db_column='is_primary', default=False)

    class Meta:
        db_table = 'customer_addresses'
        managed = MANAGED

TABLE_MODELS['customer_addresses'] = CustomerAddresses

class CustomerBankDetails(models.Model):
    bank_id = models.AutoField(db_column='bank_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    account_name = models.CharField(db_column='account_name', max_length=150, null=True, blank=True, default=None)
    account_number = models.CharField(db_column='account_number', max_length=50, null=True, blank=True, default=None)
    bank_name = models.CharField(db_column='bank_name', max_length=150, null=True, blank=True, default=None)
    ifsc_code = models.CharField(db_column='ifsc_code', max_length=20, null=True, blank=True, default=None)
    branch = models.CharField(db_column='branch', max_length=100, null=True, blank=True, default=None)
    is_primary = models.BooleanField(db_column='is_primary', default=False)

    class Meta:
        db_table = 'customer_bank_details'
        managed = MANAGED

TABLE_MODELS['customer_bank_details'] = CustomerBankDetails

class CustomerContacts(models.Model):
    contact_id = models.AutoField(db_column='contact_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    name = models.CharField(db_column='name', max_length=150, null=True, blank=True, default=None)
    designation = models.CharField(db_column='designation', max_length=100, null=True, blank=True, default=None)
    phone = models.CharField(db_column='phone', max_length=20, null=True, blank=True, default=None)
    email = models.CharField(db_column='email', max_length=150, null=True, blank=True, default=None)
    is_primary = models.BooleanField(db_column='is_primary', null=True, blank=True, default=False)
    role = models.CharField(db_column='role', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'customer_contacts'
        managed = MANAGED

TABLE_MODELS['customer_contacts'] = CustomerContacts

class CustomerLedger(models.Model):
    ledger_id = models.AutoField(db_column='ledger_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    transaction_type = models.CharField(db_column='transaction_type', max_length=64, null=True, blank=True, default=None)
    transaction_id = models.IntegerField(db_column='transaction_id', null=True, blank=True, default=None)
    debit = models.DecimalField(db_column='debit', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    credit = models.DecimalField(db_column='credit', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    balance = models.DecimalField(db_column='balance', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'customer_ledger'
        managed = MANAGED

TABLE_MODELS['customer_ledger'] = CustomerLedger

class CustomerPaymentTerms(models.Model):
    term_id = models.AutoField(db_column='term_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    credit_days = models.IntegerField(db_column='credit_days', null=True, blank=True, default=0)
    credit_limit = models.DecimalField(db_column='credit_limit', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    payment_mode = models.CharField(db_column='payment_mode', max_length=50, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    payment_method = models.CharField(db_column='payment_method', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'customer_payment_terms'
        managed = MANAGED

TABLE_MODELS['customer_payment_terms'] = CustomerPaymentTerms

class CustomerPayments(models.Model):
    payment_id = models.AutoField(db_column='payment_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', null=True, blank=True, default=None)
    invoice_id = models.IntegerField(db_column='invoice_id', null=True, blank=True, default=None)
    amount = models.DecimalField(db_column='amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    payment_date = models.DateTimeField(db_column='payment_date', null=True, blank=True, default=None)
    payment_method = models.CharField(db_column='payment_method', max_length=50, null=True, blank=True, default=None)
    reference_number = models.CharField(db_column='reference_number', max_length=100, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.TextField(db_column='cancellation_reason', null=True, blank=True, default=None)

    class Meta:
        db_table = 'customer_payments'
        managed = MANAGED

TABLE_MODELS['customer_payments'] = CustomerPayments

class Customers(models.Model):
    customer_id = models.AutoField(db_column='customer_id', primary_key=True)
    customer_code = models.CharField(db_column='customer_code', max_length=50, null=True, blank=True, default=None)
    name = models.CharField(db_column='name', max_length=255, default='')
    gst_number = models.CharField(db_column='gst_number', max_length=50, null=True, blank=True, default=None)
    pan_number = models.CharField(db_column='pan_number', max_length=20, null=True, blank=True, default=None)
    phone = models.CharField(db_column='phone', max_length=20, null=True, blank=True, default=None)
    email = models.CharField(db_column='email', max_length=150, null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='active')
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=utcnow)
    company = models.CharField(db_column='company', max_length=150, null=True, blank=True, default=None)
    city = models.CharField(db_column='city', max_length=100, null=True, blank=True, default=None)
    credit_limit = models.DecimalField(db_column='credit_limit', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    outstanding_balance = models.DecimalField(db_column='outstanding_balance', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))

    class Meta:
        db_table = 'customers'
        managed = MANAGED

TABLE_MODELS['customers'] = Customers

class CycleCounts(models.Model):
    cycle_id = models.AutoField(db_column='cycle_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    frequency = models.CharField(db_column='frequency', max_length=64, null=True, blank=True, default=None)
    last_run = models.DateField(db_column='last_run', null=True, blank=True, default=None)
    next_run = models.DateField(db_column='next_run', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='active')

    class Meta:
        db_table = 'cycle_counts'
        managed = MANAGED

TABLE_MODELS['cycle_counts'] = CycleCounts

class GoodsReceiptItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    grn_id = models.IntegerField(db_column='grn_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity_received = models.DecimalField(db_column='quantity_received', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    discount = models.DecimalField(db_column='discount', max_digits=65, decimal_places=30, null=True, blank=True, default=None)
    line_total = models.DecimalField(db_column='line_total', max_digits=65, decimal_places=30, null=True, blank=True, default=None)
    tax = models.DecimalField(db_column='tax', max_digits=65, decimal_places=30, null=True, blank=True, default=None)
    tax_percentage = models.DecimalField(db_column='tax_percentage', max_digits=10, decimal_places=2, default=Decimal('0.00'))
    taxable_amount = models.DecimalField(db_column='taxable_amount', max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(db_column='tax_amount', max_digits=18, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'goods_receipt_items'
        managed = MANAGED

TABLE_MODELS['goods_receipt_items'] = GoodsReceiptItems

class GoodsReceipts(models.Model):
    grn_id = models.AutoField(db_column='grn_id', primary_key=True)
    po_id = models.IntegerField(db_column='po_id', null=True, blank=True, default=None)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    receipt_date = models.DateTimeField(db_column='receipt_date', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='pending')
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.TextField(db_column='cancellation_reason', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=None)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)
    grn_number = models.CharField(db_column='grn_number', max_length=50, default='')
    supplier_invoice = models.TextField(db_column='SupplierInvoice', null=True, blank=True, default=None)
    supplier_invoice_date = models.DateTimeField(db_column='SupplierInvoiceDate', null=True, blank=True, default=None)

    class Meta:
        db_table = 'goods_receipts'
        managed = MANAGED

TABLE_MODELS['goods_receipts'] = GoodsReceipts

class InvoiceItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    invoice_id = models.IntegerField(db_column='invoice_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    total = models.DecimalField(db_column='total', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    tax_amount = models.DecimalField(db_column='tax_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    tax_percent = models.DecimalField(db_column='tax_percent', max_digits=18, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'invoice_items'
        managed = MANAGED

TABLE_MODELS['invoice_items'] = InvoiceItems

class Invoices(models.Model):
    invoice_id = models.AutoField(db_column='invoice_id', primary_key=True)
    so_id = models.IntegerField(db_column='so_id', null=True, blank=True, default=None)
    customer_id = models.IntegerField(db_column='customer_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    invoice_number = models.CharField(db_column='invoice_number', max_length=100, null=True, blank=True, default=None)
    invoice_date = models.DateTimeField(db_column='invoice_date', null=True, blank=True, default=None)
    due_date = models.DateField(db_column='due_date', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=32, default='Sent')
    total_amount = models.DecimalField(db_column='total_amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    paid_amount = models.DecimalField(db_column='paid_amount', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    balance_amount = models.DecimalField(db_column='balance_amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.TextField(db_column='cancellation_reason', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=None)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'invoices'
        managed = MANAGED

TABLE_MODELS['invoices'] = Invoices

class LocationMovements(models.Model):
    movement_id = models.AutoField(db_column='movement_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    from_bin_id = models.IntegerField(db_column='from_bin_id', null=True, blank=True, default=None)
    to_bin_id = models.IntegerField(db_column='to_bin_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    movement_date = models.DateTimeField(db_column='movement_date', null=True, blank=True, default=None)

    class Meta:
        db_table = 'location_movements'
        managed = MANAGED

TABLE_MODELS['location_movements'] = LocationMovements

class LoginHistory(models.Model):
    login_history_id = models.AutoField(db_column='LoginHistoryId', primary_key=True)
    user_id = models.IntegerField(db_column='UserId', default=0)
    login_time = models.DateTimeField(db_column='LoginTime', null=True, blank=True, default=utcnow)
    device_info = models.CharField(db_column='DeviceInfo', max_length=255, null=True, blank=True, default=None)
    ip_address = models.CharField(db_column='IpAddress', max_length=100, null=True, blank=True, default=None)
    logout_time = models.DateTimeField(db_column='LogoutTime', null=True, blank=True, default=None)
    browser = models.CharField(db_column='Browser', max_length=100, null=True, blank=True, default=None)
    operating_system = models.CharField(db_column='OperatingSystem', max_length=100, null=True, blank=True, default=None)
    logout_type = models.CharField(db_column='LogoutType', max_length=50, null=True, blank=True, default=None)
    is_current_session = BitBooleanField(db_column='IsCurrentSession', default=False)

    class Meta:
        db_table = 'login_history'
        managed = MANAGED

TABLE_MODELS['login_history'] = LoginHistory

class Modules(models.Model):
    module_id = models.AutoField(db_column='ModuleId', primary_key=True)
    module_key = models.CharField(db_column='ModuleKey', max_length=100, default='')
    module_name = models.CharField(db_column='ModuleName', max_length=100, default='')
    category = models.CharField(db_column='Category', max_length=100, null=True, blank=True, default=None)
    description = models.CharField(db_column='Description', max_length=255, null=True, blank=True, default=None)
    display_order = models.IntegerField(db_column='DisplayOrder', null=True, blank=True, default=0)
    is_active = BitBooleanField(db_column='IsActive', null=True, blank=True, default=False)
    created_at = models.DateTimeField(db_column='CreatedAt', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='UpdatedAt', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'modules'
        managed = MANAGED

TABLE_MODELS['modules'] = Modules

class Notifications(models.Model):
    notification_id = models.AutoField(db_column='notification_id', primary_key=True)
    title = models.CharField(db_column='title', max_length=255, default='')
    message = models.TextField(db_column='message', null=True, blank=True, default=None)
    type = models.CharField(db_column='type', max_length=50, null=True, blank=True, default=None)
    is_read = models.BooleanField(db_column='is_read', null=True, blank=True, default=False)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'notifications'
        managed = MANAGED

TABLE_MODELS['notifications'] = Notifications

class Otps(models.Model):
    id = models.AutoField(db_column='Id', primary_key=True)
    email = models.TextField(db_column='Email', default='')
    code = models.TextField(db_column='Code', default='')
    expiry_time = models.DateTimeField(db_column='ExpiryTime', default=utcnow)
    created_at = models.DateTimeField(db_column='CreatedAt', default=utcnow)
    is_used = models.BooleanField(db_column='IsUsed', default=False)
    purpose = models.TextField(db_column='Purpose', default='')
    user_id = models.IntegerField(db_column='UserId', null=True, blank=True, default=None)

    class Meta:
        db_table = 'otps'
        managed = MANAGED

TABLE_MODELS['otps'] = Otps

class Pendingusers(models.Model):
    id = models.AutoField(db_column='Id', primary_key=True)
    name = models.CharField(db_column='Name', max_length=50, default='')
    email = models.CharField(db_column='Email', max_length=256, default='')
    phone_number = models.CharField(db_column='PhoneNumber', max_length=10, default='')
    password_hash = models.TextField(db_column='PasswordHash', default='')
    role = models.TextField(db_column='Role', default='')
    email_verification_token = models.TextField(db_column='EmailVerificationToken', default='')
    email_verification_token_expiry = models.DateTimeField(db_column='EmailVerificationTokenExpiry', default=utcnow)

    class Meta:
        db_table = 'pendingusers'
        managed = MANAGED

TABLE_MODELS['pendingusers'] = Pendingusers

class ProductImages(models.Model):
    image_id = models.AutoField(db_column='image_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    image_url = models.CharField(db_column='image_url', max_length=255, null=True, blank=True, default=None)
    is_primary = models.BooleanField(db_column='is_primary', null=True, blank=True, default=False)

    class Meta:
        db_table = 'product_images'
        managed = MANAGED

TABLE_MODELS['product_images'] = ProductImages

class ProductVariants(models.Model):
    variant_id = models.AutoField(db_column='variant_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_name = models.CharField(db_column='variant_name', max_length=255, null=True, blank=True, default=None)
    sku = models.CharField(db_column='sku', max_length=100, null=True, blank=True, default=None)
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    cost_price = models.DecimalField(db_column='cost_price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'product_variants'
        managed = MANAGED

TABLE_MODELS['product_variants'] = ProductVariants

class Products(models.Model):
    product_id = models.AutoField(db_column='product_id', primary_key=True)
    name = models.CharField(db_column='name', max_length=255, default='')
    sku = models.CharField(db_column='sku', max_length=100, default='')
    category_id = models.IntegerField(db_column='category_id', null=True, blank=True, default=None)
    brand_id = models.IntegerField(db_column='brand_id', null=True, blank=True, default=None)
    unit_id = models.IntegerField(db_column='unit_id', null=True, blank=True, default=None)
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    cost_price = models.DecimalField(db_column='cost_price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    barcode = models.CharField(db_column='barcode', max_length=100, null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='active')
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=utcnow)
    reorder_level = models.IntegerField(db_column='reorder_level', null=True, blank=True, default=None)
    stock = models.IntegerField(db_column='stock', null=True, blank=True, default=None)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    is_deleted = BitBooleanField(db_column='is_deleted', null=True, blank=True, default=False)
    image_url = models.CharField(db_column='image_url', max_length=500, null=True, blank=True, default=None)
    sub_category_id = models.IntegerField(db_column='sub_category_id', null=True, blank=True, default=None)
    is_archived = models.BooleanField(db_column='is_archived', default=False)

    class Meta:
        db_table = 'products'
        managed = MANAGED

TABLE_MODELS['products'] = Products

class PurchaseIndentItems(models.Model):
    purchase_indent_item_id = models.AutoField(db_column='purchase_indent_item_id', primary_key=True)
    purchase_indent_id = models.IntegerField(db_column='purchase_indent_id', default=0)
    product_id = models.IntegerField(db_column='product_id', default=0)
    required_qty = models.DecimalField(db_column='required_qty', max_digits=18, decimal_places=2, default=Decimal('0'))
    unit_id = models.IntegerField(db_column='unit_id', default=0)
    available_stock = models.DecimalField(db_column='available_stock', max_digits=18, decimal_places=2, default=Decimal('0'))
    required_date = models.DateTimeField(db_column='required_date', default=utcnow)
    remarks = models.TextField(db_column='remarks', null=True, blank=True, default=None)

    class Meta:
        db_table = 'purchase_indent_items'
        managed = MANAGED

TABLE_MODELS['purchase_indent_items'] = PurchaseIndentItems

class PurchaseIndents(models.Model):
    purchase_indent_id = models.AutoField(db_column='purchase_indent_id', primary_key=True)
    indent_number = models.CharField(db_column='indent_number', max_length=255, null=True, blank=True, default=None)
    indent_date = models.DateTimeField(db_column='indent_date', default=utcnow)
    required_date = models.DateTimeField(db_column='required_date', default=utcnow)
    requested_by = models.IntegerField(db_column='requested_by', default=0)
    department_id = models.IntegerField(db_column='department_id', default=0)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    approved_by = models.IntegerField(db_column='approved_by', null=True, blank=True, default=None)
    priority = models.TextField(db_column='priority', null=True, blank=True, default=None)
    status = models.TextField(db_column='status', null=True, blank=True, default=None)
    remarks = models.TextField(db_column='remarks', null=True, blank=True, default=None)
    total_items = models.IntegerField(db_column='total_items', default=0)
    total_quantity = models.DecimalField(db_column='total_quantity', max_digits=18, decimal_places=2, default=Decimal('0'))
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=None)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    deleted_at = models.DateTimeField(db_column='deleted_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'purchase_indents'
        managed = MANAGED

TABLE_MODELS['purchase_indents'] = PurchaseIndents

class PurchaseOrderItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    po_id = models.IntegerField(db_column='po_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    received_quantity = models.DecimalField(db_column='received_quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    total = models.DecimalField(db_column='total', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    discount = models.DecimalField(db_column='discount', max_digits=65, decimal_places=30, null=True, blank=True, default=None)
    tax = models.DecimalField(db_column='tax', max_digits=65, decimal_places=30, null=True, blank=True, default=None)

    class Meta:
        db_table = 'purchase_order_items'
        managed = MANAGED

TABLE_MODELS['purchase_order_items'] = PurchaseOrderItems

class PurchaseOrders(models.Model):
    po_id = models.AutoField(db_column='po_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    po_number = models.CharField(db_column='po_number', max_length=100, null=True, blank=True, default=None)
    order_date = models.DateField(db_column='order_date', null=True, blank=True, default=None)
    expected_date = models.DateField(db_column='expected_date', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=50, null=True, blank=True, default=None)
    total_amount = models.DecimalField(db_column='total_amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.TextField(db_column='cancellation_reason', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    receiving_status = models.CharField(db_column='receiving_status', max_length=50, default='pending')
    payment_status = models.CharField(db_column='payment_status', max_length=50, default='Unpaid')
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'purchase_orders'
        managed = MANAGED

TABLE_MODELS['purchase_orders'] = PurchaseOrders

class PurchaseReturnItems(models.Model):
    purchase_return_item_id = models.AutoField(db_column='purchase_return_item_id', primary_key=True)
    purchase_return_id = models.IntegerField(db_column='purchase_return_id', default=0)
    product_id = models.IntegerField(db_column='product_id', default=0)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    received_quantity = models.DecimalField(db_column='received_quantity', max_digits=18, decimal_places=3, default=Decimal('0'))
    return_quantity = models.DecimalField(db_column='return_quantity', max_digits=18, decimal_places=3, default=Decimal('0'))
    price = models.DecimalField(db_column='price', max_digits=18, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(db_column='total', max_digits=18, decimal_places=2, default=Decimal('0'))
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)

    class Meta:
        db_table = 'purchase_return_items'
        managed = MANAGED

TABLE_MODELS['purchase_return_items'] = PurchaseReturnItems

class PurchaseReturns(models.Model):
    purchase_return_id = models.AutoField(db_column='purchase_return_id', primary_key=True)
    return_number = models.CharField(db_column='return_number', max_length=50, default='')
    supplier_id = models.IntegerField(db_column='supplier_id', default=0)
    grn_id = models.IntegerField(db_column='grn_id', default=0)
    return_date = models.DateField(db_column='return_date', default=today)
    reason = models.TextField(db_column='reason', default='')
    total_return_amount = models.DecimalField(db_column='total_return_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(db_column='status', max_length=30, default='Draft')
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'purchase_returns'
        managed = MANAGED

TABLE_MODELS['purchase_returns'] = PurchaseReturns

class PutawayAudits(models.Model):
    putaway_audit_id = models.AutoField(db_column='putaway_audit_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', default=0)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', default=0)
    rack_id = models.IntegerField(db_column='rack_id', default=0)
    bin_id = models.IntegerField(db_column='bin_id', default=0)
    quantity = models.DecimalField(db_column='quantity', max_digits=18, decimal_places=2, default=Decimal('0'))
    user_id = models.IntegerField(db_column='user_id', null=True, blank=True, default=None)
    user_name = models.CharField(db_column='user_name', max_length=256, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)

    class Meta:
        db_table = 'putaway_audits'
        managed = MANAGED

TABLE_MODELS['putaway_audits'] = PutawayAudits

class Racks(models.Model):
    rack_id = models.AutoField(db_column='rack_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    zone_id = models.IntegerField(db_column='zone_id', null=True, blank=True, default=None)
    rack_code = models.CharField(db_column='rack_code', max_length=50, null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)

    class Meta:
        db_table = 'racks'
        managed = MANAGED

TABLE_MODELS['racks'] = Racks

class RefreshTokens(models.Model):
    refresh_token_id = models.AutoField(db_column='RefreshTokenId', primary_key=True)
    user_id = models.IntegerField(db_column='UserId', default=0)
    token = models.CharField(db_column='Token', max_length=500, default='')
    expires_at = models.DateTimeField(db_column='ExpiresAt', default=utcnow)
    created_at = models.DateTimeField(db_column='CreatedAt', default=utcnow)
    revoked_at = models.DateTimeField(db_column='RevokedAt', null=True, blank=True, default=None)
    created_by_ip = models.CharField(db_column='CreatedByIp', max_length=100, null=True, blank=True, default=None)
    device_name = models.CharField(db_column='DeviceName', max_length=200, null=True, blank=True, default=None)

    class Meta:
        db_table = 'refresh_tokens'
        managed = MANAGED

TABLE_MODELS['refresh_tokens'] = RefreshTokens

class RolePermissions(models.Model):
    permission_id = models.AutoField(db_column='PermissionId', primary_key=True)
    role_id = models.IntegerField(db_column='RoleId', default=0)
    module_id = models.IntegerField(db_column='ModuleId', default=0)
    can_view = BitBooleanField(db_column='CanView', null=True, blank=True, default=False)
    can_add = BitBooleanField(db_column='CanAdd', null=True, blank=True, default=False)
    can_edit = BitBooleanField(db_column='CanEdit', null=True, blank=True, default=False)
    can_delete = BitBooleanField(db_column='CanDelete', null=True, blank=True, default=False)
    created_at = models.DateTimeField(db_column='CreatedAt', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='UpdatedAt', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'role_permissions'
        managed = MANAGED

TABLE_MODELS['role_permissions'] = RolePermissions

class Roles(models.Model):
    role_id = models.AutoField(db_column='role_id', primary_key=True)
    role_name = models.CharField(db_column='role_name', max_length=100, default='')
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    is_active = models.BooleanField(db_column='IsActive', null=True, blank=True, default=True)

    class Meta:
        db_table = 'roles'
        managed = MANAGED

TABLE_MODELS['roles'] = Roles

class SalesOrderItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    so_id = models.IntegerField(db_column='so_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    delivered_quantity = models.DecimalField(db_column='delivered_quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    price = models.DecimalField(db_column='price', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    total = models.DecimalField(db_column='total', max_digits=12, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'sales_order_items'
        managed = MANAGED

TABLE_MODELS['sales_order_items'] = SalesOrderItems

class SalesOrders(models.Model):
    so_id = models.AutoField(db_column='so_id', primary_key=True)
    customer_id = models.IntegerField(db_column='customer_id', null=True, blank=True, default=None)
    so_number = models.CharField(db_column='so_number', max_length=100, null=True, blank=True, default=None)
    order_date = models.DateField(db_column='order_date', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='draft')
    total_amount = models.DecimalField(db_column='total_amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'sales_orders'
        managed = MANAGED

TABLE_MODELS['sales_orders'] = SalesOrders

class SalesReturnItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    sales_return_id = models.IntegerField(db_column='sales_return_id', default=0)
    product_id = models.IntegerField(db_column='product_id', default=0)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    invoiced_quantity = models.DecimalField(db_column='invoiced_quantity', max_digits=18, decimal_places=3, default=Decimal('0'))
    return_quantity = models.DecimalField(db_column='return_quantity', max_digits=18, decimal_places=3, default=Decimal('0'))
    price = models.DecimalField(db_column='price', max_digits=18, decimal_places=2, default=Decimal('0'))
    tax = models.DecimalField(db_column='tax', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(db_column='tax_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(db_column='discount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(db_column='total', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)

    class Meta:
        db_table = 'sales_return_items'
        managed = MANAGED

TABLE_MODELS['sales_return_items'] = SalesReturnItems

class SalesReturns(models.Model):
    return_id = models.AutoField(db_column='return_id', primary_key=True)
    return_number = models.CharField(db_column='return_number', max_length=50, default='')
    customer_id = models.IntegerField(db_column='customer_id', default=0)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    invoice_id = models.IntegerField(db_column='invoice_id', default=0)
    return_date = models.DateField(db_column='return_date', default=today)
    reason = models.TextField(db_column='reason', default='')
    rejection_reason = models.TextField(db_column='rejection_reason', null=True, blank=True, default=None)
    approved_by = models.CharField(db_column='approved_by', max_length=128, null=True, blank=True, default=None)
    approved_at = models.DateTimeField(db_column='approved_at', null=True, blank=True, default=None)
    refund_method = models.CharField(db_column='refund_method', max_length=64, null=True, blank=True, default=None)
    refund_reference = models.CharField(db_column='refund_reference', max_length=128, null=True, blank=True, default=None)
    refund_date = models.DateTimeField(db_column='refund_date', null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    total_amount = models.DecimalField(db_column='total_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(db_column='tax_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(db_column='discount_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    grand_total = models.DecimalField(db_column='grand_total', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    refund_amount = models.DecimalField(db_column='refund_amount', max_digits=18, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(db_column='status', max_length=30, default='Draft')
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'sales_returns'
        managed = MANAGED

TABLE_MODELS['sales_returns'] = SalesReturns

class Settings(models.Model):
    setting_id = models.AutoField(db_column='SettingId', primary_key=True)
    company_name = models.CharField(db_column='CompanyName', max_length=150, null=True, blank=True, default=None)
    company_logo = models.CharField(db_column='CompanyLogo', max_length=255, null=True, blank=True, default=None)
    email_address = models.CharField(db_column='EmailAddress', max_length=150, null=True, blank=True, default=None)
    phone_number = models.CharField(db_column='PhoneNumber', max_length=20, null=True, blank=True, default=None)
    address = models.TextField(db_column='Address', null=True, blank=True, default=None)
    low_stock_alert_limit = models.IntegerField(db_column='LowStockAlertLimit', null=True, blank=True, default=10)
    default_unit_type = models.CharField(db_column='DefaultUnitType', max_length=50, null=True, blank=True, default='Pieces')
    barcode_management = models.BooleanField(db_column='BarcodeManagement', null=True, blank=True, default=True)
    auto_stock_update = models.BooleanField(db_column='AutoStockUpdate', null=True, blank=True, default=True)
    low_stock_alerts = models.BooleanField(db_column='LowStockAlerts', null=True, blank=True, default=False)
    order_notifications = models.BooleanField(db_column='OrderNotifications', null=True, blank=True, default=False)
    supplier_payment_reminder = models.BooleanField(db_column='SupplierPaymentReminder', null=True, blank=True, default=False)
    two_step_verification = models.BooleanField(db_column='TwoStepVerification', null=True, blank=True, default=False)
    theme_mode = models.CharField(db_column='ThemeMode', max_length=50, null=True, blank=True, default='Light')
    updated_at = models.DateTimeField(db_column='UpdatedAt', null=True, blank=True, default=utcnow)
    language = models.CharField(db_column='Language', max_length=50, null=True, blank=True, default='English')
    collapse_sidebar = models.BooleanField(db_column='CollapseSidebar', null=True, blank=True, default=False)

    class Meta:
        db_table = 'settings'
        managed = MANAGED

TABLE_MODELS['settings'] = Settings

class Stock(models.Model):
    stock_id = models.AutoField(db_column='stock_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    reserved_quantity = models.DecimalField(db_column='reserved_quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    available_quantity = models.GeneratedField(expression=F('quantity') - F('reserved_quantity'), output_field=models.DecimalField(max_digits=10, decimal_places=2), db_persist=True, db_column='available_quantity')
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=None)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'stock'
        managed = MANAGED

TABLE_MODELS['stock'] = Stock

class StockAdjustmentItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    adjustment_id = models.IntegerField(db_column='adjustment_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'stock_adjustment_items'
        managed = MANAGED

TABLE_MODELS['stock_adjustment_items'] = StockAdjustmentItems

class StockAdjustments(models.Model):
    adjustment_id = models.AutoField(db_column='adjustment_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    adjustment_type = models.CharField(db_column='adjustment_type', max_length=64, null=True, blank=True, default=None)
    reason = models.CharField(db_column='reason', max_length=255, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'stock_adjustments'
        managed = MANAGED

TABLE_MODELS['stock_adjustments'] = StockAdjustments

class StockAuditItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    audit_id = models.IntegerField(db_column='audit_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    bin_id = models.IntegerField(db_column='bin_id', null=True, blank=True, default=None)
    system_quantity = models.DecimalField(db_column='system_quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    physical_quantity = models.DecimalField(db_column='physical_quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    difference = models.DecimalField(db_column='difference', max_digits=10, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'stock_audit_items'
        managed = MANAGED

TABLE_MODELS['stock_audit_items'] = StockAuditItems

class StockAudits(models.Model):
    audit_id = models.AutoField(db_column='audit_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    audit_date = models.DateField(db_column='audit_date', null=True, blank=True, default=None)
    audit_type = models.CharField(db_column='audit_type', max_length=64, null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default=None)
    created_by = models.CharField(db_column='created_by', max_length=255, null=True, blank=True, default=None)
    approved_by = models.CharField(db_column='approved_by', max_length=255, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)

    class Meta:
        db_table = 'stock_audits'
        managed = MANAGED

TABLE_MODELS['stock_audits'] = StockAudits

class StockLedger(models.Model):
    ledger_id = models.AutoField(db_column='ledger_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    opening_qty = models.DecimalField(db_column='opening_qty', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    change_qty = models.DecimalField(db_column='change_qty', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    closing_qty = models.DecimalField(db_column='closing_qty', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    transaction_type = models.CharField(db_column='transaction_type', max_length=50, null=True, blank=True, default=None)
    transaction_id = models.IntegerField(db_column='transaction_id', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.CharField(db_column='cancellation_reason', max_length=255, null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'stock_ledger'
        managed = MANAGED

TABLE_MODELS['stock_ledger'] = StockLedger

class StockMovements(models.Model):
    movement_id = models.AutoField(db_column='movement_id', primary_key=True)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    movement_type = models.CharField(db_column='movement_type', max_length=50, null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)
    reference_id = models.IntegerField(db_column='reference_id', null=True, blank=True, default=None)
    reference_type = models.CharField(db_column='reference_type', max_length=50, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.CharField(db_column='cancellation_reason', max_length=255, null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'stock_movements'
        managed = MANAGED

TABLE_MODELS['stock_movements'] = StockMovements

class StockTransferItems(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    transfer_id = models.IntegerField(db_column='transfer_id', null=True, blank=True, default=None)
    product_id = models.IntegerField(db_column='product_id', null=True, blank=True, default=None)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    quantity = models.DecimalField(db_column='quantity', max_digits=10, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        db_table = 'stock_transfer_items'
        managed = MANAGED

TABLE_MODELS['stock_transfer_items'] = StockTransferItems

class StockTransfers(models.Model):
    transfer_id = models.AutoField(db_column='transfer_id', primary_key=True)
    from_warehouse_id = models.IntegerField(db_column='from_warehouse_id', null=True, blank=True, default=None)
    to_warehouse_id = models.IntegerField(db_column='to_warehouse_id', null=True, blank=True, default=None)
    transfer_date = models.DateTimeField(db_column='transfer_date', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='pending')

    class Meta:
        db_table = 'stock_transfers'
        managed = MANAGED

TABLE_MODELS['stock_transfers'] = StockTransfers

class SubCategories(models.Model):
    sub_category_id = models.AutoField(db_column='sub_category_id', primary_key=True)
    category_id = models.IntegerField(db_column='category_id', default=0)
    name = models.CharField(db_column='name', max_length=150, default='')
    description = models.TextField(db_column='description', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=50, null=True, blank=True, default='active')
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'sub_categories'
        managed = MANAGED

TABLE_MODELS['sub_categories'] = SubCategories

class SupplierAddresses(models.Model):
    address_id = models.AutoField(db_column='address_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    address_type = models.CharField(db_column='address_type', max_length=64, null=True, blank=True, default='office')
    address_line = models.TextField(db_column='address_line', null=True, blank=True, default=None)
    city = models.CharField(db_column='city', max_length=100, null=True, blank=True, default=None)
    state = models.CharField(db_column='state', max_length=100, null=True, blank=True, default=None)
    country = models.CharField(db_column='country', max_length=100, null=True, blank=True, default=None)
    pincode = models.CharField(db_column='pincode', max_length=20, null=True, blank=True, default=None)

    class Meta:
        db_table = 'supplier_addresses'
        managed = MANAGED

TABLE_MODELS['supplier_addresses'] = SupplierAddresses

class SupplierBankDetails(models.Model):
    bank_id = models.AutoField(db_column='bank_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    account_name = models.CharField(db_column='account_name', max_length=150, null=True, blank=True, default=None)
    account_number = models.CharField(db_column='account_number', max_length=50, null=True, blank=True, default=None)
    bank_name = models.CharField(db_column='bank_name', max_length=150, null=True, blank=True, default=None)
    ifsc_code = models.CharField(db_column='ifsc_code', max_length=20, null=True, blank=True, default=None)
    branch = models.CharField(db_column='branch', max_length=100, null=True, blank=True, default=None)
    bank_state = models.CharField(db_column='bank_state', max_length=100, null=True, blank=True, default=None)
    bank_city = models.CharField(db_column='bank_city', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'supplier_bank_details'
        managed = MANAGED

TABLE_MODELS['supplier_bank_details'] = SupplierBankDetails

class SupplierContacts(models.Model):
    contact_id = models.AutoField(db_column='contact_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    name = models.CharField(db_column='name', max_length=150, null=True, blank=True, default=None)
    designation = models.CharField(db_column='designation', max_length=100, null=True, blank=True, default=None)
    phone = models.CharField(db_column='phone', max_length=20, null=True, blank=True, default=None)
    email = models.CharField(db_column='email', max_length=150, null=True, blank=True, default=None)
    is_primary = models.BooleanField(db_column='is_primary', null=True, blank=True, default=False)
    department = models.CharField(db_column='department', max_length=100, null=True, blank=True, default=None)

    class Meta:
        db_table = 'supplier_contacts'
        managed = MANAGED

TABLE_MODELS['supplier_contacts'] = SupplierContacts

class SupplierDocuments(models.Model):
    document_id = models.AutoField(db_column='document_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    display_name = models.CharField(db_column='display_name', max_length=150, null=True, blank=True, default=None)
    file_path = models.CharField(db_column='file_path', max_length=255, null=True, blank=True, default=None)
    uploaded_at = models.DateTimeField(db_column='uploaded_at', null=True, blank=True, default=utcnow)
    document_type = models.CharField(db_column='document_type', max_length=50, null=True, blank=True, default=None)
    original_file_name = models.CharField(db_column='original_file_name', max_length=255, null=True, blank=True, default=None)
    stored_file_name = models.CharField(db_column='stored_file_name', max_length=255, null=True, blank=True, default=None)
    content_type = models.CharField(db_column='content_type', max_length=100, null=True, blank=True, default=None)
    file_size_bytes = models.BigIntegerField(db_column='file_size_bytes', null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=50, null=True, blank=True, default='uploaded')
    is_deleted = models.BooleanField(db_column='is_deleted', null=True, blank=True, default=False)
    deleted_at = models.DateTimeField(db_column='deleted_at', null=True, blank=True, default=None)
    is_temporary = models.BooleanField(db_column='is_temporary', default=False)

    class Meta:
        db_table = 'supplier_documents'
        managed = MANAGED

TABLE_MODELS['supplier_documents'] = SupplierDocuments

class SupplierPaymentTerms(models.Model):
    term_id = models.AutoField(db_column='term_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    credit_days = models.IntegerField(db_column='credit_days', null=True, blank=True, default=0)
    credit_limit = models.DecimalField(db_column='credit_limit', max_digits=12, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    payment_method = models.CharField(db_column='payment_method', max_length=50, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)

    class Meta:
        db_table = 'supplier_payment_terms'
        managed = MANAGED

TABLE_MODELS['supplier_payment_terms'] = SupplierPaymentTerms

class SupplierPayments(models.Model):
    payment_id = models.AutoField(db_column='payment_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    po_id = models.IntegerField(db_column='po_id', null=True, blank=True, default=None)
    amount = models.DecimalField(db_column='amount', max_digits=12, decimal_places=2, null=True, blank=True, default=None)
    payment_date = models.DateTimeField(db_column='payment_date', null=True, blank=True, default=None)
    payment_method = models.CharField(db_column='payment_method', max_length=50, null=True, blank=True, default=None)
    reference_number = models.CharField(db_column='reference_number', max_length=100, null=True, blank=True, default=None)
    notes = models.TextField(db_column='notes', null=True, blank=True, default=None)
    is_cancelled = models.BooleanField(db_column='is_cancelled', default=False)
    cancelled_at = models.DateTimeField(db_column='cancelled_at', null=True, blank=True, default=None)
    cancellation_reason = models.TextField(db_column='cancellation_reason', null=True, blank=True, default=None)

    class Meta:
        db_table = 'supplier_payments'
        managed = MANAGED

TABLE_MODELS['supplier_payments'] = SupplierPayments

class SupplierPerformance(models.Model):
    performance_id = models.AutoField(db_column='performance_id', primary_key=True)
    supplier_id = models.IntegerField(db_column='supplier_id', null=True, blank=True, default=None)
    total_orders = models.IntegerField(db_column='total_orders', null=True, blank=True, default=0)
    on_time_deliveries = models.IntegerField(db_column='on_time_deliveries', null=True, blank=True, default=0)
    delayed_deliveries = models.IntegerField(db_column='delayed_deliveries', null=True, blank=True, default=0)
    rating = models.DecimalField(db_column='rating', max_digits=3, decimal_places=2, null=True, blank=True, default=None)
    last_updated = models.DateTimeField(db_column='last_updated', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'supplier_performance'
        managed = MANAGED

TABLE_MODELS['supplier_performance'] = SupplierPerformance

class Suppliers(models.Model):
    supplier_id = models.AutoField(db_column='supplier_id', primary_key=True)
    supplier_code = models.CharField(db_column='supplier_code', max_length=50, null=True, blank=True, default=None)
    name = models.CharField(db_column='name', max_length=255, default='')
    gst_number = models.CharField(db_column='gst_number', max_length=50, null=True, blank=True, default=None)
    pan_number = models.CharField(db_column='pan_number', max_length=20, null=True, blank=True, default=None)
    phone = models.CharField(db_column='phone', max_length=20, null=True, blank=True, default=None)
    email = models.CharField(db_column='email', max_length=150, null=True, blank=True, default=None)
    website = models.CharField(db_column='website', max_length=150, null=True, blank=True, default=None)
    status = models.CharField(db_column='status', max_length=20, default='active')
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=utcnow)
    category = models.CharField(db_column='category', max_length=100, null=True, blank=True, default=None)
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)
    deleted_at = models.DateTimeField(db_column='deleted_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'suppliers'
        managed = MANAGED

TABLE_MODELS['suppliers'] = Suppliers

class SystemSettingRules(models.Model):
    rule_id = models.AutoField(db_column='rule_id', primary_key=True)
    section_id = models.IntegerField(db_column='section_id', default=0)
    rule_key = models.CharField(db_column='rule_key', max_length=150, default='')
    rule_name = models.CharField(db_column='rule_name', max_length=200, default='')
    rule_description = models.CharField(db_column='rule_description', max_length=500, null=True, blank=True, default=None)
    rule_type = models.CharField(db_column='rule_type', max_length=50, default='')
    rule_value = models.CharField(db_column='rule_value', max_length=500, null=True, blank=True, default=None)
    default_value = models.CharField(db_column='default_value', max_length=500, null=True, blank=True, default=None)
    is_enabled = models.BooleanField(db_column='is_enabled', null=True, blank=True, default=True)
    display_order = models.IntegerField(db_column='display_order', default=0)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'system_setting_rules'
        managed = MANAGED

TABLE_MODELS['system_setting_rules'] = SystemSettingRules

class SystemSettingSections(models.Model):
    section_id = models.AutoField(db_column='section_id', primary_key=True)
    section_key = models.CharField(db_column='section_key', max_length=100, default='')
    section_name = models.CharField(db_column='section_name', max_length=150, default='')
    display_order = models.IntegerField(db_column='display_order', default=0)
    is_active = models.BooleanField(db_column='is_active', null=True, blank=True, default=True)

    class Meta:
        db_table = 'system_setting_sections'
        managed = MANAGED

TABLE_MODELS['system_setting_sections'] = SystemSettingSections

class SystemSettings(models.Model):
    setting_id = models.AutoField(db_column='setting_id', primary_key=True)
    company_name = models.CharField(db_column='company_name', max_length=255, null=True, blank=True, default=None)
    company_email = models.CharField(db_column='company_email', max_length=255, null=True, blank=True, default=None)
    company_phone = models.CharField(db_column='company_phone', max_length=50, null=True, blank=True, default=None)
    company_address = models.TextField(db_column='company_address', null=True, blank=True, default=None)
    gst_number = models.CharField(db_column='gst_number', max_length=100, null=True, blank=True, default=None)
    currency = models.CharField(db_column='currency', max_length=20, null=True, blank=True, default=None)
    timezone = models.CharField(db_column='timezone', max_length=100, null=True, blank=True, default=None)
    invoice_prefix = models.CharField(db_column='invoice_prefix', max_length=20, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    allow_negative_stock = models.BooleanField(db_column='allow_negative_stock', null=True, blank=True, default=False)
    default_reorder_level = models.IntegerField(db_column='default_reorder_level', null=True, blank=True, default=10)
    stock_valuation_method = models.CharField(db_column='stock_valuation_method', max_length=20, null=True, blank=True, default='FIFO')
    invoice_start_number = models.IntegerField(db_column='invoice_start_number', null=True, blank=True, default=1000)
    enable_audit_logs = models.BooleanField(db_column='enable_audit_logs', null=True, blank=True, default=True)
    audit_retention_days = models.IntegerField(db_column='audit_retention_days', null=True, blank=True, default=365)
    low_stock_alert = models.BooleanField(db_column='low_stock_alert', null=True, blank=True, default=True)
    default_unit_type = models.CharField(db_column='default_unit_type', max_length=100, null=True, blank=True, default=None)
    enable_barcode = models.BooleanField(db_column='enable_barcode', default=False)
    auto_stock_update = models.BooleanField(db_column='auto_stock_update', default=False)
    email_notifications = models.BooleanField(db_column='email_notifications', default=True)
    low_stock_notifications = models.BooleanField(db_column='low_stock_notifications', default=True)
    purchase_notifications = models.BooleanField(db_column='purchase_notifications', default=True)
    sales_notifications = models.BooleanField(db_column='sales_notifications', default=True)
    system_alerts = models.BooleanField(db_column='system_alerts', default=True)
    enable_two_factor_auth = models.BooleanField(db_column='enable_two_factor_auth', default=False)
    company_logo = models.CharField(db_column='company_logo', max_length=500, null=True, blank=True, default=None)
    theme_mode = models.CharField(db_column='theme_mode', max_length=50, null=True, blank=True, default=None)
    language = models.CharField(db_column='language', max_length=50, null=True, blank=True, default=None)
    collapse_sidebar = models.BooleanField(db_column='collapse_sidebar', null=True, blank=True, default=False)

    class Meta:
        db_table = 'system_settings'
        managed = MANAGED

TABLE_MODELS['system_settings'] = SystemSettings

class Units(models.Model):
    unit_id = models.AutoField(db_column='unit_id', primary_key=True)
    name = models.CharField(db_column='name', max_length=50, default='')
    short_name = models.CharField(db_column='short_name', max_length=20, default='')
    is_deleted = models.BooleanField(db_column='is_deleted', default=False)

    class Meta:
        db_table = 'units'
        managed = MANAGED

TABLE_MODELS['units'] = Units

class UserTokens(models.Model):
    token_id = models.AutoField(db_column='TokenId', primary_key=True)
    user_id = models.IntegerField(db_column='UserId', default=0)
    token = models.TextField(db_column='Token', default='')
    is_active = models.BooleanField(db_column='IsActive', null=True, blank=True, default=True)
    created_at = models.DateTimeField(db_column='CreatedAt', null=True, blank=True, default=utcnow)

    class Meta:
        db_table = 'user_tokens'
        managed = MANAGED

TABLE_MODELS['user_tokens'] = UserTokens

class Users(models.Model):
    id = models.AutoField(db_column='Id', primary_key=True)
    name = models.CharField(db_column='Name', max_length=50, default='')
    email = models.CharField(db_column='Email', max_length=256, default='')
    password_hash = models.TextField(db_column='PasswordHash', default='')
    role = models.TextField(db_column='Role', default='')
    is_active = models.BooleanField(db_column='IsActive', default=False)
    phone_number = models.CharField(db_column='PhoneNumber', max_length=10, null=True, blank=True, default=None)
    employee_id = models.CharField(db_column='EmployeeId', max_length=50, null=True, blank=True, default=None)
    department = models.CharField(db_column='Department', max_length=100, null=True, blank=True, default=None)
    warehouse = models.CharField(db_column='Warehouse', max_length=100, null=True, blank=True, default=None)
    profile_photo = models.CharField(db_column='ProfilePhoto', max_length=255, null=True, blank=True, default=None)
    last_login = models.DateTimeField(db_column='LastLogin', null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='CreatedAt', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='UpdatedAt', null=True, blank=True, default=utcnow)
    token_version = models.IntegerField(db_column='TokenVersion', default=1)
    failed_login_attempts = models.IntegerField(db_column='FailedLoginAttempts', default=0)
    lockout_end = models.DateTimeField(db_column='LockoutEnd', null=True, blank=True, default=None)
    email_verification_token = models.TextField(db_column='EmailVerificationToken', null=True, blank=True, default=None)
    email_verification_token_expiry = models.DateTimeField(db_column='EmailVerificationTokenExpiry', null=True, blank=True, default=None)
    is_email_verified = models.BooleanField(db_column='IsEmailVerified', default=False)

    class Meta:
        db_table = 'users'
        managed = MANAGED

TABLE_MODELS['users'] = Users

class VariantAttributeValues(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    attribute_id = models.IntegerField(db_column='attribute_id', null=True, blank=True, default=None)
    value_id = models.IntegerField(db_column='value_id', null=True, blank=True, default=None)

    class Meta:
        db_table = 'variant_attribute_values'
        managed = MANAGED

TABLE_MODELS['variant_attribute_values'] = VariantAttributeValues

class WarehouseTransferAudits(models.Model):
    warehouse_transfer_audit_id = models.AutoField(db_column='warehouse_transfer_audit_id', primary_key=True)
    transfer_id = models.IntegerField(db_column='transfer_id', default=0)
    product_id = models.IntegerField(db_column='product_id', default=0)
    variant_id = models.IntegerField(db_column='variant_id', null=True, blank=True, default=None)
    from_warehouse_id = models.IntegerField(db_column='from_warehouse_id', default=0)
    to_warehouse_id = models.IntegerField(db_column='to_warehouse_id', default=0)
    quantity = models.DecimalField(db_column='quantity', max_digits=18, decimal_places=2, default=Decimal('0'))
    user_id = models.IntegerField(db_column='user_id', null=True, blank=True, default=None)
    user_name = models.CharField(db_column='user_name', max_length=256, null=True, blank=True, default=None)
    created_at = models.DateTimeField(db_column='created_at', default=utcnow)

    class Meta:
        db_table = 'warehouse_transfer_audits'
        managed = MANAGED

TABLE_MODELS['warehouse_transfer_audits'] = WarehouseTransferAudits

class WarehouseUsers(models.Model):
    id = models.AutoField(db_column='id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    user_id = models.IntegerField(db_column='user_id', null=True, blank=True, default=None)
    role = models.CharField(db_column='role', max_length=50, null=True, blank=True, default=None)

    class Meta:
        db_table = 'warehouse_users'
        managed = MANAGED

TABLE_MODELS['warehouse_users'] = WarehouseUsers

class WarehouseZones(models.Model):
    zone_id = models.AutoField(db_column='zone_id', primary_key=True)
    warehouse_id = models.IntegerField(db_column='warehouse_id', null=True, blank=True, default=None)
    zone_name = models.CharField(db_column='zone_name', max_length=100, null=True, blank=True, default=None)
    description = models.TextField(db_column='description', null=True, blank=True, default=None)

    class Meta:
        db_table = 'warehouse_zones'
        managed = MANAGED

TABLE_MODELS['warehouse_zones'] = WarehouseZones

class Warehouses(models.Model):
    warehouse_id = models.AutoField(db_column='warehouse_id', primary_key=True)
    warehouse_code = models.CharField(db_column='warehouse_code', max_length=50, default='')
    name = models.CharField(db_column='name', max_length=150, default='')
    location = models.CharField(db_column='location', max_length=255, default='')
    manager_name = models.CharField(db_column='manager_name', max_length=150, default='')
    phone = models.CharField(db_column='phone', max_length=20, default='')
    email = models.CharField(db_column='email', max_length=255, default='')
    status = models.CharField(db_column='status', max_length=64, null=True, blank=True, default='active')
    created_at = models.DateTimeField(db_column='created_at', null=True, blank=True, default=utcnow)
    updated_at = models.DateTimeField(db_column='updated_at', null=True, blank=True, default=None)
    is_deleted = BitBooleanField(db_column='is_deleted', default=False)
    deleted_at = models.DateTimeField(db_column='deleted_at', null=True, blank=True, default=None)

    class Meta:
        db_table = 'warehouses'
        managed = MANAGED

TABLE_MODELS['warehouses'] = Warehouses
