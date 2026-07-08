"""FastAPI entrypoint.

Serves two things on the same port (8000):

  * The JSON API under /api/*  (consumed by the React frontend on :5173)
  * Server-rendered public portfolios when the request arrives on a subdomain
    e.g. http://alex.127.0.0.1.nip.io:8000  ->  Alex's portfolio HTML

Subdomain detection is done in a middleware that inspects the Host header.
"""
import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

from . import models
from .config import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_HOST, BASE_PORT, FRONTEND_ORIGINS, FRONTEND_URL, UPLOADS_DIR
from .database import Base, SessionLocal, engine
from .seed_samples import ensure_samples
from .routers import admin as admin_router
from .routers import auth as auth_router
from .routers import payments as payments_router
from .routers import portfolios as portfolio_router
from .routers import requirements as requirements_router

# Create tables on startup (simple for SQLite; use Alembic for real migrations).
Base.metadata.create_all(bind=engine)


def _ensure_admin():
    """Create the admin account on first run if it doesn't exist."""
    from .auth import hash_password

    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()
        if not admin:
            db.add(models.User(
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                is_admin=True,
                status="approved",
                is_subscribed=True,
            ))
            db.commit()
    finally:
        db.close()


_ensure_admin()

_db = SessionLocal()
try:
    ensure_samples(_db)
finally:
    _db.close()

app = FastAPI(title="Website Lelo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# Serve the portfolio CSS (and any other public assets) at /static.
app.mount(
    "/static",
    StaticFiles(directory=str(Path(__file__).parent / "static")),
    name="static",
)

# Serve user-uploaded (and enhanced) images at /uploads.
_uploads_dir = Path(UPLOADS_DIR)
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


def _extract_subdomain(host: str) -> str | None:
    """Return the portfolio subdomain from a Host header, or None for the base host.

    'alex.127.0.0.1.nip.io:8000' -> 'alex'
    '127.0.0.1.nip.io:8000'      -> None
    'localhost:8000'             -> None
    """
    if not host:
        return None
    hostname = host.split(":")[0]  # strip port

    # Match against the configured base host.
    if hostname == BASE_HOST or hostname in ("localhost", "127.0.0.1"):
        return None
    suffix = "." + BASE_HOST
    if hostname.endswith(suffix):
        sub = hostname[: -len(suffix)]
        # ignore www and empty
        return sub if sub and sub != "www" else None
    # Also support <user>.localhost for convenience.
    if hostname.endswith(".localhost"):
        sub = hostname[: -len(".localhost")]
        return sub if sub and sub != "www" else None
    return None


def _render_portfolio(request: Request, username: str) -> HTMLResponse:
    db = SessionLocal()
    try:
        p = (
            db.query(models.Portfolio)
            .filter(models.Portfolio.username == username)
            .first()
        )
        if not p or not p.is_published:
            return HTMLResponse(
                _not_found_html(username), status_code=404
            )
        return templates.TemplateResponse(
            "portfolio.html",
            {
                "request": request,
                "d": json.loads(p.data_json or "{}"),
                "username": p.username,
                "base_host": BASE_HOST,
                "base_port": BASE_PORT,
                "home_url": FRONTEND_URL,
            },
        )
    finally:
        db.close()


def _not_found_html(username: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Not found</title>
<style>body{{font-family:system-ui;background:#0f172a;color:#f1f5f9;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}}
a{{color:#818cf8}}</style></head>
<body><div><h1>No portfolio at "{username}"</h1>
<p>This portfolio doesn't exist or hasn't been published yet.</p>
<p><a href="{FRONTEND_URL}">← Back to Website Lelo</a></p>
</div></body></html>"""


@app.middleware("http")
async def subdomain_router(request: Request, call_next):
    """Intercept subdomain requests and render the public portfolio.

    API requests (paths starting with /api) always pass through, so the
    frontend can call the API via the base host without interference.
    """
    # Only the root path renders the portfolio HTML; everything else (e.g.
    # /static/blogger.css, /api/*) passes through so assets load normally.
    sub = _extract_subdomain(request.headers.get("host", ""))
    if sub and request.url.path == "/":
        return _render_portfolio(request, sub)
    return await call_next(request)


app.include_router(auth_router.router)
app.include_router(portfolio_router.router)
app.include_router(payments_router.router)
app.include_router(admin_router.router)
app.include_router(requirements_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/p/{username}", response_class=HTMLResponse, include_in_schema=False)
def path_portfolio(username: str, request: Request):
    """Path-based portfolio route for deployments without wildcard subdomains."""
    return _render_portfolio(request, username)


@app.get("/sample/{slug}", response_class=HTMLResponse, include_in_schema=False)
def sample_page(slug: str, request: Request):
    """Render a showcase sample in the full portfolio design (live preview)."""
    db = SessionLocal()
    try:
        s = (
            db.query(models.SamplePortfolio)
            .filter(models.SamplePortfolio.slug == slug)
            .first()
        )
        if not s:
            return HTMLResponse(_not_found_html(slug), status_code=404)
        return templates.TemplateResponse(
            "portfolio.html",
            {
                "request": request,
                "d": json.loads(s.data_json or "{}"),
                "username": s.slug,
                "base_host": BASE_HOST,
                "base_port": BASE_PORT,
                "home_url": FRONTEND_URL,
            },
        )
    finally:
        db.close()


@app.get("/", include_in_schema=False)
def root():
    """Base-host landing hint (the real UI is the React app on :5173)."""
    return JSONResponse(
        {
            "name": "Website Lelo API",
            "docs": "/docs",
            "frontend": "Run the React app (npm run dev) on port 5173.",
        }
    )
