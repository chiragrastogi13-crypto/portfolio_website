"""Admin panel API: review and approve / reject user payments.

All routes require an admin account (see config.ADMIN_EMAIL).
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..config import public_portfolio_url
from ..database import get_db
from ..mailer import send_email

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    """All registered users with their details (newest first)."""
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    out = []
    for u in users:
        p = u.portfolio
        out.append(schemas.AdminUserOut(
            id=u.id,
            email=u.email,
            status=u.status,
            is_admin=u.is_admin,
            is_subscribed=u.is_subscribed,
            has_portfolio=p is not None,
            created_at=u.created_at,
            portfolio_username=p.username if p else "",
            portfolio_url=public_portfolio_url(p.username) if (p and p.is_published) else "",
        ))
    return out


def _out(p: models.Payment) -> schemas.AdminPaymentOut:
    return schemas.AdminPaymentOut(
        id=p.id,
        user_email=p.user.email if p.user else "—",
        plan=p.plan,
        amount=p.amount,
        reference=p.reference,
        status=p.status,
        reason=p.reason or "",
        created_at=p.created_at,
    )


@router.get("/payments", response_model=list[schemas.AdminPaymentOut])
def list_payments(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    payments = db.query(models.Payment).order_by(models.Payment.created_at.desc()).all()
    return [_out(p) for p in payments]


@router.post("/payments/{payment_id}/approve", response_model=schemas.AdminPaymentOut)
def approve_payment(
    payment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = "approved"
    if payment.user:                 # unlock the editor for that user
        payment.user.is_subscribed = True
        background_tasks.add_task(
            send_email,
            payment.user.email,
            "Payment approved - you can now build your portfolio!",
            "Great news! Your payment has been verified and approved.\n\n"
            "You can now create your portfolio — just log in and open the editor "
            "to start customizing your website.\n\n— Website Lelo",
        )
    db.commit()
    db.refresh(payment)
    return _out(payment)


@router.post("/payments/{payment_id}/reject", response_model=schemas.AdminPaymentOut)
def reject_payment(
    payment_id: int,
    payload: schemas.RejectIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = "rejected"
    payment.reason = payload.reason.strip()
    if payment.user:
        background_tasks.add_task(
            send_email,
            payment.user.email,
            "Payment could not be verified - Website Lelo",
            "Unfortunately we couldn't verify your payment, so your account "
            "hasn't been unlocked.\n\n"
            f"Reason: {payload.reason.strip() or 'Not specified'}\n\n"
            "Please double-check the payment and submit again, or reply to this "
            "email if you need help.\n\n— Website Lelo",
        )
    db.commit()
    db.refresh(payment)
    return _out(payment)
