"""Storage abstraction supporting persistent Cloudinary storage and local disk fallback.
Preserves existing database column lengths and API response contracts.
"""
import logging
import os
import re
import uuid
from pathlib import Path

from django.conf import settings
from .response import ApiError

log = logging.getLogger("ims")


def sanitize_ext(filename: str) -> str:
    """Return lowercase extension including leading dot, e.g. '.jpg'."""
    ext = os.path.splitext(filename or "")[1].lower().strip()
    return re.sub(r"[^a-z0-9.]", "", ext)


def is_cloudinary_url(value: str) -> bool:
    """Check if a stored path/URL is hosted on Cloudinary."""
    if not value or not isinstance(value, str):
        return False
    return value.startswith(("http://res.cloudinary.com", "https://res.cloudinary.com"))


def upload_media(file_obj, subfolder: str, prefix: str = "", allowed_exts: tuple = None,
                 max_size_bytes: int = 10 * 1024 * 1024, is_raw: bool = False) -> str:
    """Upload a file to Cloudinary in production, or local MEDIA_ROOT in local dev.
    Returns the persistent HTTPS URL (Cloudinary) or relative path (local).
    """
    if not file_obj:
        raise ApiError("No file was uploaded.")

    ext = sanitize_ext(getattr(file_obj, "name", ""))
    if allowed_exts and ext not in allowed_exts:
        raise ApiError(f"File type '{ext}' is not allowed. Allowed types: {', '.join(allowed_exts)}.")

    size = getattr(file_obj, "size", 0)
    if max_size_bytes and size > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        raise ApiError(f"File size exceeds the {limit_mb} MB limit.")

    clean_subfolder = subfolder.strip("/\\").replace("\\", "/")
    safe_prefix = re.sub(r"[^a-zA-Z0-9_-]", "", prefix)

    # Production Cloudinary upload
    if getattr(settings, "USE_CLOUDINARY", False):
        try:
            import cloudinary
            import cloudinary.uploader

            # Generate concise public ID (keeps total URL ~80 chars, well within varchar(255))
            unique_token = uuid.uuid4().hex[:12]
            public_id = f"ims/{clean_subfolder}/{safe_prefix}{unique_token}"
            resource_type = "raw" if (is_raw or ext in (".pdf", ".docx", ".xlsx", ".zip")) else "image"

            # Reset file pointer to beginning
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)

            upload_result = cloudinary.uploader.upload(
                file_obj,
                public_id=public_id,
                resource_type=resource_type,
                overwrite=True,
                invalidate=True,
            )
            secure_url = upload_result.get("secure_url") or upload_result.get("url")
            if not secure_url:
                raise ApiError("Cloud storage did not return a valid file URL.")
            return secure_url
        except Exception as exc:
            log.exception("Cloudinary upload failed for %s: %s", getattr(file_obj, "name", "file"), exc)
            if not getattr(settings, "DEBUG", True):
                raise ApiError("Cloud file upload failed. Please verify storage settings.")

    # Local filesystem storage fallback (development / offline test mode)
    target_dir = settings.MEDIA_ROOT / Path(clean_subfolder)
    target_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{safe_prefix}{uuid.uuid4().hex}{ext}"
    target_path = target_dir / stored_name

    if hasattr(file_obj, "seek"):
        file_obj.seek(0)

    with open(target_path, "wb") as destination:
        if hasattr(file_obj, "chunks"):
            for chunk in file_obj.chunks():
                destination.write(chunk)
        else:
            destination.write(file_obj.read())

    return f"/{clean_subfolder}/{stored_name}"


def delete_media(file_url_or_path: str, is_raw: bool = False) -> bool:
    """Delete a media asset from Cloudinary or local disk."""
    if not file_url_or_path or not isinstance(file_url_or_path, str):
        return False

    if is_cloudinary_url(file_url_or_path):
        if not getattr(settings, "USE_CLOUDINARY", False):
            return False
        try:
            import cloudinary.uploader
            # Extract public_id from Cloudinary URL (e.g. ims/products/xyz or products/xyz)
            # URL format: https://res.cloudinary.com/<cloud>/<type>/upload/v<version>/<public_id>.<ext>
            match = re.search(r"/upload/(?:v\d+/)?(.+?)(?:\.[a-zA-Z0-9]+)?$", file_url_or_path)
            if match:
                pub_id = match.group(1)
                res_type = "raw" if is_raw else "image"
                cloudinary.uploader.destroy(pub_id, resource_type=res_type, invalidate=True)
                return True
        except Exception as exc:
            log.warning("Failed to delete Cloudinary asset %s: %s", file_url_or_path, exc)
            return False
        return False

    # Local file deletion
    try:
        clean_rel = file_url_or_path.lstrip("/\\").replace("\\", "/")
        local_path = (settings.MEDIA_ROOT / Path(clean_rel)).resolve()
        if is_safe_local_path(local_path, settings.MEDIA_ROOT) and local_path.is_file() and local_path.exists():
            local_path.unlink()
            return True
    except Exception as exc:
        log.warning("Failed to delete local file %s: %s", file_url_or_path, exc)

    return False


# ==============================================================================
# Private Storage Abstraction: Cloudflare R2 (S3-compatible) & Local Disk
# ==============================================================================

def is_safe_local_path(target_path: Path, base_dir: Path) -> bool:
    """Verify that target_path resides safely within base_dir (prevents directory traversal)."""
    try:
        resolved_target = target_path.resolve()
        resolved_base = base_dir.resolve()
        return resolved_base in resolved_target.parents or resolved_target == resolved_base
    except Exception:
        return False


def get_r2_config() -> dict:
    """Read Cloudflare R2 S3-compatible configuration from environment."""
    account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket_name = os.environ.get("R2_BUCKET_NAME", "").strip()
    endpoint_url = os.environ.get("R2_ENDPOINT_URL", "").strip()

    if not endpoint_url and account_id:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

    is_configured = bool(endpoint_url and access_key and secret_key and bucket_name)
    return {
        "is_configured": is_configured,
        "account_id": account_id,
        "access_key": access_key,
        "secret_key": secret_key,
        "bucket_name": bucket_name,
        "endpoint_url": endpoint_url,
    }


def get_r2_client():
    """Instantiate boto3 S3 client for Cloudflare R2."""
    config = get_r2_config()
    if not config["is_configured"]:
        return None

    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=config["endpoint_url"],
        aws_access_key_id=config["access_key"],
        aws_secret_access_key=config["secret_key"],
        region_name="auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def upload_private_document(file_obj, namespace: str, resource_id,
                            allowed_exts: tuple = (".jpg", ".jpeg", ".png", ".pdf", ".docx", ".xlsx"),
                            max_size_bytes: int = 10 * 1024 * 1024) -> str:
    """Upload a confidential document to private Cloudflare R2 bucket or local private disk.
    Never exposes public URLs. Returns an internal storage key or relative path.
    """
    if not file_obj:
        raise ApiError("No file was uploaded.")

    ext = sanitize_ext(getattr(file_obj, "name", ""))
    if allowed_exts and ext not in allowed_exts:
        raise ApiError(f"File type '{ext}' is not allowed. Allowed types: {', '.join(allowed_exts)}.")

    size = getattr(file_obj, "size", 0)
    if max_size_bytes and size > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        raise ApiError(f"File size exceeds the {limit_mb} MB limit.")

    # Sanitize namespace and resource ID to prevent path traversal
    safe_namespace = re.sub(r"[^a-zA-Z0-9_-]", "", str(namespace or "docs")).strip("_")
    safe_resource_id = re.sub(r"[^a-zA-Z0-9_-]", "", str(resource_id or "0")).strip("_")
    stored_name = f"{uuid.uuid4().hex}{ext}"

    # Reset file pointer if seekable
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)

    # 1. Cloudflare R2 Private Bucket Upload
    r2_config = get_r2_config()
    if r2_config["is_configured"]:
        try:
            r2_client = get_r2_client()
            object_key = f"{safe_namespace}/{safe_resource_id}/{stored_name}"
            content_type = getattr(file_obj, "content_type", "application/octet-stream") or "application/octet-stream"

            r2_client.upload_fileobj(
                file_obj,
                r2_config["bucket_name"],
                object_key,
                ExtraArgs={"ContentType": content_type},
            )
            # Store clean object key with prefix 'r2:' (never an open public URL)
            return f"r2:{object_key}"
        except Exception as exc:
            log.exception("Cloudflare R2 document upload failed for %s: %s", getattr(file_obj, "name", "doc"), exc)
            if not getattr(settings, "DEBUG", True):
                raise ApiError("Private document cloud upload failed. Please verify storage configuration.")

    # 2. Local Private Filesystem Fallback (development & offline testing)
    target_dir = settings.MEDIA_ROOT / "uploads" / safe_namespace / safe_resource_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / stored_name

    if not is_safe_local_path(target_path, settings.MEDIA_ROOT):
        raise ApiError("Path traversal violation detected.")

    if hasattr(file_obj, "seek"):
        file_obj.seek(0)

    with open(target_path, "wb") as destination:
        if hasattr(file_obj, "chunks"):
            for chunk in file_obj.chunks():
                destination.write(chunk)
        else:
            destination.write(file_obj.read())

    return f"/uploads/{safe_namespace}/{safe_resource_id}/{stored_name}"


def get_private_document_stream(stored_path_or_key: str):
    """Retrieve document stream and content type from Cloudflare R2, local storage, or legacy storage.
    Returns (stream_or_file, content_type).
    """
    if not stored_path_or_key or not isinstance(stored_path_or_key, str):
        raise ApiError("Invalid document storage reference.")

    raw_val = stored_path_or_key.strip()

    # 1. Cloudflare R2 Private Object Key
    if raw_val.startswith("r2:"):
        object_key = raw_val[3:].lstrip("/\\")
        # Prevent key traversal
        if ".." in object_key or not re.match(r"^[a-zA-Z0-9_\-\.\/]+$", object_key):
            raise ApiError("Malformed document object key.")

        r2_config = get_r2_config()
        if not r2_config["is_configured"]:
            raise ApiError("Cloudflare R2 is not configured on this server.")

        try:
            r2_client = get_r2_client()
            s3_obj = r2_client.get_object(Bucket=r2_config["bucket_name"], Key=object_key)
            return s3_obj["Body"], s3_obj.get("ContentType", "application/octet-stream")
        except Exception as exc:
            log.exception("Failed to retrieve private document from R2 (%s): %s", object_key, exc)
            raise ApiError("Document could not be retrieved from secure storage.")

    # 2. Legacy Cloudinary URL (Server-side proxy fallback during migration)
    if is_cloudinary_url(raw_val):
        import io
        import requests
        try:
            log.warning("Serving legacy Cloudinary supplier document through server proxy: %s", raw_val)
            r = requests.get(raw_val, stream=True, timeout=15)
            if r.status_code != 200:
                raise ApiError("Document not found on legacy cloud storage.")
            return io.BytesIO(r.content), r.headers.get("Content-Type", "application/octet-stream")
        except Exception as exc:
            log.exception("Failed to fetch legacy cloud document: %s", exc)
            raise ApiError("Document could not be retrieved from legacy cloud storage.")

    # 3. Local Filesystem Private Storage
    clean_rel = raw_val.lstrip("/\\").replace("\\", "/")
    if ".." in clean_rel:
        raise ApiError("Path traversal violation detected.")

    local_path = (settings.MEDIA_ROOT / Path(clean_rel)).resolve()
    if not is_safe_local_path(local_path, settings.MEDIA_ROOT) or not local_path.is_file() or not local_path.exists():
        raise ApiError("Document file not found on local server.")

    return open(local_path, "rb"), None


def delete_private_document(stored_path_or_key: str) -> bool:
    """Delete a private document from Cloudflare R2 or local disk."""
    if not stored_path_or_key or not isinstance(stored_path_or_key, str):
        return False

    raw_val = stored_path_or_key.strip()

    # 1. Cloudflare R2
    if raw_val.startswith("r2:"):
        object_key = raw_val[3:].lstrip("/\\")
        r2_config = get_r2_config()
        if not r2_config["is_configured"]:
            return False
        try:
            r2_client = get_r2_client()
            r2_client.delete_object(Bucket=r2_config["bucket_name"], Key=object_key)
            return True
        except Exception as exc:
            log.warning("Failed to delete R2 object %s: %s", object_key, exc)
            return False

    # 2. Legacy Cloudinary
    if is_cloudinary_url(raw_val):
        return delete_media(raw_val, is_raw=True)

    # 3. Local Filesystem
    try:
        clean_rel = raw_val.lstrip("/\\").replace("\\", "/")
        local_path = (settings.MEDIA_ROOT / Path(clean_rel)).resolve()
        if is_safe_local_path(local_path, settings.MEDIA_ROOT) and local_path.is_file() and local_path.exists():
            local_path.unlink()
            return True
    except Exception as exc:
        log.warning("Failed to delete local private document %s: %s", raw_val, exc)

    return False

