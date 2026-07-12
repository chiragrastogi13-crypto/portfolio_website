"""Central configuration for the backend.

Values can be overridden with environment variables so the same code runs in
local dev and (later) production without edits.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load secrets from backend/.env (kept out of source control).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# --- Security ---------------------------------------------------------------
# IMPORTANT: override SECRET_KEY in production with a long random value.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

# --- UPI payment details ----------------------------------------------------
# Set these to YOUR real UPI ID so payments reach you. The QR code and the
# "Open in UPI app" button are built from these.
UPI_VPA = os.getenv("UPI_VPA", "7071946603@ybl")
UPI_NAME = os.getenv("UPI_NAME", "Website Lelo")

# --- Admin account (auto-created on startup) --------------------------------
# Log in with these to open the admin panel and approve/reject payments.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@admin.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# --- Email (SMTP) -----------------------------------------------------------
# Fill these to actually send emails. With Gmail: SMTP_HOST=smtp.gmail.com,
# SMTP_PORT=587, SMTP_USER=you@gmail.com, SMTP_PASSWORD=<16-char app password>.
# If left blank, emails are skipped (logged to the console) and nothing breaks.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")  # defaults to MAIL_FROM / SMTP_USER
# The address portfolio enquiries and app notifications are sent *from*.
MAIL_FROM = os.getenv("MAIL_FROM", "info@wlelo.com")
# Where "new payment" notifications go (your real inbox). Defaults to admin email.
ADMIN_NOTIFY_EMAIL = os.getenv("ADMIN_NOTIFY_EMAIL", ADMIN_EMAIL)

# --- Uploads ----------------------------------------------------------------
# Where user-uploaded images are stored. On hosts with an ephemeral filesystem
# (e.g. Railway), point this at a mounted persistent volume, e.g. /data/uploads,
# so images survive redeploys.
UPLOADS_DIR = os.getenv(
    "UPLOADS_DIR", str(Path(__file__).resolve().parent / "uploads")
)

# --- Database ---------------------------------------------------------------
# Use `or` (not getenv's default) so an env var that's set-but-empty — e.g. an
# unresolved ${{...}} reference on Railway — still falls back instead of handing
# SQLAlchemy an empty string and crashing at startup.
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./blogger.db"
# Managed Postgres often gives postgres:// but SQLAlchemy 2.x requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# --- Hosting / URL scheme ---------------------------------------------------
# The bare host the app is served from. Public portfolios live on a subdomain:
#   <username>.127.0.0.1.nip.io:8000
# nip.io is a free wildcard-DNS service that resolves *.127.0.0.1.nip.io to
# 127.0.0.1, so subdomains work locally with zero host-file setup.
BASE_HOST = os.getenv("BASE_HOST", "127.0.0.1.nip.io")
BASE_PORT = int(os.getenv("BASE_PORT", "8000"))

# Set USE_PATH_URLS=true on Render (free tier doesn't support wildcard subdomains).
# Portfolios will be served at /p/<username> instead of <username>.<host>.
USE_PATH_URLS = os.getenv("USE_PATH_URLS", "false").lower() == "true"

# Frontend (Vite dev server) origin, used for CORS.
FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1.nip.io:5173,https://wlelo.netlify.app",
).split(",")


def _public_base_url() -> str:
    """Absolute base URL of THIS backend, correct in dev and prod.

    Local:  http://127.0.0.1.nip.io:8000
    Prod:   https://api.wlelo.com   (BASE_PORT=443 -> https, port omitted)
    """
    scheme = "https" if BASE_PORT == 443 else "http"
    port_part = "" if BASE_PORT in (80, 443) else f":{BASE_PORT}"
    return f"{scheme}://{BASE_HOST}{port_part}"


# Absolute backend URL used for building upload/image links.
PUBLIC_BASE_URL = _public_base_url()

# The marketing/frontend site URL (used in "Built with" links and the 404 page).
# Falls back to the backend URL when no frontend origin is configured.
FRONTEND_URL = FRONTEND_ORIGINS[0].strip() if FRONTEND_ORIGINS else PUBLIC_BASE_URL


# --- Plan tiers -------------------------------------------------------------
# What each purchased plan unlocks. The plan *name* (as shown on the pricing
# cards: "Starter" / "Professional" / "Business") is stored on the user when an
# admin approves their payment.
#
#   Starter (₹499)         -> 10 layouts, path URL   (wlelo.com/<user>)
#   Professional (₹999)    -> 20 layouts, subdomain  (<user>.wlelo.com)
#   Business (₹1449)       -> 20 layouts, subdomain  (<user>.wlelo.com)
#
# Keep TEMPLATES_PRO in sync with the number of layouts in frontend/src/data.js.
TEMPLATES_BASIC = 10
TEMPLATES_PRO = 20
_SUBDOMAIN_TIERS = ("professional", "business")


def plan_tier(plan: str) -> str:
    """Normalise a stored plan name to a known tier, or '' if unknown/empty."""
    p = (plan or "").strip().lower()
    if p in _SUBDOMAIN_TIERS or p == "starter":
        return p
    return ""


def plan_template_limit(plan: str) -> int:
    """How many layouts the editor should offer for this plan."""
    return TEMPLATES_BASIC if plan_tier(plan) == "starter" else TEMPLATES_PRO


def plan_uses_subdomain(plan: str) -> bool:
    """True -> <user>.<host> ; False -> <host>/<user>.

    For a known tier the plan decides. For an unknown/empty plan (legacy users,
    admin) we fall back to the global USE_PATH_URLS deployment flag.
    """
    tier = plan_tier(plan)
    if tier:
        return tier in _SUBDOMAIN_TIERS
    return not USE_PATH_URLS


# URL namespaces a portfolio can live in. Usernames are unique *within* a kind.
URL_KIND_PATH = "path"            # Starter          -> wlelo.com/<user>
URL_KIND_SUBDOMAIN = "subdomain"  # Professional/Biz -> <user>.wlelo.com


def plan_url_kind(plan: str) -> str:
    """Which URL namespace a user's portfolio belongs to, based on their plan."""
    return URL_KIND_SUBDOMAIN if plan_uses_subdomain(plan) else URL_KIND_PATH


def portfolio_url(username: str, url_kind: str) -> str:
    """Build the public URL for a portfolio from its stored url_kind."""
    scheme = "https" if BASE_PORT == 443 else "http"
    port_part = "" if BASE_PORT in (80, 443) else f":{BASE_PORT}"
    if url_kind == URL_KIND_SUBDOMAIN:
        # Subdomain form (chirag.wlelo.com) — Professional/Business.
        return f"{scheme}://{username}.{BASE_HOST}{port_part}"
    # Root-level path (wlelo.com/<user>) — Starter. Caddy rewrites it to the
    # backend's /p/<user> route. Cleaner than exposing /p/ in the link.
    return f"{scheme}://{BASE_HOST}{port_part}/{username}"


def public_portfolio_url(username: str, plan: str | None = None) -> str:
    """Public URL for a username given the owner's plan (URL shape from plan)."""
    return portfolio_url(username, plan_url_kind(plan))
