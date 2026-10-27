"""Run with:  DB_ENGINE=sqlite python manage.py test      (uses an in-memory SQLite database)"""
from rest_framework.test import APIClient
from django.test import TestCase

from api.core.fieldtypes import utcnow
from api.models import (Brands, Categories, Modules, RolePermissions, Roles, Units, Users, Warehouses, Products, SystemSettings,
                        SupplierDocuments, Suppliers)
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


class SupplierDocumentSecurityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        admin_role = Roles.objects.create(role_name="Admin", description="Admin", created_at=utcnow(), is_active=True)
        staff_role = Roles.objects.create(role_name="Staff", description="Staff without supplier doc access", created_at=utcnow(), is_active=True)
        mod_suppliers = Modules.objects.create(module_key="suppliers", module_name="Suppliers", display_order=2, is_active=True)
        RolePermissions.objects.create(role_id=admin_role.pk, module_id=mod_suppliers.pk, can_view=True, can_add=True, can_edit=True, can_delete=True, created_at=utcnow(), updated_at=utcnow())
        RolePermissions.objects.create(role_id=staff_role.pk, module_id=mod_suppliers.pk, can_view=False, can_add=False, can_edit=False, can_delete=False, created_at=utcnow(), updated_at=utcnow())

        Users.objects.create(name="Admin", email="admin@test.in", password_hash=hash_password("Admin@1234"), role="Admin", is_active=True, is_email_verified=True,
                             phone_number="9000000000", created_at=utcnow(), updated_at=utcnow(), token_version=1)
        Users.objects.create(name="Staff", email="staff@test.in", password_hash=hash_password("Staff@1234"), role="Staff", is_active=True, is_email_verified=True,
                             phone_number="9000000001", created_at=utcnow(), updated_at=utcnow(), token_version=1)
        cls.sup = Suppliers.objects.create(name="Secure Supplier Ltd", is_deleted=False, created_at=utcnow(), updated_at=utcnow())

    def setUp(self):
        self.admin_client = APIClient()
        r_admin = self.admin_client.post("/api/auth/login", {"emailOrPhone": "admin@test.in", "password": "Admin@1234"}, format="json")
        self.admin_client.credentials(HTTP_AUTHORIZATION="Bearer " + r_admin.json()["data"]["token"])

        self.staff_client = APIClient()
        r_staff = self.staff_client.post("/api/auth/login", {"emailOrPhone": "staff@test.in", "password": "Staff@1234"}, format="json")
        self.staff_client.credentials(HTTP_AUTHORIZATION="Bearer " + r_staff.json()["data"]["token"])

        self.anon_client = APIClient()

    def test_anonymous_user_cannot_access_or_download_supplier_documents(self):
        r = self.anon_client.get("/api/suppliers/documents/1/download")
        self.assertEqual(r.status_code, 401)

        r_list = self.anon_client.get(f"/api/suppliers/{self.sup.pk}/documents")
        self.assertEqual(r_list.status_code, 401)

    def test_unauthorized_user_cannot_view_or_download_supplier_documents(self):
        r_list = self.staff_client.get(f"/api/suppliers/{self.sup.pk}/documents")
        self.assertEqual(r_list.status_code, 403)
        self.assertIn("permission", r_list.json().get("message", "").lower())

        doc = SupplierDocuments.objects.create(
            supplier_id=self.sup.pk,
            display_name="Confidential Contract",
            original_file_name="contract.pdf",
            stored_file_name="contract_123.pdf",
            file_path="/uploads/suppliers/1/contract_123.pdf",
            document_type="Contract",
            content_type="application/pdf",
            file_size_bytes=1024,
            is_deleted=False,
            is_temporary=False,
        )
        r_dl = self.staff_client.get(f"/api/suppliers/documents/{doc.pk}/download")
        self.assertEqual(r_dl.status_code, 403)

    from unittest.mock import patch

    @patch("api.core.storage.get_r2_config", return_value={"is_configured": False})
    def test_authorized_user_upload_does_not_leak_internal_paths_or_keys(self, mock_r2_cfg):
        from django.core.files.uploadedfile import SimpleUploadedFile
        test_file = SimpleUploadedFile("tax_gst.pdf", b"%PDF-1.4 simulated pdf content", content_type="application/pdf")
        r = self.admin_client.post(
            f"/api/suppliers/{self.sup.pk}/documents/upload",
            {"file": test_file, "documentType": "GST Certificate", "displayName": "GST 2026"},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201)
        data = r.json()["data"]
        self.assertNotIn("filePath", data)
        self.assertNotIn("file_path", data)
        self.assertEqual(data["fileName"], "tax_gst.pdf")
        self.assertEqual(data["type"], "GST Certificate")

        doc_id = data["documentId"]
        r_dl = self.admin_client.get(f"/api/suppliers/documents/{doc_id}/download")
        self.assertEqual(r_dl.status_code, 200)
        self.assertIn("attachment", r_dl.headers.get("Content-Disposition", ""))
        self.assertEqual(r_dl.headers.get("Content-Type"), "application/pdf")
        self.assertEqual(b"".join(r_dl.streaming_content), b"%PDF-1.4 simulated pdf content")

    def test_path_traversal_attempts_are_blocked(self):
        from api.core.response import ApiError
        from api.core.storage import get_private_document_stream
        with self.assertRaises(ApiError) as cm:
            get_private_document_stream("../../etc/passwd")
        self.assertIn("traversal", str(cm.exception.message).lower())

        with self.assertRaises(ApiError) as cm_r2:
            get_private_document_stream("r2:../../malicious/key")
        self.assertIn("malformed", str(cm_r2.exception.message).lower())

    def test_cloudflare_r2_mock_upload_and_download_flow(self):
        import io
        import unittest.mock as mock
        from django.core.files.uploadedfile import SimpleUploadedFile
        from api.core.storage import (
            get_private_document_stream,
            upload_private_document,
            delete_private_document,
        )

        mock_s3_client = mock.MagicMock()
        mock_s3_client.get_object.return_value = {
            "Body": io.BytesIO(b"%PDF-1.5 encrypted contract binary"),
            "ContentType": "application/pdf",
        }

        with mock.patch("api.core.storage.get_r2_config") as mock_cfg, \
             mock.patch("api.core.storage.get_r2_client", return_value=mock_s3_client):
            mock_cfg.return_value = {
                "is_configured": True,
                "account_id": "test_account_123",
                "access_key": "test_access_key",
                "secret_key": "test_secret_key",
                "bucket_name": "wms-confidential-docs",
                "endpoint_url": "https://test_account_123.r2.cloudflarestorage.com",
            }

            fake_file = SimpleUploadedFile("supplier_nda.pdf", b"%PDF-1.5 encrypted contract binary", content_type="application/pdf")
            key = upload_private_document(fake_file, namespace="suppliers", resource_id=99)
            self.assertTrue(key.startswith("r2:suppliers/99/"))
            self.assertTrue(key.endswith(".pdf"))
            mock_s3_client.upload_fileobj.assert_called_once()
            call_args = mock_s3_client.upload_fileobj.call_args
            self.assertEqual(call_args[0][1], "wms-confidential-docs")
            self.assertTrue(call_args[0][2].startswith("suppliers/99/"))

            stream, ctype = get_private_document_stream(key)
            self.assertEqual(ctype, "application/pdf")
            self.assertEqual(stream.read(), b"%PDF-1.5 encrypted contract binary")

            del_result = delete_private_document(key)
            self.assertTrue(del_result)
            mock_s3_client.delete_object.assert_called_once_with(
                Bucket="wms-confidential-docs",
                Key=key[3:],
            )

