"""Pydantic request/response schemas."""
import json
import re
from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$")

# Names that would collide with frontend routes or backend paths when portfolios
# live at the site root (wlelo.com/<username>). Users can't take these.
RESERVED_USERNAMES = {
    # frontend routes
    "samples", "hire", "login", "register", "subscribe", "editor", "result", "admin",
    # backend paths / assets
    "p", "api", "docs", "static", "uploads", "sample", "health", "assets",
    "www", "favicon", "robots", "sitemap",
}


def clean_username(v: str) -> str:
    v = (v or "").strip().lower()
    if not USERNAME_RE.match(v):
        raise ValueError(
            "Username must be 3-32 chars, lowercase letters/numbers/hyphens, "
            "and cannot start or end with a hyphen."
        )
    if v in RESERVED_USERNAMES:
        raise ValueError("That name is reserved. Please pick another username.")
    return v


# --- Auth -------------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_subscribed: bool
    has_portfolio: bool = False
    status: str = "pending"
    is_admin: bool = False
    # Plan-derived entitlements (drive the editor gating + URL preview).
    plan: str = ""
    template_limit: int = 20
    subdomain: bool = False


class AdminUserOut(BaseModel):
    id: int
    email: EmailStr
    status: str
    is_admin: bool
    is_subscribed: bool
    has_portfolio: bool
    created_at: datetime
    portfolio_username: str = ""
    portfolio_url: str = ""
    plan: str = ""


class AdminStats(BaseModel):
    users: int
    portfolios: int
    published: int
    subscribers: int
    pending_payments: int


# --- Payments ---------------------------------------------------------------


class PaymentClaim(BaseModel):
    plan: str = ""
    amount: int = 0
    reference: str = ""


class RejectIn(BaseModel):
    reason: str = ""


class PaymentMyStatus(BaseModel):
    status: str          # none | pending | approved | rejected
    plan: str = ""
    amount: int = 0
    reason: str = ""


class AdminPaymentOut(BaseModel):
    id: int
    user_email: EmailStr
    plan: str
    amount: int
    reference: str
    status: str
    reason: str = ""
    created_at: datetime


# --- Portfolio (free-form content blob) -------------------------------------


class PortfolioCreate(BaseModel):
    username: str
    data: Dict[str, Any] = {}

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        return clean_username(v)


class PortfolioUpdate(BaseModel):
    data: Dict[str, Any] = {}


class UsernameUpdate(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        return clean_username(v)


class PortfolioOut(BaseModel):
    id: int
    username: str
    is_published: bool
    public_url: str
    data: Dict[str, Any]
    updated_at: datetime

    @staticmethod
    def from_model(p, public_url: str) -> "PortfolioOut":
        return PortfolioOut(
            id=p.id,
            username=p.username,
            is_published=p.is_published,
            public_url=public_url,
            data=json.loads(p.data_json or "{}"),
            updated_at=p.updated_at or datetime.utcnow(),
        )


# --- Hiring board: requirements + applications ------------------------------


class RequirementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=5000)
    skills: str = Field(default="", max_length=300)
    budget: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=120)


class RequirementOut(BaseModel):
    id: int
    title: str
    description: str
    skills: List[str] = []
    budget: str = ""
    location: str = ""
    status: str = "open"
    poster_email: str
    is_mine: bool = False
    has_applied: bool = False
    application_count: int = 0
    created_at: datetime


class ApplicationCreate(BaseModel):
    message: str = Field(default="", max_length=3000)
    proposed_budget: str = Field(default="", max_length=80)


class ApplicationOut(BaseModel):
    id: int
    requirement_id: int
    requirement_title: str = ""
    applicant_email: str
    message: str = ""
    portfolio_url: str = ""
    proposed_budget: str = ""
    status: str = "pending"
    created_at: datetime


# --- Showcase samples -------------------------------------------------------


class SampleOut(BaseModel):
    slug: str
    full_name: str
    title: str
    bio: str
    avatar_url: str
    theme: str = "aurora"
    layout: str = "classic"
    skills: List[str] = []
