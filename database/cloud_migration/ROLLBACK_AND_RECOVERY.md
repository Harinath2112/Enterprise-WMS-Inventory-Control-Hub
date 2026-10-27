# Cloud Database Rollback & Recovery Guide

This document outlines recovery procedures for handling failed migrations, partial imports, data discrepancies, or emergency rollbacks during the Enterprise WMS cloud database deployment.

---

## 1. Scenario A: Interrupted or Incomplete Cloud Import

If network failure, authentication timeout, or client disconnect interrupts the import process, the target database may be left in an inconsistent partial state.

### Resolution: Clean Slate Reset
Do not attempt to import over a partially loaded schema. Instead, execute a clean slate reset:

1. **Execute Clean-Slate Drop Script**:
   Connect to your target cloud database and run:
   ```sql
   SET FOREIGN_KEY_CHECKS = 0;

   -- Drop all 84 tables safely regardless of dependency ordering
   DROP TABLE IF EXISTS `__efmigrationshistory`, `attribute_values`, `attributes`, `audit_logs`,
   `barcodes`, `bin_stock`, `bin_transfer_audits`, `bins`, `brands`, `categories`,
   `customer_activity`, `customer_addresses`, `customer_bank_details`, `customer_contacts`,
   `customer_ledger`, `customer_payment_terms`, `customer_payments`, `customers`,
   `cycle_counts`, `goods_receipt_items`, `goods_receipts`, `invoice_items`, `invoices`,
   `location_movements`, `login_history`, `modules`, `notifications`, `otps`,
   `pendingusers`, `product_images`, `product_variants`, `products`, `purchase_indent_items`,
   `purchase_indents`, `purchase_order_items`, `purchase_orders`, `purchase_return_items`,
   `purchase_return_items_backup_20260821`, `purchase_returns`,
   `purchase_returns_backup_20260821`, `putaway_audits`, `racks`, `refresh_tokens`,
   `role_permissions`, `role_permissions_backup`, `roles`, `sales_order_items`,
   `sales_orders`, `sales_return_items`, `sales_return_items_backup`,
   `sales_return_items_backup_20260821`, `sales_returns`, `sales_returns_backup`,
   `sales_returns_backup_20260821`, `settings`, `stock`, `stock_adjustment_items`,
   `stock_adjustments`, `stock_audit_items`, `stock_audits`, `stock_ledger`,
   `stock_movements`, `stock_transfer_items`, `stock_transfers`, `sub_categories`,
   `supplier_addresses`, `supplier_bank_details`, `supplier_contacts`, `supplier_documents`,
   `supplier_payment_terms`, `supplier_payments`, `supplier_performance`, `suppliers`,
   `system_setting_rules`, `system_setting_sections`, `system_settings`, `units`,
   `user_tokens`, `users`, `variant_attribute_values`, `warehouse_transfer_audits`,
   `warehouse_users`, `warehouse_zones`, `warehouses`;

   SET FOREIGN_KEY_CHECKS = 1;
   ```

2. **Verify Database is Empty**:
   ```sql
   SELECT COUNT(*) AS remaining_tables FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
   -- Should return 0
   ```

3. **Re-run the Complete Import**:
   ```bash
   mysql --host=<HOST> --port=<PORT> --user=<USER> -p --ssl-ca=ca.pem <DATABASE_NAME> < 00_full_cloud_import.sql
   ```

---

## 2. Scenario B: Schema Succeeded but Data Import Failed

If table structures were created but data insertion was interrupted:

1. **Truncate All Populated Tables**:
   ```sql
   SET FOREIGN_KEY_CHECKS = 0;
   TRUNCATE TABLE `role_permissions`;
   TRUNCATE TABLE `system_setting_rules`;
   TRUNCATE TABLE `modules`;
   TRUNCATE TABLE `products`;
   TRUNCATE TABLE `__efmigrationshistory`;
   TRUNCATE TABLE `sub_categories`;
   TRUNCATE TABLE `system_setting_sections`;
   TRUNCATE TABLE `categories`;
   TRUNCATE TABLE `brands`;
   TRUNCATE TABLE `roles`;
   TRUNCATE TABLE `units`;
   TRUNCATE TABLE `warehouses`;
   TRUNCATE TABLE `bins`;
   TRUNCATE TABLE `racks`;
   TRUNCATE TABLE `users`;
   SET FOREIGN_KEY_CHECKS = 1;
   ```

2. **Re-import Pure Data File (`02_data.sql`)**:
   ```bash
   mysql --host=<HOST> --port=<PORT> --user=<USER> -p --ssl-ca=ca.pem <DATABASE_NAME> < 02_data.sql
   ```

3. **Validate Row Counts**:
   ```bash
   python compare_row_counts.py
   ```

---

## 3. Scenario C: Live Production Backup & Point-in-Time Recovery

Once operational data is written to the cloud database:

### Creating an On-Demand Backup Snapshot
Run this command from your DevOps machine to generate a timestamped cloud backup:
```bash
mysqldump \
  --host=<AIVEN_HOST> \
  --port=<AIVEN_PORT> \
  --user=<AIVEN_USER> \
  --password \
  --ssl-ca=ca.pem \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  <AIVEN_DATABASE_NAME> > backup_enterprise_wms_$(date +%Y%m%d_%H%M%S).sql
```

### Aiven Point-in-Time Recovery (PITR)
1. In the Aiven Console, select your MySQL service.
2. Navigate to **Backups**.
3. Aiven automatically maintains continuous WAL / binlog backups.
4. Click **Restore to a New Service** and select the timestamp immediately prior to the unexpected event.
5. Point Django's `DB_HOST` and `DB_PORT` in Render to the restored instance.
