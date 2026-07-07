"""Subscription gate + portfolio CRUD + generate (publish).

The portfolio content is a free-form JSON blob, so the frontend can store the
entire rich blogger-style layout (stats, skills, posts, testimonials, timeline)
and evolve it without backend schema changes.
"""
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from datetime import datetime

from .. import auth, images, models, schemas
from ..config import PUBLIC_BASE_URL, public_portfolio_url
from ..database import get_db

router = APIRouter(prefix="/api", tags=["portfolio"])


def _out(p: models.Portfolio) -> schemas.PortfolioOut:
    return schemas.PortfolioOut.from_model(p, public_portfolio_url(p.username))


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
    return schemas.UserOut(
        id=current.id,
        email=current.email,
        is_subscribed=current.is_subscribed,
        has_portfolio=current.portfolio is not None,
        status=current.status,
        is_admin=current.is_admin,
    )


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

    taken = (
        db.query(models.Portfolio)
        .filter(models.Portfolio.username == payload.username)
        .first()
    )
    if taken:
        raise HTTPException(status_code=409, detail="That username is taken")

    p = models.Portfolio(
        owner_id=current.id,
        username=payload.username,
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


# --- Username availability --------------------------------------------------


@router.get("/portfolio/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    try:
        cleaned = schemas.clean_username(username)
    except ValueError as e:
        return {"available": False, "reason": str(e)}
    taken = (
        db.query(models.Portfolio)
        .filter(models.Portfolio.username == cleaned)
        .first()
    )
    return {"available": taken is None, "username": cleaned}


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
