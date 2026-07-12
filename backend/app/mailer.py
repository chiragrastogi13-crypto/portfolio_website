"""Tiny best-effort email sender (SMTP).

If SMTP isn't configured, it logs and returns False instead of raising — so the
app keeps working without email set up. Call it via BackgroundTasks so requests
stay fast.
"""
import smtplib
import ssl
from email.message import EmailMessage

from .config import MAIL_FROM, SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER


def _log(msg: str) -> None:
    # Windows consoles (cp1252) choke on emoji/unicode — never let logging crash.
    # flush=True so notifications show up in the server log immediately.
    print(msg.encode("ascii", "replace").decode("ascii"), flush=True)


def send_email(to: str, subject: str, body: str, reply_to: str = "") -> bool:
    sender = SMTP_FROM or MAIL_FROM or SMTP_USER
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD and to):
        _log(f"[email skipped - SMTP not configured] to={to} subject={subject}")
        return False

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        _log(f"[email sent] to={to} subject={subject}")
        return True
    except Exception as e:  # noqa: BLE001 — email must never break the request
        _log(f"[email error] to={to}: {e}")
        return False
