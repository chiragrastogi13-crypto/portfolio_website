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
UPI_NAME = os.getenv("UPI_NAME", "Portfolio Studio")

# --- Admin account (auto-created on startup) --------------------------------
# Log in with these to open the admin panel and approve/reject payments.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@portfolio.studio")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# --- Email (SMTP) -----------------------------------------------------------
# Fill these to actually send emails. With Gmail: SMTP_HOST=smtp.gmail.com,
# SMTP_PORT=587, SMTP_USER=you@gmail.com, SMTP_PASSWORD=<16-char app password>.
# If left blank, emails are skipped (logged to the console) and nothing breaks.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")  # defaults to SMTP_USER
# Where "new payment" notifications go (your real inbox). Defaults to admin email.
ADMIN_NOTIFY_EMAIL = os.getenv("ADMIN_NOTIFY_EMAIL", ADMIN_EMAIL)

# --- Database ---------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./blogger.db")
# Render gives postgres:// but SQLAlchemy 2.x requires postgresql://
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
    "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1.nip.io:5173",
).split(",")


def public_portfolio_url(username: str) -> str:
    """Build the public URL a client receives after generating their portfolio."""
    if USE_PATH_URLS:
        scheme = "https" if BASE_PORT == 443 else "http"
        port_part = "" if BASE_PORT in (80, 443) else f":{BASE_PORT}"
        return f"{scheme}://{BASE_HOST}{port_part}/p/{username}"
    return f"http://{username}.{BASE_HOST}:{BASE_PORT}"
