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

from fastapi import HTTPException

from .. import auth, models, schemas
from ..config import ADMIN_NOTIFY_EMAIL, UPI_NAME, UPI_VPA, lookup_promo
from ..database import get_db
from ..mailer import send_email

router = APIRouter(prefix="/api/payment", tags=["payment"])

PROMO_UNLOCK_AMOUNT = 1


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


def _validate_promo_for_user(code: str, plan: str, user: models.User) -> tuple[str, int]:
    """Return (plan_name, months) for a redeemable promo, else raise HTTPException.

    Business rules:
      * Code must exist in the config table.
      * Plan on the promo must match the plan the user is trying to buy.
      * A user can only redeem a promo once (tracked on User.promo_code_used).
    """
    promo = lookup_promo(code)
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid promo code")
    promo_plan, months = promo
    if plan and promo_plan.strip().lower() != plan.strip().lower():
        raise HTTPException(
            status_code=400,
            detail=f"This promo only applies to the {promo_plan} plan",
        )
    if (user.promo_code_used or "").strip():
        raise HTTPException(status_code=400, detail="You've already redeemed a promo code")
    return promo_plan, months


@router.post("/promo/validate", response_model=schemas.PromoValidateOut)
def validate_promo(
    payload: schemas.PromoValidateIn,
    current: models.User = Depends(auth.get_current_user),
):
    """Check a promo code without submitting a payment. Powers the 'Apply' button
    on the payment screen so the UI can show eligibility + discounted amount."""
    plan_name, months = _validate_promo_for_user(payload.code, payload.plan, current)
    return schemas.PromoValidateOut(
        valid=True,
        plan=plan_name,
        months=months,
        discounted_amount=PROMO_UNLOCK_AMOUNT,
        message=(
            f"You're eligible for {months} month{'s' if months != 1 else ''} free "
            f"{plan_name} — pay only ₹{PROMO_UNLOCK_AMOUNT} to unlock."
        ),
    )


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
    if auth.has_active_subscription(current):
        return schemas.PaymentMyStatus(status="approved", plan=payload.plan, amount=payload.amount)

    promo_code = (payload.promo_code or "").strip().upper()
    if promo_code:
        promo_plan, _months = _validate_promo_for_user(promo_code, payload.plan, current)
        plan_for_payment = promo_plan
        amount_for_payment = PROMO_UNLOCK_AMOUNT
    else:
        plan_for_payment = payload.plan
        amount_for_payment = payload.amount

    payment = models.Payment(
        user_id=current.id,
        plan=plan_for_payment,
        amount=amount_for_payment,
        reference=payload.reference.strip(),
        status="pending",
        promo_code=promo_code,
    )
    db.add(payment)
    db.commit()

    promo_line = f"Promo code: {promo_code}\n" if promo_code else ""
    background_tasks.add_task(
        send_email,
        ADMIN_NOTIFY_EMAIL,
        "New payment to verify - Website Lelo",
        f"A user has submitted a payment for review.\n\n"
        f"User: {current.email}\n"
        f"Plan: {plan_for_payment}\n"
        f"Amount: Rs {amount_for_payment}\n"
        f"{promo_line}"
        f"UPI Reference / UTR: {payload.reference.strip() or '(not provided)'}\n\n"
        f"Open the admin panel to Approve or Reject it.",
    )
    return schemas.PaymentMyStatus(
        status="pending", plan=plan_for_payment, amount=amount_for_payment
    )


@router.get("/my-status", response_model=schemas.PaymentMyStatus)
def my_payment_status(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Latest payment status for the logged-in user (drives the UI)."""
    if auth.has_active_subscription(current):
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
