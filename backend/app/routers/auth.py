"""Auth routes: register, login, and current-user info."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..config import NOTRACK_COOKIE_NAME, notrack_cookie_domain, plan_template_limit, plan_uses_subdomain
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

_NOTRACK_MAX_AGE = 365 * 24 * 3600


def _set_admin_notrack_cookie(response: Response) -> None:
    """Mark this browser as admin-owned so its visits don't pollute analytics.

    Called from the login route on successful admin auth. Uses SameSite=Lax +
    Secure so it rides same-origin API calls; Domain=.wlelo.com so it also
    reaches portfolio subdomains (chirag.wlelo.com etc.) where the tracker
    also fires from subdomain_router middleware.
    """
    kwargs = {
        "key": NOTRACK_COOKIE_NAME,
        "value": "1",
        "max_age": _NOTRACK_MAX_AGE,
        "path": "/",
        "secure": True,
        "samesite": "lax",
        "httponly": False,
    }
    domain = notrack_cookie_domain()
    if domain:
        kwargs["domain"] = domain
    response.set_cookie(**kwargs)


@router.post("/register", response_model=schemas.Token, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # New accounts are auto-approved so users can start right away. An admin can
    # still disapprove (block) an account later from the admin panel.
    user = models.User(
        email=payload.email,
        hashed_password=auth.hash_password(payload.password),
        status="approved",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.Token(access_token=auth.create_access_token(str(user.id)))


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if user.status == "disapproved":
        raise HTTPException(status_code=403, detail="Your account has been disabled.")
    if user.is_admin:
        _set_admin_notrack_cookie(response)
    return schemas.Token(access_token=auth.create_access_token(str(user.id)))


@router.get("/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(auth.get_current_user)):
    return user_out(current)


def user_out(u: models.User) -> schemas.UserOut:
    """Build the UserOut payload (shared by /me and /subscribe)."""
    expired = auth.subscription_expired(u)
    return schemas.UserOut(
        id=u.id,
        email=u.email,
        is_subscribed=u.is_subscribed and not expired,
        has_portfolio=u.portfolio is not None,
        status=u.status,
        is_admin=u.is_admin,
        plan=u.plan or "",
        template_limit=plan_template_limit(u.plan),
        subdomain=plan_uses_subdomain(u.plan),
        subscription_expires_at=u.subscription_expires_at,
        subscription_expired=expired,
    )
