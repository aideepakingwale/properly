# 🚀 Properly — Render Deploy Checklist

## What you need first
- [ ] Render.com account (free)
- [ ] GitHub account (to push code)
- [ ] **Cloudflare R2 bucket** — free, keeps your DB across deploys → dash.cloudflare.com → R2 → Create bucket `properly`
- [ ] **Azure Speech key** — free F0 tier → portal.azure.com → Create resource → Speech → Keys & Endpoint
- [ ] **Groq API key** — free → console.groq.com (already used for AI coaching, doubles as speech fallback)
- [ ] **Gemini API key** — free → aistudio.google.com/app/apikey

## Push to GitHub
```bash
git init && git add . && git commit -m "Properly v2.0"
git remote add origin https://github.com/YOU/properly.git
git push -u origin main
```

## Step 1 — Backend (Web Service)
**Settings:**
- Name: `properly-api`
- Root dir: `backend`
- Runtime: Node
- Build command: `apt-get install -y ffmpeg 2>/dev/null || true && npm install`
- Start command: `npm start`
- Plan: Free (or Starter $7/mo for persistent disk)

**Environment variables — set ALL of these:**

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | Render assigns this automatically |
| `DB_PATH` | `/tmp/properly.db` | R2 handles persistence |
| `JWT_SECRET` | *(long random string)* | Generate once, never change |
| `JWT_EXPIRES_IN` | `30d` | |
| `CORS_ORIGINS` | `https://properly-web.onrender.com,https://properly-admin.onrender.com` | Update after deploy |
| `AZURE_SPEECH_KEY` | *(your key)* | Required for phonics scoring |
| `AZURE_SPEECH_REGION` | `uksouth` | Or your region |
| `GEMINI_API_KEY` | *(your key)* | Mrs Owl coaching |
| `GROQ_API_KEY` | *(your key)* | Whisper fallback + coaching |
| `R2_ACCOUNT_ID` | *(cloudflare account ID)* | Found in R2 dashboard |
| `R2_ACCESS_KEY_ID` | *(R2 API token key)* | |
| `R2_SECRET_KEY` | *(R2 API token secret)* | |
| `R2_BUCKET` | `properly` | |
| `ADMIN_EMAILS` | `your@email.com` | Comma-separated admin emails |
| `RESEND_API_KEY` | *(optional)* | Email verification |

## Step 2 — Frontend (Static Site)
**Settings:**
- Name: `properly-web`
- Root dir: `frontend`
- Build command: `npm install && npm run build`
- Publish dir: `dist`
- Rewrite rule: `/*` → `/index.html` (add under Redirects & Rewrites)

**Environment variable — CRITICAL:**

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://properly-api.onrender.com/api` |

⚠️ **Without `VITE_API_URL` the app shows a blank screen on every page.**

## Step 3 — Admin Panel (Static Site)
**Settings:**
- Name: `properly-admin`
- Root dir: `admin`
- Build command: `npm install && npm run build`
- Publish dir: `dist`
- Rewrite rule: `/*` → `/index.html`

**Environment variable:**

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://properly-api.onrender.com/api` |

## After deploy — verify everything works

```
1. Health:   https://properly-api.onrender.com/api/health  → { "status": "ok" }
2. Register: https://properly-web.onrender.com/auth
3. Story:    Click any Phase 2 story → should show grapheme tiles
4. Record:   Tap 🎙️ → speak sentence → scores appear on each word tile
5. Admin:    https://properly-admin.onrender.com → Config → Test Audio Pipeline
```

The Admin Config page has live diagnostic buttons for Azure, Gemini, Groq, Pollinations and ffmpeg — run these first if anything doesn't work.

## Prevent free-tier sleep (optional)
Add UptimeRobot HTTP monitor → `https://properly-api.onrender.com/api/health` → every 14 min

## Update CORS after deploy
In `properly-api` env vars, set `CORS_ORIGINS` to the exact URLs:
```
https://properly-web.onrender.com,https://properly-admin.onrender.com
```
