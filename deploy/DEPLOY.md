# Deploy wlelo.com — Oracle Cloud Free VM + Cloudflare (wildcard subdomains)

Goal: `wlelo.com` (main app) + `*.wlelo.com` (every published portfolio, e.g.
`alex.wlelo.com`), **free forever**, **always up**, with automatic wildcard SSL.

No code changes are needed — the backend already renders portfolios by reading
the `Host` header (`app/main.py` `subdomain_router`). We only add infra.

---

## 0. What you need before starting
- An Oracle Cloud account (free tier). Credit card is verified but **not charged**.
- `wlelo.com` (done ✅).
- A terminal with SSH. On Windows use PowerShell (`ssh` is built in).

---

## 1. Create the Always-Free VM (Oracle Cloud)
1. Oracle Cloud Console → **Compute → Instances → Create instance**.
2. Image: **Canonical Ubuntu 22.04**.
3. Shape: **Ampere (ARM) VM.Standard.A1.Flex** — set **1 OCPU / 6 GB RAM**
   (well within Always-Free). If ARM capacity is unavailable in your region,
   use **VM.Standard.E2.1.Micro** (AMD, also Always-Free).
4. Add your **SSH public key** (Oracle can generate one — download both keys).
5. Create. Note the **public IP** (e.g. `140.238.x.x`).

### Open the firewall (two layers on Oracle)
**a) Security List (cloud firewall):** VCN → Subnet → Security List → add
**Ingress rules**: allow `0.0.0.0/0` on **TCP 80** and **TCP 443**.

**b) OS firewall (inside the VM):** Oracle Ubuntu images block ports by default.
SSH in (next step) then run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 2. SSH in
```bash
ssh -i /path/to/your_private_key ubuntu@<PUBLIC_IP>
```

---

## 3. Point Cloudflare DNS at the VM
1. Add `wlelo.com` to **Cloudflare** (free plan). Cloudflare gives you 2
   nameservers — set these at your domain registrar. Wait for "Active".
2. In Cloudflare **DNS → Records**, add:

   | Type | Name | Content       | Proxy status         |
   |------|------|---------------|----------------------|
   | A    | `@`  | `<PUBLIC_IP>` | **DNS only** (grey)  |
   | A    | `*`  | `<PUBLIC_IP>` | **DNS only** (grey)  |
   | A    | `www`| `<PUBLIC_IP>` | **DNS only** (grey)  |

   > Keep proxy **grey (DNS only)** so Caddy can get real certs and see the true
   > Host. You can turn the orange proxy on later once everything works.

3. Create a **Cloudflare API token** for the DNS-01 challenge:
   Cloudflare → My Profile → **API Tokens → Create Token** →
   template **"Edit zone DNS"** → Zone = `wlelo.com`. Copy the token.

---

## 4. Install system packages
```bash
sudo apt update && sudo apt install -y python3-venv python3-pip git nodejs npm

# --- Install Caddy WITH the Cloudflare DNS plugin (needed for wildcard cert) ---
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Swap in a Caddy build that includes the Cloudflare DNS module:
sudo caddy add-package github.com/caddy-dns/cloudflare
```
`caddy version` should now work. (`add-package` replaces the binary with one
that bundles the plugin.)

---

## 5. Get the code onto the VM
```bash
cd /home/ubuntu
git clone <YOUR_GIT_REMOTE_URL> blogger_website
# (or push this repo to GitHub first, then clone it here)
cd blogger_website
```

### Backend: venv + config
```bash
cd /home/ubuntu/blogger_website/backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Create the production .env from the example and edit real values:
cp ../deploy/backend.env.example .env
nano .env        # set SECRET_KEY, ADMIN_PASSWORD, etc.

# Seed sample portfolios once (optional — startup also auto-seeds):
./venv/bin/python seed.py
```
Generate a strong secret key:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend: build the static site
```bash
cd /home/ubuntu/blogger_website/frontend
npm install
# API is same-origin under wlelo.com, so point the build at it:
echo 'VITE_API_BASE=https://wlelo.com' > .env.production
npm run build          # outputs to frontend/dist

# Publish the build where Caddy serves it:
sudo mkdir -p /var/www/wlelo-frontend
sudo cp -r dist/* /var/www/wlelo-frontend/
```

---

## 6. Run the API as an always-on service
```bash
sudo cp /home/ubuntu/blogger_website/deploy/portfolio-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now portfolio-api
sudo systemctl status portfolio-api      # should be "active (running)"
```
systemd restarts it on crash and on reboot → "always up".

---

## 7. Configure Caddy (SSL + routing)
```bash
# Install the site config:
sudo cp /home/ubuntu/blogger_website/deploy/Caddyfile /etc/caddy/Caddyfile

# Give the caddy service the Cloudflare token via a systemd override:
sudo systemctl edit caddy
```
In the editor that opens, paste (replace with your real token):
```ini
[Service]
Environment=CF_API_TOKEN=your_cloudflare_api_token_here
```
Save, then:
```bash
sudo systemctl restart caddy
sudo journalctl -u caddy -f      # watch it obtain the wildcard cert
```
First run takes ~30–60s to fetch `wlelo.com` + `*.wlelo.com` certs via
Cloudflare DNS. Ctrl-C to stop watching once you see certs obtained.

---

## 8. Test
- `https://wlelo.com` → React app loads.
- `https://wlelo.com/api/health` → `{"status":"ok"}`.
- Publish a portfolio in the app, then open `https://<username>.wlelo.com` →
  that portfolio renders. 🎉

---

## Updating later (redeploy)
```bash
cd /home/ubuntu/blogger_website && git pull

# Backend changed:
cd backend && ./venv/bin/pip install -r requirements.txt
sudo systemctl restart portfolio-api

# Frontend changed:
cd ../frontend && npm install && npm run build
sudo rm -rf /var/www/wlelo-frontend/* && sudo cp -r dist/* /var/www/wlelo-frontend/
```

---

## Notes / gotchas
- **SQLite backups:** data lives in `backend/blogger.db`. Back it up:
  `cp backend/blogger.db ~/backup-$(date +%F).db` (or a cron job).
- **Reserved subdomains:** `www` and the apex are the app; every *other*
  subdomain is treated as a username. Don't let users register usernames like
  `www`, `api`, `admin`, `mail` if you add those subdomains later. (The code
  already ignores `www`.)
- **Cloudflare proxy (orange cloud):** leave DNS-only while setting up. If you
  enable the proxy later, set SSL mode to **Full (strict)** and note the
  wildcard proxy needs Cloudflare's Advanced Certificate Manager for
  `*.wlelo.com` over their edge — DNS-only avoids that entirely and is fine.
- **Email `admin@wlelo.com`:** to actually send mail, fill the SMTP_* vars in
  `.env` (e.g. a Gmail app password), else emails are just logged.
