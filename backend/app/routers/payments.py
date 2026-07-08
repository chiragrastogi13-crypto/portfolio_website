"""UPI payment helpers: expose the payee details and a scannable QR code.

This is a lightweight UPI flow (no gateway): the user scans the QR (or taps
"open in UPI app"), pays, and confirms. Plug in a real gateway/webhook later to
verify payments automatically.
"""
import io
from urllib.parse import quote

import qrcode
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..config import ADMIN_NOTIFY_EMAIL, UPI_NAME, UPI_VPA
from ..database import get_db
from ..mailer import send_email

router = APIRouter(prefix="/api/payment", tags=["payment"])


def _upi_uri(amount: float, note: str) -> str:
    parts = [f"pa={UPI_VPA}", f"pn={quote(UPI_NAME)}", "cu=INR"]
    if amount:
        parts.append(f"am={amount}")
    if note:
        parts.append(f"tn={quote(note)}")
    return "upi://pay?" + "&".join(parts)


@router.get("/info")
def payment_info():
    """Payee UPI details used to render the payment screen."""
    return {"vpa": UPI_VPA, "name": UPI_NAME}


@router.get("/qr")
def payment_qr(
    amount: float = Query(0, ge=0),
    note: str = Query("Website Lelo subscription"),
):
    """Return a PNG QR code that any UPI app can scan to pay."""
    img = qrcode.make(_upi_uri(amount, note))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@router.post("/claim", response_model=schemas.PaymentMyStatus)
def claim_payment(
    payload: schemas.PaymentClaim,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """User says 'I've paid'. Creates a pending payment for admin review and
    emails the admin. The account is NOT unlocked here — an admin must approve.
    """
    if current.is_subscribed:
        return schemas.PaymentMyStatus(status="approved", plan=payload.plan, amount=payload.amount)

    payment = models.Payment(
        user_id=current.id,
        plan=payload.plan,
        amount=payload.amount,
        reference=payload.reference.strip(),
        status="pending",
    )
    db.add(payment)
    db.commit()

    # Notify the admin that there's a new payment to verify.
    background_tasks.add_task(
        send_email,
        ADMIN_NOTIFY_EMAIL,
        "New payment to verify - Website Lelo",
        f"A user has submitted a payment for review.\n\n"
        f"User: {current.email}\n"
        f"Plan: {payload.plan}\n"
        f"Amount: Rs {payload.amount}\n"
        f"UPI Reference / UTR: {payload.reference.strip() or '(not provided)'}\n\n"
        f"Open the admin panel to Approve or Reject it.",
    )
    return schemas.PaymentMyStatus(status="pending", plan=payload.plan, amount=payload.amount)


@router.get("/my-status", response_model=schemas.PaymentMyStatus)
def my_payment_status(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Latest payment status for the logged-in user (drives the UI)."""
    if current.is_subscribed:
        return schemas.PaymentMyStatus(status="approved")
    latest = (
        db.query(models.Payment)
        .filter(models.Payment.user_id == current.id)
        .order_by(models.Payment.created_at.desc())
        .first()
    )
    if not latest:
        return schemas.PaymentMyStatus(status="none")
    return schemas.PaymentMyStatus(
        status=latest.status, plan=latest.plan, amount=latest.amount, reason=latest.reason or ""
    )
