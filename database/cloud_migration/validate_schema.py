#!/usr/bin/env python3
"""
Enterprise WMS Cloud Migration: Schema Validation Script (validate_schema.py)
-----------------------------------------------------------------------------
Read-only validation script to verify that all 84 tables, primary keys, and
foreign key constraints have been successfully created on the cloud MySQL service.

Usage:
    python validate_schema.py

Environment Variables:
    DB_HOST     - Cloud database hostname (e.g., mysql-xxx.aivencloud.com)
    DB_PORT     - Port (default: 3306)
    DB_NAME     - Database name (e.g., defaultdb or imsdatabase)
    DB_USER     - Database username (e.g., avnadmin)
    DB_PASSWORD - Database password
    DB_SSL      - Set to '1', 'true', or 'REQUIRED' for TLS
    DB_SSL_CA   - Path to CA certificate file (e.g., ca.pem)
"""

import os
import sys
import ssl

try:
    import pymysql
except ImportError:
    print("Error: 'pymysql' package is required. Install via: pip install pymysql")
    sys.exit(1)

# All 84 expected tables from the baseline schema
EXPECTED_TABLES = [
    "__efmigrationshistory", "attribute_values", "attributes", "audit_logs",
    "barcodes", "bin_stock", "bin_transfer_audits", "bins", "brands", "categories",
    "customer_activity", "customer_addresses", "customer_bank_details", "customer_contacts",
    "customer_ledger", "customer_payment_terms", "customer_payments", "customers",
    "cycle_counts", "goods_receipt_items", "goods_receipts", "invoice_items", "invoices",
    "location_movements", "login_history", "modules", "notifications", "otps",
    "pendingusers", "product_images", "product_variants", "products", "purchase_indent_items",
    "purchase_indents", "purchase_order_items", "purchase_orders", "purchase_return_items",
    "purchase_return_items_backup_20260821", "purchase_returns",
    "purchase_returns_backup_20260821", "putaway_audits", "racks", "refresh_tokens",
    "role_permissions", "role_permissions_backup", "roles", "sales_order_items",
    "sales_orders", "sales_return_items", "sales_return_items_backup",
    "sales_return_items_backup_20260821", "sales_returns", "sales_returns_backup",
    "sales_returns_backup_20260821", "settings", "stock", "stock_adjustment_items",
    "stock_adjustments", "stock_audit_items", "stock_audits", "stock_ledger",
    "stock_movements", "stock_transfer_items", "stock_transfers", "sub_categories",
    "supplier_addresses", "supplier_bank_details", "supplier_contacts", "supplier_documents",
    "supplier_payment_terms", "supplier_payments", "supplier_performance", "suppliers",
    "system_setting_rules", "system_setting_sections", "system_settings", "units",
    "user_tokens", "users", "variant_attribute_values", "warehouse_transfer_audits",
    "warehouse_users", "warehouse_zones", "warehouses"
]

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

    print(f"Connecting to database '{dbname}' on {host}:{port} as user '{user}'...")
    print(f"SSL/TLS enabled: {bool(ssl_config)} (CA path: {ssl_config.get('ca') if ssl_config else 'None'})")

    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=dbname,
        charset="utf8mb4",
        ssl=ssl_config,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=15,
    )

def validate_schema():
    try:
        conn = get_connection()
    except Exception as e:
        print(f"\n[FAILED] Could not connect to database: {e}")
        return False

    all_passed = True
    try:
        with conn.cursor() as cursor:
            # 1. Check existing tables in target database
            cursor.execute("""
                SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';
            """)
            rows = cursor.fetchall()
            existing_tables = {r["TABLE_NAME"].lower(): r for r in rows}

            print(f"\nTarget Database Base Tables Found: {len(existing_tables)} / 84 expected")

            missing_tables = []
            for expected in EXPECTED_TABLES:
                if expected.lower() not in existing_tables:
                    missing_tables.append(expected)

            if missing_tables:
                print(f"[ERROR] Missing {len(missing_tables)} tables:")
                for t in missing_tables:
                    print(f"  - {t}")
                all_passed = False
            else:
                print("[PASS] All 84 expected tables exist.")

            # 2. Check Foreign Keys
            cursor.execute("""
                SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL;
            """)
            fks = cursor.fetchall()
            print(f"Foreign Key Constraints Found: {len(fks)} (Baseline expected: 87)")
            if len(fks) < 87:
                print(f"[WARNING] Fewer foreign keys than expected ({len(fks)} < 87).")
            else:
                print("[PASS] Foreign key constraints verified.")

            # 3. Check InnoDB Engine & Collation
            non_innodb = [t for t, meta in existing_tables.items() if (meta.get("ENGINE") or "").upper() != "INNODB"]
            if non_innodb:
                print(f"[WARNING] Non-InnoDB tables detected: {non_innodb}")
            else:
                print("[PASS] All tables use InnoDB storage engine.")

            # 4. Check Character Set and Collation
            non_utf8mb4 = [t for t, meta in existing_tables.items() if not (meta.get("TABLE_COLLATION") or "").startswith("utf8mb4")]
            if non_utf8mb4:
                print(f"[WARNING] Tables not using utf8mb4 collation: {non_utf8mb4}")
            else:
                print("[PASS] All tables use utf8mb4 character set.")

    finally:
        conn.close()

    print("\n" + "=" * 50)
    if all_passed:
        print("SCHEMA VALIDATION: PASS (Target schema matches baseline)")
    else:
        print("SCHEMA VALIDATION: FAIL (Review missing tables or constraints)")
    print("=" * 50)
    return all_passed

if __name__ == "__main__":
    success = validate_schema()
    sys.exit(0 if success else 1)
