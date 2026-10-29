# Enterprise WMS — Guest Preview Mode Route Coverage Audit

**Audit Date:** 2026-10-29  
**Branch:** `feat/guest-preview-mode`  
**Workspace:** `D:\hari\Projects\Enterprise-WMS-Inventory-Control-Hub`  
**Execution Environment:** Isolated Client-Side Guest Session  

---

## 1. Executive Summary

Every declared route in the Enterprise WMS application was audited to ensure full accessibility under Guest Preview Mode. In guest mode, authorized shells, tables, forms, and headers are rendered in their authentic visual layout, while all business records, financial figures, transactions, and mutations remain strictly isolated and unpopulated.

---

## 2. Route Matrix & Verification Results

| Route Path | Module Name | Permission Model | Guest Access | Data State | Modal on Entry | Actions Guarded |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Landing / Redirect | Public / Allowed | Redirects to `/dashboard` | Neutral | No | N/A |
| `/login` | Authentication | Public | Accessible | Form Blank | No | "Continue as Guest" Active |
| `/dashboard` | Operations Dashboard | View (Guest) | PASS | Empty metrics ("—", "Hidden in Guest Mode") | YES (First Entry) | Bypassed API |
| `/inventory/products` | Products Catalog | View (Guest) | PASS | Headers intact, 0 records | YES | Add/Edit/Delete blocked |
| `/inventory/categories` | Categories | View (Guest) | PASS | Category table shell intact | YES | Mutations blocked |
| `/inventory/subcategories`| Sub-Categories | View (Guest) | PASS | Sub-category shell intact | YES | Mutations blocked |
| `/inventory/brands` | Brands | View (Guest) | PASS | Brand list shell intact | YES | Mutations blocked |
| `/inventory/units` | Units of Measure | View (Guest) | PASS | Units list shell intact | YES | Mutations blocked |
| `/inventory/attributes` | Product Attributes | View (Guest) | PASS | Attribute list shell intact | YES | Mutations blocked |
| `/inventory/product-variants`| Product Variants | View (Guest) | PASS | Variants table shell intact | YES | Mutations blocked |
| `/inventory/stock` | Stock Register | View (Guest) | PASS | Stock table shell intact | YES | Adjustments blocked |
| `/inventory/purchase-indents`| Purchase Indents | View (Guest) | PASS | Indents table shell intact | YES | Create/Approve blocked |
| `/inventory/goods-receipts` | Goods Receipts (GRN) | View (Guest) | PASS | GRN table shell intact | YES | Receipt creation blocked |
| `/inventory/purchase-returns`| Purchase Returns | View (Guest) | PASS | Returns table shell intact | YES | Return creation blocked |
| `/inventory/purchases` | Purchase Orders | View (Guest) | PASS | PO table shell intact | YES | PO generation blocked |
| `/inventory/audit` | Inventory Audit | View (Guest) | PASS | Audit table shell intact | YES | Reconcile blocked |
| `/inventory/barcode` | Barcode Management | View (Guest) | PASS | Barcode generator shell | YES | Print / Generate guarded |
| `/pos/sales` | Sales Invoices | View (Guest) | PASS | Invoices table shell intact | YES | Invoicing blocked |
| `/pos/sales/create` | Create Sales Invoice | View (Guest) | PASS | Form shell intact, data empty | YES | Finalize blocked |
| `/pos/returns` | Sales Returns | View (Guest) | PASS | Returns table shell intact | YES | Returns blocked |
| `/people/suppliers` | Suppliers Directory | View (Guest) | PASS | Suppliers table shell intact | YES | Add/Edit blocked |
| `/people/customers` | Customers Directory | View (Guest) | PASS | Customers table shell intact | YES | Add/Edit blocked |
| `/people/customer-payments`| Customer Payments | View (Guest) | PASS | Payments table shell intact | YES | Record payment blocked |
| `/people/supplier-payments`| Supplier Payments | View (Guest) | PASS | Payments table shell intact | YES | Record payment blocked |
| `/management/warehouses` | Warehouses | View (Guest) | PASS | Warehouse cards shell intact | YES | Add/Edit/Transfer blocked |
| `/management/reports` | Business Reports | View (Guest) | PASS | Report cards shell intact | YES | Export blocked |
| `/management/notifications`| System Notifications | View (Guest) | PASS | Clean placeholder | YES | Clear/Read blocked |
| `/management/accounting` | Accounts & Invoicing | View (Guest) | PASS | Invoices table shell intact | YES | Transactions blocked |
| `/administration/users` | User Accounts | View (Guest) | PASS | User table shell intact | YES | User creation blocked |
| `/administration/roles` | Roles & Permissions | View (Guest) | PASS | Roles matrix shell intact | YES | Role assignment blocked |
| `/administration/audit-logs`| Audit Logs | View (Guest) | PASS | Log table shell intact | YES | Log purge blocked |
| `/administration/settings` | System Settings | View (Guest) | PASS | Settings form shell intact | YES | Save settings blocked |

---

## 3. Navigation & Modal Behavioral Coverage

1. **Initial Entry Trigger:**
   - Navigating from `/login` via "Continue as Guest" establishes the guest session in `sessionStorage` (`ims-guest-mode: true`).
   - Browser redirects to `/dashboard`.
   - `lastPathnameRef` in `MainLayout.jsx` initializes from `null`, displaying the `GuestPreviewModal` dialog immediately.

2. **Inter-Module Route Transitions:**
   - Clicking any link in the Sidebar (e.g. Products, Customers, Warehouses, Accounting, Reports) updates `location.pathname`.
   - `MainLayout.jsx` compares the new path with `lastPathnameRef.current`.
   - Modal dialog re-displays with a description reminding the visitor that the current module is presented in preview mode.

3. **In-Page Sub-Tab / State Updates:**
   - State updates within a page (such as toggling filter tabs, sorting columns, or typing into search inputs) do not change `location.pathname`, preventing intrusive or disruptive modal popups during interaction.

4. **Exit Flow:**
   - Clicking "Exit Guest Mode" in the modal or in the User Menu calls `exitGuestMode()`.
   - Wipes `sessionStorage` (`ims-guest-mode`), clears guest state, and routes to `/login`.

