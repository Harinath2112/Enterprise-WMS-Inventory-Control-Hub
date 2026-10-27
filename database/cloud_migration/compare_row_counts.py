#!/usr/bin/env python3
"""
Enterprise WMS Cloud Migration: Row Count Comparison Script (compare_row_counts.py)
-----------------------------------------------------------------------------------
Read-only script to verify data integrity post-migration by comparing table
row counts in the target database against the baseline dataset (410 rows total).

Usage:
    python compare_row_counts.py

Environment Variables:
    DB_HOST     - Cloud database hostname
    DB_PORT     - Port (default: 3306)
    DB_NAME     - Database name (e.g., defaultdb or imsdatabase)
    DB_USER     - Database username
    DB_PASSWORD - Database password
    DB_SSL      - Set to '1', 'true', or 'REQUIRED' for TLS
    DB_SSL_CA   - Path to CA certificate file
"""

import os
import sys

try:
    import pymysql
except ImportError:
    print("Error: 'pymysql' package is required. Install via: pip install pymysql")
    sys.exit(1)

# Baseline table row counts from the audited imsdatabase.sql
EXPECTED_ROW_COUNTS = {
    # 15 Seeded & Configuration Tables (410 total rows)
    "role_permissions": 190,
    "system_setting_rules": 101,
    "modules": 38,
    "products": 18,
    "__efmigrationshistory": 12,
    "sub_categories": 12,
    "system_setting_sections": 11,
    "categories": 6,
    "brands": 5,
    "roles": 5,
    "units": 5,
    "warehouses": 3,
    "bins": 2,
    "racks": 1,
    "users": 1,
    # 69 Operational / Transactional Tables (0 rows)
    "attribute_values": 0,
    "attributes": 0,
    "audit_logs": 0,
    "barcodes": 0,
    "bin_stock": 0,
    "bin_transfer_audits": 0,
    "customer_activity": 0,
    "customer_addresses": 0,
    "customer_bank_details": 0,
    "customer_contacts": 0,
    "customer_ledger": 0,
    "customer_payment_terms": 0,
    "customer_payments": 0,
    "customers": 0,
    "cycle_counts": 0,
    "goods_receipt_items": 0,
    "goods_receipts": 0,
    "invoice_items": 0,
    "invoices": 0,
    "location_movements": 0,
    "login_history": 0,
    "notifications": 0,
    "otps": 0,
    "pendingusers": 0,
    "product_images": 0,
    "product_variants": 0,
    "purchase_indent_items": 0,
    "purchase_indents": 0,
    "purchase_order_items": 0,
    "purchase_orders": 0,
    "purchase_return_items": 0,
    "purchase_return_items_backup_20260821": 0,
    "purchase_returns": 0,
    "purchase_returns_backup_20260821": 0,
    "putaway_audits": 0,
    "refresh_tokens": 0,
    "role_permissions_backup": 0,
    "sales_order_items": 0,
    "sales_orders": 0,
    "sales_return_items": 0,
    "sales_return_items_backup": 0,
    "sales_return_items_backup_20260821": 0,
    "sales_returns": 0,
    "sales_returns_backup": 0,
    "sales_returns_backup_20260821": 0,
    "settings": 0,
    "stock": 0,
    "stock_adjustment_items": 0,
    "stock_adjustments": 0,
    "stock_audit_items": 0,
    "stock_audits": 0,
    "stock_ledger": 0,
    "stock_movements": 0,
    "stock_transfer_items": 0,
    "stock_transfers": 0,
    "supplier_addresses": 0,
    "supplier_bank_details": 0,
    "supplier_contacts": 0,
    "supplier_documents": 0,
    "supplier_payment_terms": 0,
    "supplier_payments": 0,
    "supplier_performance": 0,
    "suppliers": 0,
    "system_settings": 0,
    "user_tokens": 0,
    "variant_attribute_values": 0,
    "warehouse_transfer_audits": 0,
    "warehouse_users": 0,
    "warehouse_zones": 0,
}

def load_dotenv_fallback():
    for p in ["backend/.env", "../backend/.env", "../../backend/.env", ".env"]:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        v = v.split("#")[0].strip()
                        os.environ.setdefault(k.strip(), v)
            break

def get_connection():
    load_dotenv_fallback()
    host = os.environ.get("DB_HOST", "127.0.0.1")
    port = int(os.environ.get("DB_PORT", "3306"))
    dbname = os.environ.get("DB_NAME", "imsdatabase")
    user = os.environ.get("DB_USER", "root")
    password = os.environ.get("DB_PASSWORD", "")
    use_ssl = os.environ.get("DB_SSL", "0").lower() in ("1", "true", "required", "yes")
    ssl_ca = os.environ.get("DB_SSL_CA", "")

    ssl_config = None
    if use_ssl or ssl_ca:
        ssl_config = {}
        resolved_ca = None
        if ssl_ca:
            for cand in [ssl_ca, os.path.join("backend", ssl_ca), os.path.join("..", "backend", ssl_ca)]:
                if os.path.exists(cand):
                    resolved_ca = os.path.abspath(cand)
                    break
        if resolved_ca:
            ssl_config["ca"] = resolved_ca
            ssl_config["check_hostname"] = True
        else:
            ssl_config["check_hostname"] = False

    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=dbname,
        charset="utf8mb4",
        ssl=ssl_config,
        connect_timeout=15,
    )

def compare_row_counts():
    try:
        conn = get_connection()
    except Exception as e:
        print(f"[FAILED] Could not connect to database: {e}")
        return False

    all_matched = True
    actual_counts = {}
    missing_tables = []

    print("\n" + "=" * 65)
    print(f"{'Table Name':<38} | {'Expected':>8} | {'Actual':>8} | Status")
    print("=" * 65)

    try:
        with conn.cursor() as cursor:
            for table_name, expected in sorted(EXPECTED_ROW_COUNTS.items()):
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`;")
                    actual = cursor.fetchone()[0]
                    actual_counts[table_name] = actual
                    is_match = (actual == expected)
                    if not is_match:
                        all_matched = False
                    status_str = "MATCH" if is_match else "MISMATCH"
                    # Only highlight populated or mismatched tables to keep terminal readable
                    if expected > 0 or not is_match:
                        print(f"{table_name:<38} | {expected:>8} | {actual:>8} | {status_str}")
                except Exception as table_err:
                    missing_tables.append(table_name)
                    all_matched = False
                    print(f"{table_name:<38} | {expected:>8} | {'ERR':>8} | NOT FOUND")

    finally:
        conn.close()

    total_expected = sum(EXPECTED_ROW_COUNTS.values())
    total_actual = sum(actual_counts.values())

    print("=" * 65)
    print(f"Empty tables verified (0 rows expected and actual): {len([t for t, c in EXPECTED_ROW_COUNTS.items() if c == 0 and actual_counts.get(t) == 0])} / 69")
    print(f"Total Rows Expected: {total_expected}")
    print(f"Total Rows Actual:   {total_actual}")

    if missing_tables:
        print(f"\n[ERROR] Tables not found in target database: {len(missing_tables)}")
        for t in missing_tables:
            print(f"  - {t}")

    print("\n" + "=" * 65)
    if all_matched:
        print("ROW COUNT VALIDATION: PASS (All 84 tables match baseline data)")
    else:
        print("ROW COUNT VALIDATION: FAIL (Review discrepancies above)")
    print("=" * 65)
    return all_matched

if __name__ == "__main__":
    success = compare_row_counts()
    sys.exit(0 if success else 1)
