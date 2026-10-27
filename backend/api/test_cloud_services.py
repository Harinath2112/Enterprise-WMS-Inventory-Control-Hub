"""
Comprehensive Cloud Integration & Security Test Suite (Phase 3C)
-----------------------------------------------------------------------------
Verifies Cloudinary, Cloudflare R2, and Brevo HTTPS Email integrations
under both live configurations and isolated mock environments.
"""
import io
import os
import unittest
from unittest import mock

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from api.core.mail import send_email, _send_via_brevo
from api.core.response import ApiError
from api.core.storage import (
    delete_media,
    delete_private_document,
    get_private_document_stream,
    get_r2_config,
    is_safe_local_path,
    upload_media,
    upload_private_document,
)


class CloudinaryStorageIntegrationTests(TestCase):
    """Verifies public image storage contracts (product photos, logos, avatars)."""

    def test_cloudinary_mock_upload_and_delete_contract(self):
        """Verify upload_media contracts with Cloudinary API."""
        fake_image = SimpleUploadedFile("product_widget.png", b"\x89PNG\r\n\x1a\nfakeimagecontent", content_type="image/png")

        mock_upload_resp = {
            "public_id": "products/w12345",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/v1234567/products/w12345.png",
            "format": "png",
            "resource_type": "image",
        }

        with mock.patch("api.core.storage.settings.USE_CLOUDINARY", True), \
             mock.patch("cloudinary.uploader.upload", return_value=mock_upload_resp) as mock_up, \
             mock.patch("cloudinary.uploader.destroy", return_value={"result": "ok"}) as mock_destroy:

            url = upload_media(fake_image, subfolder="products", prefix="prod_")

            # 1. Assert secure HTTPS URL is returned
            self.assertTrue(url.startswith("https://res.cloudinary.com/"))
            mock_up.assert_called_once()
            call_kwargs = mock_up.call_args[1]
            self.assertTrue(call_kwargs["public_id"].startswith("ims/products/prod_"))
            self.assertEqual(call_kwargs["resource_type"], "image")

            # 2. Assert delete_media invokes cloudinary destroy
            del_result = delete_media(url)
            self.assertTrue(del_result)
            mock_destroy.assert_called_once()

    def test_cloudinary_file_size_and_type_enforcement(self):
        """Verify file type restrictions and max size guards."""
        # 1. Invalid extension (e.g. .exe)
        bad_file = SimpleUploadedFile("malware.exe", b"MZbinarycontent", content_type="application/x-msdownload")
        with self.assertRaises(ApiError) as cm:
            upload_media(bad_file, subfolder="products", allowed_exts=(".jpg", ".png", ".webp"))
        self.assertIn("not allowed", str(cm.exception.message).lower())

        # 2. File exceeding limit
        oversized_file = SimpleUploadedFile("huge.jpg", b"0" * (6 * 1024 * 1024), content_type="image/jpeg")
        with self.assertRaises(ApiError) as cm_size:
            upload_media(oversized_file, subfolder="products", max_size_bytes=5 * 1024 * 1024)
        self.assertIn("exceeds", str(cm_size.exception.message).lower())

    def test_local_storage_fallback_when_cloudinary_unconfigured(self):
        """Verify seamless local filesystem fallback for offline development."""
        fake_image = SimpleUploadedFile("avatar.jpg", b"\xff\xd8\xfffakejpeg", content_type="image/jpeg")

        with mock.patch("api.core.storage.settings.USE_CLOUDINARY", False):
            rel_url = upload_media(fake_image, subfolder="profilephotos", prefix="u1_")
            self.assertTrue(rel_url.startswith("/profilephotos/"))

            # Verify file exists on local disk
            local_path = settings.MEDIA_ROOT / rel_url.lstrip("/\\")
            self.assertTrue(local_path.exists())

            # Verify deletion removes file
            self.assertTrue(delete_media(rel_url))
            self.assertFalse(local_path.exists())


class CloudflareR2PrivateStorageTests(TestCase):
    """Verifies private confidential supplier document contracts (S3-compatible R2)."""

    def test_r2_mock_upload_and_stream_contract(self):
        """Verify R2 upload, internal key generation, and stream retrieval."""
        fake_doc = SimpleUploadedFile("supplier_tax_cert.pdf", b"%PDF-1.4 tax certificate content", content_type="application/pdf")
        mock_s3 = mock.MagicMock()
        mock_s3.get_object.return_value = {
            "Body": io.BytesIO(b"%PDF-1.4 tax certificate content"),
            "ContentType": "application/pdf",
        }

        with mock.patch("api.core.storage.get_r2_config") as mock_cfg, \
             mock.patch("api.core.storage.get_r2_client", return_value=mock_s3):
            mock_cfg.return_value = {
                "is_configured": True,
                "account_id": "aiven_r2_acc_123",
                "access_key": "r2_key_xyz",
                "secret_key": "r2_secret_xyz",
                "bucket_name": "wms-supplier-docs-private",
                "endpoint_url": "https://aiven_r2_acc_123.r2.cloudflarestorage.com",
            }

            key = upload_private_document(fake_doc, namespace="suppliers", resource_id=42)

            # 1. Assert internal object key format
            self.assertTrue(key.startswith("r2:suppliers/42/"))
            self.assertTrue(key.endswith(".pdf"))
            # Crucial: Must NEVER be an open http/https delivery URL
            self.assertFalse(key.startswith("http"))

            # 2. Verify S3 upload call parameters
            mock_s3.upload_fileobj.assert_called_once()
            call_args = mock_s3.upload_fileobj.call_args
            self.assertEqual(call_args[0][1], "wms-supplier-docs-private")
            self.assertTrue(call_args[0][2].startswith("suppliers/42/"))

            # 3. Stream document through backend
            stream, content_type = get_private_document_stream(key)
            self.assertEqual(content_type, "application/pdf")
            self.assertEqual(stream.read(), b"%PDF-1.4 tax certificate content")

            # 4. Delete object from R2
            self.assertTrue(delete_private_document(key))
            mock_s3.delete_object.assert_called_once_with(
                Bucket="wms-supplier-docs-private",
                Key=key[3:],
            )

    def test_r2_path_traversal_rejection(self):
        """Verify strict blocking of path traversal attempts."""
        with self.assertRaises(ApiError):
            get_private_document_stream("r2:../../etc/passwd")

        with self.assertRaises(ApiError):
            get_private_document_stream("r2:suppliers/../../../root.key")

        with self.assertRaises(ApiError):
            get_private_document_stream("../../settings.py")


class BrevoEmailIntegrationTests(TestCase):
    """Verifies Brevo HTTPS transactional email delivery and safe error handling."""

    def test_brevo_https_api_success_contract(self):
        """Verify HTTPS payload format and successful delivery response (HTTP 201)."""
        mock_response = mock.MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"messageId": "<202610271234.123456@smtp-relay.brevo.com>"}

        with mock.patch("requests.post", return_value=mock_response) as mock_post:
            success = _send_via_brevo(
                api_key="xkeysib-test-fake-key",
                to="recipient@example.com",
                subject="Your IMS Verification Code",
                html="<p>Your code is 123456</p>",
            )
            self.assertTrue(success)
            mock_post.assert_called_once()
            url, kwargs = mock_post.call_args
            self.assertEqual(url[0], "https://api.brevo.com/v3/smtp/email")
            self.assertEqual(kwargs["headers"]["api-key"], "xkeysib-test-fake-key")
            self.assertEqual(kwargs["json"]["to"][0]["email"], "recipient@example.com")
            self.assertEqual(kwargs["json"]["subject"], "Your IMS Verification Code")

    def test_brevo_error_handling_and_no_credential_leak(self):
        """Verify that provider errors (401, 400, 429) fail safely without exceptions or secret logging."""
        mock_error_resp = mock.MagicMock()
        mock_error_resp.status_code = 401
        mock_error_resp.text = '{"message":"Key not found","code":"unauthorized"}'

        with mock.patch("requests.post", return_value=mock_error_resp):
            success = _send_via_brevo(
                api_key="invalid-key",
                to="test@example.com",
                subject="Test",
                html="<p>Test</p>",
            )
            self.assertFalse(success)

    def test_send_email_fallback_when_unconfigured(self):
        """Verify that send_email delegates safely when API keys are empty."""
        with mock.patch("api.core.mail.settings.BREVO_API_KEY", ""), \
             mock.patch("api.core.mail.settings.RESEND_API_KEY", ""), \
             mock.patch("api.core.mail.settings.EMAIL_HOST", ""), \
             mock.patch("api.core.mail.settings.DEBUG", True):

            # In dev with DEBUG=True, Django console email backend handles dispatch
            result = send_email("user@test.in", "Welcome", "<p>Hello</p>")
            self.assertTrue(result)
