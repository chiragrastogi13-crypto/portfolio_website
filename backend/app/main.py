"""FastAPI entrypoint.

Serves two things on the same port (8000):

  * The JSON API under /api/*  (consumed by the React frontend on :5173)
  * Server-rendered public portfolios when the request arrives on a subdomain
    e.g. http://alex.127.0.0.1.nip.io:8000  ->  Alex's portfolio HTML

Subdomain detection is done in a middleware that inspects the Host header.
"""
import json
from datetime import datetime, timedelta

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


def _ensure_schema():
    """Add columns/indexes introduced after the DB was first created.

    create_all() never ALTERs existing tables, so DBs seeded before these were
    added need an in-place migration. All steps are idempotent.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)

    user_cols = {c["name"] for c in insp.get_columns("users")}

    # users.plan — the purchased plan name (drives templates + URL shape).
    if "plan" not in user_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR DEFAULT ''"))

    if "subscription_expires_at" not in user_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME"))

    if "promo_code_used" not in user_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN promo_code_used VARCHAR DEFAULT ''"))

    payment_cols = {c["name"] for c in insp.get_columns("payments")}
    if "promo_code" not in payment_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE payments ADD COLUMN promo_code VARCHAR DEFAULT ''"))

    # portfolios.url_kind — the URL namespace ('path' | 'subdomain'). Usernames
    # are unique per-namespace, so the old global-unique index on username is
    # replaced by a composite (username, url_kind) unique index.
    if "url_kind" not in {c["name"] for c in insp.get_columns("portfolios")}:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE portfolios ADD COLUMN url_kind VARCHAR NOT NULL DEFAULT 'subdomain'"
            ))
            # Backfill existing portfolios from their owner's plan.
            conn.execute(text(
                "UPDATE portfolios SET url_kind = 'path' WHERE owner_id IN "
                "(SELECT id FROM users WHERE lower(plan) = 'starter')"
            ))
            # Swap the single-column unique index for a per-namespace one.
            conn.execute(text("DROP INDEX IF EXISTS ix_portfolios_username"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_portfolios_username ON portfolios(username)"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_username_kind "
                "ON portfolios(username, url_kind)"
            ))


_ensure_schema()


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

# Periodically delete uploads no portfolio references anymore (freed storage).
from .cleanup import start_background_cleanup

start_background_cleanup()

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


def _render_portfolio(request: Request, username: str, url_kind: str) -> HTMLResponse:
    db = SessionLocal()
    try:
        # Usernames are unique per namespace, so a subdomain request must match a
        # subdomain-kind portfolio and a /p/ (path) request a path-kind one — the
        # same name in the other namespace belongs to a different owner.
        p = (
            db.query(models.Portfolio)
            .filter(
                models.Portfolio.username == username,
                models.Portfolio.url_kind == url_kind,
            )
            .first()
        )
        if not p or not p.is_published:
            return HTMLResponse(
                _not_found_html(username), status_code=404
            )
        from .auth import subscription_expired

        if p.owner and subscription_expired(p.owner):
            return HTMLResponse(_expired_html(username), status_code=402)
        return templates.TemplateResponse(
            "portfolio.html",
            {
                "request": request,
                "d": json.loads(p.data_json or "{}"),
                "username": p.username,
                "url_kind": p.url_kind,
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


def _expired_html(username: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Subscription expired</title>
<style>body{{font-family:system-ui;background:#0f172a;color:#f1f5f9;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}}
.card{{max-width:520px}}
h1{{margin:0 0 12px;font-size:1.6rem}}
p{{color:#cbd5e1;line-height:1.55}}
a.btn{{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:10px;
background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;text-decoration:none;font-weight:600}}
a.muted{{color:#818cf8;display:block;margin-top:14px;text-decoration:none}}</style></head>
<body><div class="card">
<div style="font-size:3rem">⏳</div>
<h1>This portfolio is currently unavailable</h1>
<p>The subscription for <strong>{username}</strong> has expired.
Please renew your plan to bring this page back online.</p>
<a class="btn" href="{FRONTEND_URL}/subscribe">Renew subscription →</a>
<a class="muted" href="{FRONTEND_URL}">← Back to Website Lelo</a>
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
        _record_visit(request, sub)
        return _render_portfolio(request, sub, "subdomain")
    return await call_next(request)


# Paths we never want to log — noisy, non-human, or admin-panel internals.
_SKIP_PREFIXES = ("/static/", "/uploads/", "/api/admin/", "/favicon", "/assets/")
_SKIP_EXACT = {"/api/health", "/docs", "/redoc", "/openapi.json"}
# Within this window, a repeat (ip, path) hit is treated as the same visit
# (prevents the React app's polling from flooding the table).
_DEDUP_WINDOW = timedelta(minutes=5)


def _client_ip(request: Request) -> str:
    """Real client IP even behind a reverse proxy (Render, Netlify, nginx)."""
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip", "")
    if real:
        return real.strip()
    return request.client.host if request.client else ""


def _record_visit(request: Request, subdomain: str | None = None) -> None:
    """Log a page/API hit for the admin visitor dashboard. Best-effort — never
    blocks or crashes the actual request."""
    path = request.url.path
    if request.method == "OPTIONS":
        return
    if path in _SKIP_EXACT or any(path.startswith(p) for p in _SKIP_PREFIXES):
        return

    ip = _client_ip(request)
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - _DEDUP_WINDOW
        recent = (
            db.query(models.Visitor)
            .filter(
                models.Visitor.ip_address == ip,
                models.Visitor.path == path,
                models.Visitor.visited_at >= cutoff,
            )
            .first()
        )
        if recent:
            return
        db.add(models.Visitor(
            ip_address=ip,
            path=path,
            method=request.method,
            user_agent=(request.headers.get("user-agent", "") or "")[:500],
            referer=(request.headers.get("referer", "") or "")[:500],
            host=subdomain or "",
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.middleware("http")
async def visitor_tracker(request: Request, call_next):
    """Log every meaningful hit before it reaches the route handlers.

    Runs AFTER subdomain_router (FastAPI executes middleware in reverse-added
    order), so subdomain-root requests are already recorded by that handler
    with the resolved subdomain and this one becomes a no-op for them.
    """
    if request.url.path != "/" or not _extract_subdomain(request.headers.get("host", "")):
        _record_visit(request)
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
    """Path-based portfolio route (Starter plan URLs: wlelo.com/<user>)."""
    return _render_portfolio(request, username, "path")


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
                "is_sample": True,
                "own_url": f"{FRONTEND_URL}/subscribe?sample={s.slug}",
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
