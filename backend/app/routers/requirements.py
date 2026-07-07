"""Hiring board: post requirements and let other users apply ("approach") them.

Open board — any authenticated user can post a requirement, and any other
authenticated user can apply. Browsing the board is public. When an applicant
has a published portfolio, its live URL is auto-attached to the application so
the poster can view their work.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..config import public_portfolio_url
from ..database import get_db

router = APIRouter(prefix="/api/requirements", tags=["hiring"])


def _skills_list(raw: str) -> list[str]:
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


def _req_out(
    r: models.Requirement, current: Optional[models.User]
) -> schemas.RequirementOut:
    has_applied = False
    if current:
        has_applied = any(a.applicant_id == current.id for a in r.applications)
    return schemas.RequirementOut(
        id=r.id,
        title=r.title,
        description=r.description or "",
        skills=_skills_list(r.skills),
        budget=r.budget or "",
        location=r.location or "",
        status=r.status,
        poster_email=r.poster.email if r.poster else "",
        is_mine=bool(current and current.id == r.poster_id),
        has_applied=has_applied,
        application_count=len(r.applications),
        created_at=r.created_at,
    )


def _app_out(a: models.Application) -> schemas.ApplicationOut:
    return schemas.ApplicationOut(
        id=a.id,
        requirement_id=a.requirement_id,
        requirement_title=a.requirement.title if a.requirement else "",
        applicant_email=a.applicant.email if a.applicant else "",
        message=a.message or "",
        portfolio_url=a.portfolio_url or "",
        proposed_budget=a.proposed_budget or "",
        status=a.status,
        created_at=a.created_at,
    )


def _get_requirement(db: Session, req_id: int) -> models.Requirement:
    r = db.query(models.Requirement).filter(models.Requirement.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return r


# --- Browse + post ----------------------------------------------------------


@router.get("", response_model=list[schemas.RequirementOut])
def list_requirements(
    mine: bool = False,
    db: Session = Depends(get_db),
    current: Optional[models.User] = Depends(auth.get_current_user_optional),
):
    """Public board. `mine=true` (auth required) returns only my postings."""
    q = db.query(models.Requirement)
    if mine:
        if not current:
            raise HTTPException(status_code=401, detail="Not authenticated")
        q = q.filter(models.Requirement.poster_id == current.id)
    else:
        q = q.filter(models.Requirement.status == "open")
    reqs = q.order_by(models.Requirement.created_at.desc()).all()
    return [_req_out(r, current) for r in reqs]


@router.post("", response_model=schemas.RequirementOut, status_code=201)
def create_requirement(
    payload: schemas.RequirementCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    r = models.Requirement(
        poster_id=current.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        skills=payload.skills.strip(),
        budget=payload.budget.strip(),
        location=payload.location.strip(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _req_out(r, current)


@router.get("/my/applications", response_model=list[schemas.ApplicationOut])
def my_applications(
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Requirements the current user has applied to, with each application's status."""
    apps = (
        db.query(models.Application)
        .filter(models.Application.applicant_id == current.id)
        .order_by(models.Application.created_at.desc())
        .all()
    )
    return [_app_out(a) for a in apps]


@router.get("/{req_id}", response_model=schemas.RequirementOut)
def get_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    current: Optional[models.User] = Depends(auth.get_current_user_optional),
):
    return _req_out(_get_requirement(db, req_id), current)


@router.post("/{req_id}/close", response_model=schemas.RequirementOut)
def close_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    r = _get_requirement(db, req_id)
    if r.poster_id != current.id:
        raise HTTPException(status_code=403, detail="Only the poster can close this")
    r.status = "closed"
    db.commit()
    db.refresh(r)
    return _req_out(r, current)


@router.delete("/{req_id}", status_code=204)
def delete_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    r = _get_requirement(db, req_id)
    if r.poster_id != current.id and not current.is_admin:
        raise HTTPException(status_code=403, detail="Only the poster can delete this")
    db.delete(r)
    db.commit()
    return None


# --- Apply ("approach") -----------------------------------------------------


@router.post("/{req_id}/apply", response_model=schemas.ApplicationOut, status_code=201)
def apply_to_requirement(
    req_id: int,
    payload: schemas.ApplicationCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    r = _get_requirement(db, req_id)
    if r.status != "open":
        raise HTTPException(status_code=400, detail="This requirement is closed")
    if r.poster_id == current.id:
        raise HTTPException(status_code=400, detail="You can't apply to your own posting")

    existing = (
        db.query(models.Application)
        .filter(
            models.Application.requirement_id == req_id,
            models.Application.applicant_id == current.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You've already applied to this")

    # Auto-attach the applicant's live portfolio URL when it's published.
    portfolio_url = ""
    if current.portfolio and current.portfolio.is_published:
        portfolio_url = public_portfolio_url(current.portfolio.username)

    a = models.Application(
        requirement_id=req_id,
        applicant_id=current.id,
        message=payload.message.strip(),
        proposed_budget=payload.proposed_budget.strip(),
        portfolio_url=portfolio_url,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _app_out(a)


@router.get("/{req_id}/applications", response_model=list[schemas.ApplicationOut])
def list_applications(
    req_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    """Applicants for a requirement — visible only to the poster (or an admin)."""
    r = _get_requirement(db, req_id)
    if r.poster_id != current.id and not current.is_admin:
        raise HTTPException(status_code=403, detail="Only the poster can view applicants")
    apps = (
        db.query(models.Application)
        .filter(models.Application.requirement_id == req_id)
        .order_by(models.Application.created_at.desc())
        .all()
    )
    return [_app_out(a) for a in apps]


def _decide_application(
    app_id: int, decision: str, db: Session, current: models.User
) -> schemas.ApplicationOut:
    a = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if a.requirement.poster_id != current.id:
        raise HTTPException(status_code=403, detail="Only the poster can decide this")
    a.status = decision
    db.commit()
    db.refresh(a)
    return _app_out(a)


@router.post("/applications/{app_id}/accept", response_model=schemas.ApplicationOut)
def accept_application(
    app_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    return _decide_application(app_id, "accepted", db, current)


@router.post("/applications/{app_id}/reject", response_model=schemas.ApplicationOut)
def reject_application(
    app_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_user),
):
    return _decide_application(app_id, "rejected", db, current)
