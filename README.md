# Portfolio Studio

A full-stack app where a company showcases its work and lets clients build and
publish their own professional portfolio. Each published portfolio gets its own
shareable URL on a subdomain:

```
http://<username>.127.0.0.1.nip.io:8000
```

> `*.127.0.0.1.nip.io` is free wildcard DNS that resolves to `127.0.0.1`, so
> per-user subdomains work locally with **zero host-file setup**. Raw IP
> subdomains like `username.127.0.0.1` can't resolve in a browser — that's why
> we use `nip.io`. In production you'd point a real wildcard domain
> (`*.yoursite.com`) at the server the same way.

## Payments (UPI)

When a user goes to build a portfolio they hit a **pricing** page, pick a plan,
and pay via **UPI** — a scannable QR code plus the UPI ID and an "open in UPI
app" button. After paying they confirm and the **editor unlocks**.

Set your real UPI ID so payments reach you (otherwise the placeholder is used):

```powershell
$env:UPI_VPA = "yourname@okhdfcbank"
$env:UPI_NAME = "Your Business Name"
```

**Manual verification:** clicking "I've paid" creates a **pending** payment (the
editor stays locked). An admin reviews it in the **Admin → Payment Approvals**
panel and **Approves** (unlocks the editor) or **Rejects** (with a reason).

**Email notifications** fire automatically (when SMTP is set):
- New payment submitted → email to the admin.
- Approved → email to the user ("you can now create your portfolio").
- Rejected → email to the user with the reason.

To actually send email (e.g. Gmail), set before starting the backend:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"; $env:SMTP_PORT = "587"
$env:SMTP_USER = "you@gmail.com"; $env:SMTP_PASSWORD = "<16-char app password>"
$env:ADMIN_NOTIFY_EMAIL = "you@gmail.com"   # where new-payment alerts go
```

Without SMTP, emails are skipped (logged to the console) and nothing breaks.

## The flow

1. **Browse** the home page and portfolio **samples**.
2. **Register / log in** (email + password, JWT) — usable immediately, no approval.
3. **Subscribe** — one button today; a payment gateway slots in here later
   without changing anything else.
4. **Customize in place** — the editor *is* your portfolio, pre-filled with
   sample (dummy) content in the polished blogger-style design. There's no blank
   form: click any text to edit it, click an image's pencil to change it, and
   add/remove skills, posts, testimonials, timeline entries, etc.
5. **Generate** — publishes your portfolio and hands back your personal link.

The portfolio content is stored as a single JSON blob (`Portfolio.data_json`),
and the public page is server-rendered from that data using the exact same
Bootstrap design as the editor — so what you edit is what visitors see.

## Tech stack

| Layer    | Tech                                                        |
|----------|-------------------------------------------------------------|
| Backend  | FastAPI, SQLAlchemy, SQLite, JWT (python-jose), bcrypt, Jinja2 |
| Frontend | React 18, React Router, Vite                                |

The backend serves **both** the JSON API (`/api/*`) and the server-rendered
public portfolio pages (matched by subdomain in the `Host` header) on port 8000.
The React app runs separately on port 5173 during development.

## Project layout

```
blogger_website/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + subdomain middleware + public renderer
│   │   ├── config.py        # env-overridable settings (SECRET_KEY, hosts, DB)
│   │   ├── database.py      # SQLAlchemy engine/session
│   │   ├── models.py        # User, Portfolio, SamplePortfolio
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── auth.py          # bcrypt hashing + JWT + current-user dependency
│   │   ├── themes.py        # color themes for the public pages
│   │   ├── routers/         # auth.py, portfolios.py
│   │   └── templates/       # portfolio.html (Jinja2)
│   ├── seed.py              # seeds showcase sample portfolios
│   ├── requirements.txt
│   └── run.ps1
└── frontend/
    ├── src/
    │   ├── api.js           # fetch wrapper + token storage
    │   ├── auth.jsx         # auth context
    │   ├── App.jsx          # routes + nav
    │   ├── pages/           # Home, Samples, Login, Register, Subscribe, Editor, Result
    │   └── components/      # PortfolioPreview.jsx (live preview)
    ├── package.json
    └── run.ps1
```

## Running it (Windows / PowerShell)

Open **two terminals**.

**Terminal 1 — backend:**
```powershell
cd backend
./run.ps1
```
First run creates a virtualenv, installs deps, and seeds the sample portfolios.
Backend: <http://127.0.0.1.nip.io:8000>  ·  API docs: <http://127.0.0.1.nip.io:8000/docs>

**Terminal 2 — frontend:**
```powershell
cd frontend
./run.ps1
```
Frontend: <http://localhost:5173>

### Manual commands (if you prefer not to use the scripts)

```powershell
# backend
cd backend
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
./venv/Scripts/python.exe seed.py
./venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# frontend
cd frontend
npm install
npm run dev
```

## Try the full flow

1. Open <http://localhost:5173>, click **Get started**, register.
2. You land on **Subscribe** → click **Subscribe & continue**.
3. In the editor pick a username (e.g. `jane`), a template + theme, fill in some
   fields, watch the live preview.
4. Click **🚀 Generate my portfolio**.
5. You get a link like `http://jane.127.0.0.1.nip.io:8000` — open it.

## Configuration

All overridable via environment variables (see `backend/app/config.py`):

| Variable             | Default                | Purpose                         |
|----------------------|------------------------|---------------------------------|
| `SECRET_KEY`         | dev placeholder        | **Change in production.**        |
| `UPI_VPA`            | `7071946603@ybl`       | **Your UPI ID** (so payments reach you). |
| `UPI_NAME`           | `Portfolio Studio`     | Payee name shown in UPI apps.    |
| `ADMIN_EMAIL`        | `admin@portfolio.studio` | Admin-panel login.             |
| `ADMIN_PASSWORD`     | `admin123`             | Admin-panel password.            |
| `ADMIN_NOTIFY_EMAIL` | = `ADMIN_EMAIL`        | Inbox that gets "new payment" emails. |
| `SMTP_HOST`/`SMTP_PORT` | blank / `587`       | SMTP server (e.g. `smtp.gmail.com`). |
| `SMTP_USER`/`SMTP_PASSWORD` | blank          | SMTP login (Gmail: app password). |
| `DATABASE_URL`       | `sqlite:///./blogger.db` | Swap for Postgres later.       |
| `BASE_HOST`          | `127.0.0.1.nip.io`     | Base host for subdomain URLs.    |
| `BASE_PORT`          | `8000`                 | Public port.                     |
| `FRONTEND_ORIGINS`   | localhost:5173 + nip.io | CORS allow-list (comma-sep).    |

Frontend: set `VITE_API_BASE` in `frontend/.env` to point at a non-default API.

## Where to extend next

- **Payments:** replace `POST /api/subscribe` (in `routers/portfolios.py`) with a
  Stripe Checkout session + webhook; the gate (`User.is_subscribed`) already exists.
- **More templates/themes:** add entries to `themes.py` and branches in
  `templates/portfolio.html` (and mirror them in `PortfolioPreview.jsx`).
- **Migrations:** swap `Base.metadata.create_all` for Alembic when the schema stabilizes.
- **Production subdomains:** set `BASE_HOST` to your domain and add a wildcard
  DNS record `*.yoursite.com`.
