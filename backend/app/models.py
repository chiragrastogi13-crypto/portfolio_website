"""Database models: User and Portfolio.

A user owns at most one portfolio. The whole portfolio content (name, bio,
stats, skills, posts, testimonials, timeline, ...) is stored as a single JSON
blob in `data_json` so the rich blogger-style layout can evolve freely without
schema migrations. Subscription is a simple flag on the user (swap for real
payments later).
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Admin approval: every new account starts "pending" until an admin acts.
    is_admin = Column(Boolean, default=False)
    status = Column(String, default="pending")  # pending | approved | disapproved

    is_subscribed = Column(Boolean, default=False)
    subscribed_at = Column(DateTime, nullable=True)
    # Purchased plan name ("Starter" | "Professional" | "Business"), set when an
    # admin approves the payment. Decides template count + public URL shape.
    plan = Column(String, default="")

    portfolio = relationship(
        "Portfolio", back_populates="owner", uselist=False, cascade="all, delete-orphan"
    )


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # username = URL slug. Uniqueness is scoped to the URL namespace (url_kind),
    # so "chirag" can exist once as a Starter path URL (wlelo.com/chirag) AND
    # once as a Professional/Business subdomain (chirag.wlelo.com) — different
    # people, different URLs. Within one namespace it must be unique.
    username = Column(String, index=True, nullable=False)
    # "path" (Starter) | "subdomain" (Professional/Business). Set at creation
    # from the owner's plan; decides both the public URL and how it's routed.
    url_kind = Column(String, default="subdomain", nullable=False)

    # The entire portfolio content as JSON text.
    data_json = Column(Text, default="{}")

    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="portfolio")

    __table_args__ = (
        UniqueConstraint("username", "url_kind", name="uq_portfolio_username_kind"),
    )


class Payment(Base):
    """A user-submitted payment claim, manually approved/rejected by an admin."""

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan = Column(String, default="")
    amount = Column(Integer, default=0)
    reference = Column(String, default="")          # UPI transaction / UTR id
    status = Column(String, default="pending")       # pending | approved | rejected
    reason = Column(Text, default="")                # admin's reason when rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Requirement(Base):
    """A hiring/gig requirement posted by a user; others apply to it."""

    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    poster_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, default="")
    skills = Column(String, default="")          # comma-separated tags
    budget = Column(String, default="")          # free-form, e.g. "₹20,000" or "$500/hr"
    location = Column(String, default="")        # e.g. "Remote", "Bangalore"
    status = Column(String, default="open")      # open | closed
    created_at = Column(DateTime, default=datetime.utcnow)

    poster = relationship("User")
    applications = relationship(
        "Application", back_populates="requirement", cascade="all, delete-orphan"
    )


class Application(Base):
    """A user's application ("approach") to a posted requirement."""

    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    message = Column(Text, default="")
    portfolio_url = Column(String, default="")   # snapshot of applicant's live portfolio
    proposed_budget = Column(String, default="")
    status = Column(String, default="pending")   # pending | accepted | rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="applications")
    applicant = relationship("User")


class SamplePortfolio(Base):
    """Curated showcase samples for the public Samples page (seeded)."""

    __tablename__ = "sample_portfolios"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, default="")
    title = Column(String, default="")
    bio = Column(Text, default="")
    avatar_url = Column(String, default="")
    skills_json = Column(Text, default="[]")
    # Full blogger-style data for the live sample preview.
    data_json = Column(Text, default="{}")
