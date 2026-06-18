"""Database models: User and Portfolio.

A user owns at most one portfolio. The whole portfolio content (name, bio,
stats, skills, posts, testimonials, timeline, ...) is stored as a single JSON
blob in `data_json` so the rich blogger-style layout can evolve freely without
schema migrations. Subscription is a simple flag on the user (swap for real
payments later).
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
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

    portfolio = relationship(
        "Portfolio", back_populates="owner", uselist=False, cascade="all, delete-orphan"
    )


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # username = subdomain slug (URL-safe, globally unique).
    username = Column(String, unique=True, index=True, nullable=False)

    # The entire portfolio content as JSON text.
    data_json = Column(Text, default="{}")

    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="portfolio")


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
