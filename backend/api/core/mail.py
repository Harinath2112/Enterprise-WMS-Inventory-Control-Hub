"""Transactional email delivery supporting HTTPS APIs (Brevo / Resend) for Render Free
compatibility, with standard SMTP fallback and safe development/test mocking.
Does NOT leak OTPs or sensitive credentials to production logs.
"""
import base64
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

log = logging.getLogger("ims")


def _send_via_brevo(api_key: str, to: str, subject: str, html: str, attachments=None) -> bool:
    """Send transactional email via Brevo HTTPS API (port 443, no SMTP required)."""
    import requests
    from email.utils import parseaddr

    from_name, from_addr = parseaddr(settings.DEFAULT_FROM_EMAIL)
    payload = {
        "sender": {"name": from_name or "IMS Inventory System", "email": from_addr or "no-reply@ims.local"},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if attachments:
        payload["attachment"] = [
            {
                "name": name,
                "content": base64.b64encode(data if isinstance(data, bytes) else str(data).encode()).decode("utf-8"),
            }
            for name, data, mime in attachments
        ]

    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
        json=payload,
        timeout=10,
    )
    if resp.status_code in (200, 201, 202):
        return True
    log.warning("Brevo email API returned status %s for recipient: %s", resp.status_code, to)
    return False


def _send_via_resend(api_key: str, to: str, subject: str, html: str, attachments=None) -> bool:
    """Send transactional email via Resend HTTPS API (port 443, no SMTP required)."""
    import requests

    payload = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if attachments:
        payload["attachments"] = [
            {
                "filename": name,
                "content": base64.b64encode(data if isinstance(data, bytes) else str(data).encode()).decode("utf-8"),
            }
            for name, data, mime in attachments
        ]

    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )
    if resp.status_code in (200, 201, 202):
        return True
    log.warning("Resend email API returned status %s for recipient: %s", resp.status_code, to)
    return False


def send_email(to: str, subject: str, html: str, attachments=None) -> bool:
    """Send an HTML email via HTTPS API (preferred for Render Free) or SMTP fallback.
    In local dev / test mode without credentials, delegates to Django's configured backend.
    Never logs OTPs or email bodies.
    """
    if not to or not isinstance(to, str) or "@" not in to:
        return False

    # 1. Primary: Brevo HTTPS API (Free 300 emails/day, HTTPS port 443)
    brevo_key = getattr(settings, "BREVO_API_KEY", "")
    if brevo_key:
        try:
            return _send_via_brevo(brevo_key, to, subject, html, attachments)
        except Exception as exc:
            log.warning("Brevo email transmission to %s failed: %s", to, exc)
            return False

    # 2. Secondary: Resend HTTPS API (Free 3,000 emails/mo, HTTPS port 443)
    resend_key = getattr(settings, "RESEND_API_KEY", "")
    if resend_key:
        try:
            return _send_via_resend(resend_key, to, subject, html, attachments)
        except Exception as exc:
            log.warning("Resend email transmission to %s failed: %s", to, exc)
            return False

    # 3. SMTP fallback (for environments supporting outbound SMTP)
    email_host = getattr(settings, "EMAIL_HOST", "")
    if email_host:
        try:
            msg = EmailMultiAlternatives(subject, html.replace("<br>", "\n"), settings.DEFAULT_FROM_EMAIL, [to])
            msg.attach_alternative(html, "text/html")
            for name, data, mime in (attachments or []):
                msg.attach(name, data, mime)
            msg.send()
            return True
        except Exception as exc:
            log.warning("SMTP email transmission to %s failed: %s", to, exc)
            return False

    # 4. Development & Automated Testing fallback
    if getattr(settings, "DEBUG", True):
        try:
            msg = EmailMultiAlternatives(subject, html.replace("<br>", "\n"), settings.DEFAULT_FROM_EMAIL, [to])
            msg.attach_alternative(html, "text/html")
            for name, data, mime in (attachments or []):
                msg.attach(name, data, mime)
            msg.send()
            return True
        except Exception as exc:
            log.warning("Dev email dispatch to %s failed: %s", to, exc)
            return False

    # In production with no configured email provider, log a sanitized configuration notice
    log.warning("Email to %s suppressed: No transactional email provider configured.", to)
    return False
