"""Subscription gate + portfolio CRUD + generate (publish).

The portfolio content is a free-form JSON blob, so the frontend can store the
entire rich blogger-style layout (stats, skills, posts, testimonials, timeline)
and evolve it without backend schema changes.
"""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from datetime import datetime

from .. import auth, images, models, schemas
from . import auth as auth_router
from ..config import PUBLIC_BASE_URL, plan_url_kind, portfolio_url
from ..database import get_db
from ..mailer import send_email

router = APIRouter(prefix="/api", tags=["portfolio"])


def _out(p: models.Portfolio) -> schemas.PortfolioOut:
    return schemas.PortfolioOut.from_model(p, portfolio_url(p.username, p.url_kind))


# --- Subscription gate ------------------------------------------------------


@router.post("/subscribe", response_model=schemas.UserOut)
def subscribe(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Mark the account as paid/subscribed (called after UPI payment)."""
    current.is_subscribed = True
    current.subscribed_at = datetime.utcnow()
    db.commit()
    db.refresh(current)
    return auth_router.user_out(current)


# --- Portfolio CRUD ---------------------------------------------------------


@router.get("/portfolio", response_model=schemas.PortfolioOut)
def get_my_portfolio(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    if not current.portfolio:
        raise HTTPException(status_code=404, detail="No portfolio yet")
    return _out(current.portfolio)


@router.post("/portfolio", response_model=schemas.PortfolioOut, status_code=201)
def create_portfolio(
    payload: schemas.PortfolioCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    if not current.is_subscribed:
        raise HTTPException(
            status_code=402, detail="Subscription required before creating a portfolio"
        )
    if current.portfolio:
        raise HTTPException(status_code=400, detail="You already have a portfolio")

    url_kind = plan_url_kind(current.plan)
    taken = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.username == payload.username,
            models.Portfolio.url_kind == url_kind,
        )
        .first()
    )
    if taken:
        raise HTTPException(status_code=409, detail="That username is taken")

    p = models.Portfolio(
        owner_id=current.id,
        username=payload.username,
        url_kind=url_kind,
        data_json=json.dumps(payload.data),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(p)


@router.put("/portfolio", response_model=schemas.PortfolioOut)
def update_portfolio(
    payload: schemas.PortfolioUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    if not current.portfolio:
        raise HTTPException(status_code=404, detail="No portfolio to update")
    current.portfolio.data_json = json.dumps(payload.data)
    db.commit()
    db.refresh(current.portfolio)
    return _out(current.portfolio)


@router.put("/portfolio/username", response_model=schemas.PortfolioOut)
def change_username(
    payload: schemas.UsernameUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Change the portfolio's URL slug. Same validation + per-namespace
    uniqueness as creation. Note: this changes the public URL, so any old
    link stops working.
    """
    if not current.portfolio:
        raise HTTPException(status_code=404, detail="No portfolio to update")
    new = payload.username  # already validated/cleaned
    if new == current.portfolio.username:
        return _out(current.portfolio)  # no change
    taken = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.username == new,
            models.Portfolio.url_kind == current.portfolio.url_kind,
            models.Portfolio.id != current.portfolio.id,
        )
        .first()
    )
    if taken:
        raise HTTPException(status_code=409, detail="That username is taken")
    current.portfolio.username = new
    db.commit()
    db.refresh(current.portfolio)
    return _out(current.portfolio)


@router.post("/portfolio/generate", response_model=schemas.PortfolioOut)
def generate_portfolio(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Publish the portfolio and hand back the live link."""
    if not current.portfolio:
        raise HTTPException(status_code=404, detail="No portfolio to publish")
    current.portfolio.is_published = True
    db.commit()
    db.refresh(current.portfolio)
    return _out(current.portfolio)


# --- Contact form: email the portfolio owner an enquiry ---------------------


@router.post("/portfolio/contact")
def contact_owner(
    payload: schemas.ContactIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """A visitor filled the 'Hire Me' contact form. Email the owner the enquiry
    (from info@wlelo.com), with the visitor's address as Reply-To."""
    # Honeypot: bots fill the hidden field — accept silently, send nothing.
    if payload.website.strip():
        return {"ok": True}

    p = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.username == payload.username,
            models.Portfolio.url_kind == payload.url_kind,
        )
        .first()
    )
    if not p or not p.is_published or not p.owner:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Deliver to the owner's account email + their displayed contact email.
    recipients: list[str] = []
    if p.owner.email:
        recipients.append(p.owner.email)
    data = json.loads(p.data_json or "{}")
    contact_email = ((data.get("personal") or {}).get("email") or "").strip()
    if contact_email and "@" in contact_email and contact_email.lower() not in {r.lower() for r in recipients}:
        recipients.append(contact_email)
    if not recipients:
        raise HTTPException(status_code=400, detail="This portfolio has no contact address")

    subject = f"New enquiry from your wlelo portfolio — {payload.subject.strip() or 'no subject'}"
    body = (
        f"You've received a new enquiry from your portfolio ({p.username}).\n\n"
        f"Name:    {payload.name.strip()}\n"
        f"Email:   {payload.email}\n"
        f"Subject: {payload.subject.strip() or '(none)'}\n\n"
        f"Message:\n{payload.message.strip()}\n\n"
        f"---\n"
        f"Reply directly to this email to respond to {payload.name.strip()}.\n"
        f"Sent via wlelo.com"
    )
    background_tasks.add_task(send_email, ", ".join(recipients), subject, body, payload.email)
    return {"ok": True}


# --- Image upload + auto-enhance --------------------------------------------


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current: models.User = Depends(auth.get_current_user),
):
    """Accept a user-uploaded image, enhance it, and return its public URL.

    The returned URL is absolute (points at the backend) so it renders both in
    the editor (localhost:5173) and on the published subdomain page.
    """
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > images.MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 12 MB)")

    try:
        name = images.enhance_and_save(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read that image. Try a JPG or PNG.")

    return {"url": f"{PUBLIC_BASE_URL}/uploads/{name}"}


@router.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current: models.User = Depends(auth.get_current_user),
):
    """Accept a resume/CV (PDF/DOC/DOCX), store it, and return its public URL."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > images.MAX_DOC_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB)")
    try:
        name = images.save_document(raw, file.filename)
    except ValueError:
        raise HTTPException(status_code=400, detail="Please upload a PDF, DOC, or DOCX file")
    return {"url": f"{PUBLIC_BASE_URL}/uploads/{name}"}


# --- Username availability --------------------------------------------------


@router.get("/portfolio/check-username")
def check_username(
    username: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Availability is scoped to the caller's URL namespace (plan): the same
    name can be free on a Starter path URL yet taken on a subdomain, and vice
    versa. We check against the namespace this user would publish into.
    """
    try:
        cleaned = schemas.clean_username(username)
    except ValueError as e:
        return {"available": False, "reason": str(e)}
    url_kind = plan_url_kind(current.plan)
    q = db.query(models.Portfolio).filter(
        models.Portfolio.username == cleaned,
        models.Portfolio.url_kind == url_kind,
    )
    # Don't count the caller's own portfolio as a conflict (so they can re-check
    # or keep their current name while editing).
    if current.portfolio:
        q = q.filter(models.Portfolio.id != current.portfolio.id)
    return {"available": q.first() is None, "username": cleaned}


# --- Showcase samples (public) ----------------------------------------------


@router.get("/samples", response_model=list[schemas.SampleOut])
def list_samples(db: Session = Depends(get_db)):
    samples = db.query(models.SamplePortfolio).all()
    out = []
    for s in samples:
        data = json.loads(s.data_json or "{}")
        out.append(schemas.SampleOut(
            slug=s.slug,
            full_name=s.full_name,
            title=s.title,
            bio=s.bio,
            avatar_url=s.avatar_url,
            theme=data.get("theme", "aurora"),
            layout=data.get("layout", "classic"),
            skills=json.loads(s.skills_json or "[]"),
        ))
    return out


@router.get("/samples/{slug}")
def get_sample(slug: str, db: Session = Depends(get_db)):
    s = (
        db.query(models.SamplePortfolio)
        .filter(models.SamplePortfolio.slug == slug)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found")
    return {"slug": s.slug, "data": json.loads(s.data_json or "{}")}
