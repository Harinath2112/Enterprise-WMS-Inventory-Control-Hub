import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

log = logging.getLogger("ims")


def send_email(to, subject, html, attachments=None):
    """Send an HTML email. With no EMAIL_HOST configured the message prints in the server terminal."""
    try:
        msg = EmailMultiAlternatives(subject, html.replace("<br>", "\n"), settings.DEFAULT_FROM_EMAIL, [to])
        msg.attach_alternative(html, "text/html")
        for name, data, mime in (attachments or []):
            msg.attach(name, data, mime)
        msg.send()
        return True
    except Exception as exc:
        log.warning("Email to %s failed: %s", to, exc)
        return False
