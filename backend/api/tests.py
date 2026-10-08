"""Run with:  DB_ENGINE=sqlite python manage.py test      (uses an in-memory SQLite database)"""
from rest_framework.test import APIClient
from django.test import TestCase

from api.core.fieldtypes import utcnow
from api.models import Brands, Categories, Modules, RolePermissions, Roles, Units, Users, Warehouses, Products, SystemSettings
from api.views.auth import hash_password


class ApiFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        role = Roles.objects.create(role_name="Admin", description="Admin", created_at=utcnow(), is_active=True)
        mod = Modules.objects.create(module_key="products", module_name="Products", display_order=1, is_active=True)
        RolePermissions.objects.create(role_id=role.pk, module_id=mod.pk, can_view=True, can_add=True, can_edit=True, can_delete=True, created_at=utcnow(), updated_at=utcnow())
        Users.objects.create(name="Admin", email="admin@test.in", password_hash=hash_password("Admin@1234"), role="Admin", is_active=True, is_email_verified=True,
                             phone_number="9000000000", created_at=utcnow(), updated_at=utcnow(), token_version=1)
        SystemSettings.objects.create(company_name="IMS", enable_two_factor_auth=False, created_at=utcnow())
        Warehouses.objects.create(name="Main", warehouse_code="WH-001", status="active", created_at=utcnow(), updated_at=utcnow(), is_deleted=False)
        Categories.objects.create(name="Cat", is_deleted=False); Brands.objects.create(name="Brand", is_deleted=False)
        Units.objects.create(name="Pieces", short_name="Pcs", is_deleted=False)

    def setUp(self):
        self.c = APIClient()
        r = self.c.post("/api/auth/login", {"emailOrPhone": "admin@test.in", "password": "Admin@1234"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.c.credentials(HTTP_AUTHORIZATION="Bearer " + r.json()["data"]["token"])

    def test_login_rejects_wrong_password(self):
        r = APIClient().post("/api/auth/login", {"emailOrPhone": "admin@test.in", "password": "nope"}, format="json")
        self.assertEqual(r.status_code, 401); self.assertFalse(r.json()["success"])

    def test_requires_authentication(self):
        self.assertEqual(APIClient().get("/api/products").status_code, 401)

    def test_purchase_to_sale_updates_stock(self):
        c = self.c
        sup = c.post("/api/suppliers", {"name": "Acme"}, format="json").json()["data"]["supplierId"]
        pid = c.post("/api/products", {"name": "Widget", "sku": "w-1", "price": 100, "costPrice": 60, "categoryId": 1, "brandId": 1, "unitId": 1}, format="json").json()["data"]["productId"]
        po = c.post("/api/PurchaseOrders", {"supplierId": sup, "productId": pid, "quantity": 10, "price": 60}, format="json").json()["data"]["poId"]
        self.assertEqual(c.post("/api/GoodsReceipts", {"poId": po, "warehouseId": 1, "items": [{"productId": pid, "quantityReceived": 5}]}, format="json").status_code, 400)  # not approved
        c.post(f"/api/PurchaseOrders/{po}/approve", {}, format="json")
        self.assertEqual(c.post("/api/GoodsReceipts", {"poId": po, "warehouseId": 1, "items": [{"productId": pid, "quantityReceived": 11}]}, format="json").status_code, 400)  # over-receive
        self.assertEqual(c.post("/api/GoodsReceipts", {"poId": po, "warehouseId": 1, "items": [{"productId": pid, "quantityReceived": 10}]}, format="json").status_code, 201)
        self.assertEqual(Products.objects.get(pk=pid).stock, 10)
        cust = c.post("/api/customers", {"name": "Buyer"}, format="json").json()["data"]["customerId"]
        over = c.post("/api/Invoices", {"customerId": cust, "warehouseId": 1, "items": [{"productId": pid, "quantity": 11, "price": 100}]}, format="json")
        self.assertEqual(over.status_code, 400)
        ok = c.post("/api/Invoices", {"customerId": cust, "warehouseId": 1, "items": [{"productId": pid, "quantity": 4, "price": 100}]}, format="json")
        self.assertEqual(ok.status_code, 201, ok.content); self.assertEqual(Products.objects.get(pk=pid).stock, 6)
        inv = ok.json()["data"]["invoiceId"]
        self.assertEqual(c.post(f"/api/Invoices/{inv}/cancel", {}, format="json").status_code, 200)
        self.assertEqual(Products.objects.get(pk=pid).stock, 10)       # cancelling restores stock

    def test_duplicate_sku_rejected(self):
        body = {"name": "A", "sku": "dup-1", "price": 1}
        self.assertEqual(self.c.post("/api/products", body, format="json").status_code, 201)
        self.assertEqual(self.c.post("/api/products", {**body, "name": "B"}, format="json").status_code, 409)
