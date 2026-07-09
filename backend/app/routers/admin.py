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


def _user_out(u: models.User) -> schemas.AdminUserOut:
    p = u.portfolio
    return schemas.AdminUserOut(
        id=u.id,
        email=u.email,
        status=u.status,
        is_admin=u.is_admin,
        is_subscribed=u.is_subscribed,
        has_portfolio=p is not None,
        created_at=u.created_at,
        portfolio_username=p.username if p else "",
        portfolio_url=public_portfolio_url(p.username) if (p and p.is_published) else "",
    )


def _get_user(db: Session, user_id: int) -> models.User:
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@router.get("/stats", response_model=schemas.AdminStats)
def stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    """Dashboard counts for the admin panel."""
    return schemas.AdminStats(
        users=db.query(models.User).count(),
        portfolios=db.query(models.Portfolio).count(),
        published=db.query(models.Portfolio).filter(models.Portfolio.is_published == True).count(),
        subscribers=db.query(models.User).filter(models.User.is_subscribed == True).count(),
        pending_payments=db.query(models.Payment).filter(models.Payment.status == "pending").count(),
    )


@router.get("/users", response_model=list[schemas.AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    """All registered users with their details (newest first)."""
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [_user_out(u) for u in users]


@router.post("/users/{user_id}/block", response_model=schemas.AdminUserOut)
def block_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    """Disable an account (blocked users can't log in or use the API)."""
    u = _get_user(db, user_id)
    if u.is_admin:
        raise HTTPException(status_code=400, detail="Cannot block an admin account")
    u.status = "disapproved"
    db.commit()
    db.refresh(u)
    return _user_out(u)


@router.post("/users/{user_id}/unblock", response_model=schemas.AdminUserOut)
def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    u = _get_user(db, user_id)
    u.status = "approved"
    db.commit()
    db.refresh(u)
    return _user_out(u)


@router.delete("/users/{user_id}/portfolio", status_code=204)
def delete_user_portfolio(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.get_current_admin),
):
    """Delete a user's portfolio (their public page stops working)."""
    u = _get_user(db, user_id)
    if u.portfolio:
        db.delete(u.portfolio)
        db.commit()
    return None


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
