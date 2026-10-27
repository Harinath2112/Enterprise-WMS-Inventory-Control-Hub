# Enterprise WMS Cloud Database Migration Package

This package prepares the Enterprise WMS / Inventory Control Hub MySQL database for migration to **Aiven Free MySQL** (or any cloud-managed MySQL 8.0 instance) without data loss, constraint corruption, or service interruption.

---

## 1. Package Contents

| File | Purpose |
|---|---|
| `00_full_cloud_import.sql` | **Primary Import File**: Self-contained cloud import containing all 84 tables (DDL) and 410 rows of seed data (DML). Stripped of server-specific `CREATE DATABASE` and `USE` statements. |
| `01_schema.sql` | **Schema Only**: Pure DDL creating all 84 tables, primary keys, foreign keys, unique keys, and indexes. Zero rows inserted. |
| `02_data.sql` | **Seed Data Only**: Pure DML inserting the 410 baseline records across the 15 populated configuration and master tables. |
| `validate_schema.py` | **Read-Only Schema Validator**: Python script that connects to the target database and verifies all 84 tables, engine type (`InnoDB`), collation (`utf8mb4`), and foreign keys. |
| `compare_row_counts.py` | **Read-Only Data Integrity Validator**: Python script that executes table-by-table row count comparisons against the 410-row baseline. |
| `ROLLBACK_AND_RECOVERY.md` | **Recovery Procedures**: Step-by-step instructions for recovery, clean-slate resets, and backup procedures. |
| `README.md` | This implementation and migration guide. |

---

## 2. Database Schema & Size Summary

- **Total Tables**: 84
- **Storage Engine**: `InnoDB` (100% of tables)
- **Character Set / Collation**: `utf8mb4` / `utf8mb4_0900_ai_ci`
- **Total Foreign Key Constraints**: 87 (all targets exist within the schema)
- **Views / Stored Procedures / Triggers / Events**: 0 (pure relational schema; business logic lives in Django)
- **Total Seed Data Rows**: 410
- **Populated Tables (15)**:
  - `role_permissions` (190)
  - `system_setting_rules` (101)
  - `modules` (38)
  - `products` (18)
  - `__efmigrationshistory` (12)
  - `sub_categories` (12)
  - `system_setting_sections` (11)
  - `categories` (6)
  - `brands` (5)
  - `roles` (5)
  - `units` (5)
  - `warehouses` (3)
  - `bins` (2)
  - `racks` (1)
  - `users` (1)
- **Operational / Transactional Tables (69)**: 0 rows (ready for live transactions)
- **Estimated Storage Footprint on Aiven**: ~35 MB to 45 MB (inclusive of InnoDB system tablespace, undo/redo logs, and initial extents).
- **Aiven Free Storage Quota**: 1.00 GB (1,024 MB). Over **95% headroom** remaining.

---

## 3. Why the Original SQL Dump Required Sanitization

The raw backup dump (`database/imsdatabase.sql`) begins with:
```sql
CREATE DATABASE IF NOT EXISTS `imsdatabase` ...;
USE imsdatabase;
```
On managed database platforms like **Aiven for MySQL**:
1. Users authenticate as service-level administrators (e.g. `avnadmin`), who do not possess global `CREATE DATABASE` superuser permissions. Running `CREATE DATABASE` results in:
   `ERROR 1044 (42000): Access denied for user 'avnadmin'@'%' to database 'imsdatabase'`
2. Aiven pre-allocates an initial database named `defaultdb`. Attempting `USE imsdatabase;` either produces `ERROR 1049 (Unknown database)` or creates disjoint objects outside the intended target database.
3. The generated cloud migration files (`00_full_cloud_import.sql`, `01_schema.sql`, `02_data.sql`) safely omit these statements, allowing the client to specify the target database name during the connection command.

---

## 4. Migration Execution Guide

### Step 1: Provision Aiven Free MySQL
1. Log into your [Aiven Console](https://console.aiven.io/).
2. Create a new service:
   - **Service**: MySQL
   - **Plan**: Free (or Startup-4)
   - **Cloud Provider & Region**: Select a region close to your Render backend (e.g., Frankfurt `eu-central-1` or Oregon `us-west-2` or Virginia `us-east-1`).
3. Once running, copy the connection details from the Aiven Service Overview:
   - **Host**: e.g., `mysql-3c829xxx-my-project.aivencloud.com`
   - **Port**: e.g., `21432`
   - **User**: `avnadmin`
   - **Password**: `<your-aiven-password>`
   - **Database**: `defaultdb` (or create a database named `imsdatabase`)
4. Download the **CA Certificate** (`ca.pem`) from the Aiven console.

---

### Step 2: Execute Cloud Import

#### Option A: Single Unified Import (Recommended)
From your terminal, execute:
```bash
mysql \
  --host=<AIVEN_HOST> \
  --port=<AIVEN_PORT> \
  --user=<AIVEN_USER> \
  --password \
  --ssl-ca=ca.pem \
  <AIVEN_DATABASE_NAME> < 00_full_cloud_import.sql
```
*(On Windows PowerShell, use quotes or cmd.exe redirection)*:
```powershell
Get-Content 00_full_cloud_import.sql | mysql --host=<AIVEN_HOST> --port=<AIVEN_PORT> --user=<AIVEN_USER> -p --ssl-ca=ca.pem <AIVEN_DATABASE_NAME>
```

#### Option B: Two-Step Import (Schema then Data)
```bash
# 1. Create all 84 tables and constraints
mysql --host=<AIVEN_HOST> --port=<AIVEN_PORT> --user=<AIVEN_USER> -p --ssl-ca=ca.pem <AIVEN_DATABASE_NAME> < 01_schema.sql

# 2. Insert seed records (410 rows)
mysql --host=<AIVEN_HOST> --port=<AIVEN_PORT> --user=<AIVEN_USER> -p --ssl-ca=ca.pem <AIVEN_DATABASE_NAME> < 02_data.sql
```

---

### Step 3: Run Validation Scripts

Set your cloud connection variables in your terminal:
```bash
export DB_HOST="<AIVEN_HOST>"
export DB_PORT="<AIVEN_PORT>"
export DB_NAME="<AIVEN_DATABASE_NAME>"
export DB_USER="avnadmin"
export DB_PASSWORD="<AIVEN_PASSWORD>"
export DB_SSL="1"
export DB_SSL_CA="/path/to/ca.pem"
```
*(On Windows PowerShell)*:
```powershell
$env:DB_HOST="<AIVEN_HOST>"
$env:DB_PORT="<AIVEN_PORT>"
$env:DB_NAME="<AIVEN_DATABASE_NAME>"
$env:DB_USER="avnadmin"
$env:DB_PASSWORD="<AIVEN_PASSWORD>"
$env:DB_SSL="1"
$env:DB_SSL_CA="C:\path\to\ca.pem"
```

Run schema verification:
```bash
python validate_schema.py
```
*Expected Output:*
```
Target Database Base Tables Found: 84 / 84 expected
[PASS] All 84 expected tables exist.
Foreign Key Constraints Found: 87 (Baseline expected: 87)
[PASS] All tables use InnoDB storage engine.
[PASS] All tables use utf8mb4 character set.
SCHEMA VALIDATION: PASS
```

Run row count verification:
```bash
python compare_row_counts.py
```
*Expected Output:*
```
Total Rows Expected: 410
Total Rows Actual:   410
ROW COUNT VALIDATION: PASS (All 84 tables match baseline data)
```

---

## 5. Django Production Configuration (Render Free)

In your Render Dashboard for the Django Web Service, add the following Environment Variables under **Environment**:

| Variable | Value | Purpose |
|---|---|---|
| `DB_ENGINE` | `mysql` | Directs Django to PyMySQL backend |
| `DB_HOST` | `<AIVEN_HOST>` | Aiven connection endpoint |
| `DB_PORT` | `<AIVEN_PORT>` | Aiven port number |
| `DB_NAME` | `<AIVEN_DB_NAME>` | e.g., `defaultdb` |
| `DB_USER` | `avnadmin` | Aiven user |
| `DB_PASSWORD` | `<AIVEN_PASSWORD>` | Database password |
| `DB_SSL` | `1` | Forces TLS/SSL encryption |
| `DB_SSL_CA` | `/etc/secrets/ca.pem` | (Optional) Path to Secret File mounted on Render |
| `DB_CONN_MAX_AGE` | `60` | Reuses TLS connections for 60s, eliminating per-request handshake overhead |

*(On Render, upload `ca.pem` as a Secret File under `/etc/secrets/ca.pem` if strict CA verification is desired).*
