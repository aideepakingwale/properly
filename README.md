# 🦉 Properly — AI Phonics Tutor
### Full-stack Render.com Deployment Guide

> **Stack:** React 18 + Vite · Node.js 20 + Express · SQLite (node:sqlite built-in) · Azure Speech · Gemini Flash (free) · Groq/Llama 3.1 (free)

---

## ⚡ One-Click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or follow the step-by-step guide below.

---

## 📋 Pre-Requisites (5 minutes)

You need free accounts/keys for:

| Service | What for | Free tier | Get it |
|---|---|---|---|
| **Render.com** | Hosting | Free (services sleep after 15 min) | [render.com](https://render.com) |
| **GitHub** | Source repo | Free | [github.com](https://github.com) |
| **Azure Speech** | Pronunciation AI + TTS | 5 hr/mo STT, 500K chars/mo TTS | [portal.azure.com](https://portal.azure.com) |
| **Google Gemini** | Mrs. Owl AI coaching | 1,500 req/day free forever | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Groq (Llama 3.1)** | Backup AI coaching & stories | **Free** — 14,400 req/day, no billing | [console.groq.com/keys](https://console.groq.com/keys) |

---

## 🚀 Step-by-Step Deployment

### Step 1 — Push to GitHub

```bash
# Unzip the package
unzip properly-render.zip
cd properly-render

# Initialize git
git init
git add .
git commit -m "feat: initial Properly app"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/properly.git
git branch -M main
git push -u origin main
```

---

### Step 2 — Get your Azure Speech key (free)

1. Go to [portal.azure.com](https://portal.azure.com) → **Create a resource**
2. Search **Speech** → Click **Speech** → **Create**
3. Settings:
   - **Subscription**: Your subscription
   - **Resource group**: Create new → `properly-rg`
   - **Region**: `UK South` *(recommended for en-GB)*
   - **Name**: `properly-speech`
   - **Pricing tier**: **Free F0** ✅
4. Click **Review + create** → **Create**
5. Once deployed: **Go to resource** → **Keys and Endpoint**
6. Copy **Key 1** — you'll need it in Step 4

---

### Step 3 — Get your Gemini API key (free, no billing)

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key** → **Create API key in new project**
3. Copy the key — you'll need it in Step 4

---

### Step 4 — Deploy on Render

#### Option A — Blueprint (automatic, recommended)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub account → Select the `properly` repo
4. Render reads `render.yaml` and shows the 2 services to create
5. For each `sync: false` environment variable, Render asks you to enter it:
   - `GROQ_API_KEY` → leave blank (Gemini is free and works great)
   - `GEMINI_API_KEY` → paste your Gemini key
   - `AZURE_SPEECH_KEY` → paste your Azure Key 1
6. Click **Apply** → Render builds and deploys both services

#### Option B — Manual (two services)

**Backend (Web Service):**
1. New → Web Service → Connect repo
2. **Root directory**: `backend`
3. **Build command**: `npm install`
4. **Start command**: `npm start`
5. **Instance type**: Free
6. Add environment variables (see table below)
7. Click **Create Web Service**
8. Note the URL: `https://properly-api.onrender.com`

**Frontend (Static Site):**
1. New → Static Site → Connect same repo
2. **Root directory**: `frontend`
3. **Build command**: `npm install && npm run build`
4. **Publish directory**: `dist`
5. Add environment variables:
   - `VITE_API_URL` = `https://properly-api.onrender.com/api`
6. Under **Redirects/Rewrites** add:
   - Source: `/*` → Destination: `/index.html` → Action: **Rewrite**
7. Click **Create Static Site**

---

### Step 5 — Set CORS on the backend

After both services are created:
1. Go to **properly-api** → **Environment** 
2. Update `CORS_ORIGINS` to your static site URL:
   ```
   https://properly-web.onrender.com
   ```
3. Click **Save Changes** → Render redeploys automatically

---

## 🔧 Backend Environment Variables

| Variable | Required | Value | Notes |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | |
| `PORT` | ✅ | `10000` | Render assigns this |
| `JWT_SECRET` | ✅ | *auto-generated* | Use `generateValue: true` in render.yaml |
| `JWT_EXPIRES_IN` | ✅ | `7d` | |
| `DB_PATH` | ✅ | `/tmp/properly.db` | Free tier (ephemeral). Change to `/data/properly.db` with paid disk |
| `CORS_ORIGINS` | ✅ | `https://properly-web.onrender.com` | Your static site URL |
| `GROQ_API_KEY` | ✅ | *your Groq key* | Free backup — 14,400 req/day on Llama 3.1 |
| `GEMINI_API_KEY` | ✅ | *your key* | Free tier, 1,500 req/day |
| `AZURE_SPEECH_KEY` | ✅ | *your key* | Free F0: 5hr STT + 500K TTS/month |
| `AZURE_SPEECH_REGION` | ✅ | `uksouth` | Match your Azure resource region |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `900000` | 15 min window |
| `RATE_LIMIT_MAX` | ❌ | `200` | Requests per window |

## 🔧 Frontend Environment Variables

| Variable | Required | Value |
|---|---|---|
| `VITE_API_URL` | ✅ | `https://properly-api.onrender.com/api` |

---

## 💾 Database Notes

### Free tier (ephemeral)
- SQLite file lives at `/tmp/properly.db`
- **Resets on every deploy** — user accounts and progress are lost
- Fine for testing/demos. Stories, shop items, and achievements are re-seeded from code on each start

### Paid tier (persistent) — $7/month Starter plan
1. Upgrade `properly-api` to **Starter** plan
2. Add a **Disk**: mount path `/data`, size `1 GB`
3. Change `DB_PATH` to `/data/properly.db`
4. User data now persists across deploys and restarts

---

## 🏗️ Project Structure

```
properly-render/
├── render.yaml                     ← Render Blueprint (deploy both services)
├── package.json                    ← Root scripts for local dev
│
├── backend/                        ← Render Web Service (rootDir: backend)
│   ├── package.json                ← npm install + npm start
│   ├── .env.example                ← Copy to .env for local dev
│   └── src/
│       ├── app.js                  ← Express entry point (trust proxy, CORS, rate-limit)
│       ├── db/
│       │   ├── schema.sql          ← 10 tables with indexes and triggers
│       │   ├── database.js         ← node:sqlite built-in, WAL mode
│       │   ├── seed.js             ← 14 stories, 15 shop items, 14 achievements
│       │   └── migrate.js
│       ├── middleware/
│       │   └── auth.middleware.js  ← JWT verify + child ownership guard
│       ├── controllers/
│       │   ├── auth.controller.js        ← register, login, me
│       │   ├── story.controller.js       ← stories, pages, phases
│       │   ├── progress.controller.js    ← sessions, acorns, streaks, achievements
│       │   ├── shop.controller.js        ← items, owned, atomic purchase
│       │   └── speech.controller.js      ← Azure pronunciation assessment
│       ├── services/
│       │   ├── ai.service.js             ← Gemini (free) → Claude (free backup) → cache → rules
│       │   └── azure-speech.service.js   ← Pronunciation Assessment + Neural TTS
│       └── routes/
│           └── index.js                  ← 24 REST endpoints
│
└── frontend/                       ← Render Static Site (rootDir: frontend)
    ├── package.json
    ├── vite.config.js              ← VITE_API_URL injected at build time
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                 ← BrowserRouter + protected routes
        ├── index.css               ← Design tokens, animations
        ├── context/
        │   └── AuthContext.jsx     ← Global auth + child state
        ├── services/
        │   └── api.js              ← Axios client, JWT interceptors, all API calls
        ├── hooks/
        │   ├── useAudioRecorder.js ← MediaRecorder (mic capture)
        │   ├── useMrsOwl.js        ← Azure TTS → browser fallback
        │   ├── useSpeech.js        ← Browser SpeechSynthesis
        │   └── useToast.js
        ├── utils/
        │   └── scoring.js          ← Word-level phonics scoring algorithm
        ├── components/
        │   ├── ui/index.jsx        ← Button, Card, Modal, Toast, Confetti, etc.
        │   └── layout/
        │       └── ParentGate.jsx  ← Maths gate before parent dashboard
        └── pages/
            ├── Landing.jsx         ← Marketing hero
            ├── Auth.jsx            ← Login / Register
            ├── Home.jsx            ← Phonics Forest story map
            ├── ReadingSession.jsx  ← Live mic → Azure → scoring → AI coaching
            ├── Shop.jsx            ← Acorn shop (exports from pages.jsx)
            ├── Trophies.jsx        ← Achievement room (exports from pages.jsx)
            ├── ParentDash.jsx      ← Parent analytics (exports from pages.jsx)
            └── pages.jsx           ← Shop, Trophies, ParentDash implementations
```

---

## 🤖 AI Pipeline Architecture

```
Child reads sentence aloud
         │
   MediaRecorder (browser) captures WebM/WAV
         │
         ▼
   POST /api/speech/assess
         │
   ┌─────▼──────────────────────┐
   │  Azure Cognitive Services  │  Free F0: 5 hr/month
   │  Pronunciation Assessment  │
   │  en-GB, Phoneme granularity│
   │                            │
   │  Returns per word:         │
   │  • Accuracy score (0-100)  │
   │  • Fluency score           │
   │  • Completeness score      │
   │  • Prosody score           │
   │  • Error type (Omission /  │
   │    Mispronunciation)       │
   │  • Per-phoneme scores      │
   └─────────────┬──────────────┘
                 │
         Word colours shown on screen
         🟢 ≥80%  🟡 60-79%  🔴 <60%
                 │
         (if any word < 60%)
                 │
                 ▼
   POST /api/ai/feedback
                 │
   ┌─────────────▼──────────────┐
   │  1. Static phoneme cache   │  Instant, 30 patterns
   │  2. Groq (Llama 3.1) (opt) │  paid, not required
   │  3. Google Gemini Flash    │  FREE: 1,500 req/day
   │  4. Rule-based fallback    │  Always works
   └─────────────┬──────────────┘
                 │
   POST /api/ai/tts
                 │
   ┌─────────────▼──────────────┐
   │  Azure Neural TTS          │  Free: 500K chars/month
   │  Voice: en-GB-SoniaNeural  │  Warm UK female voice
   │  Format: MP3, 16kHz        │
   └─────────────┬──────────────┘
                 │
         Browser plays MP3 audio
         (falls back to browser SpeechSynthesis)
```

---

## 🧪 Test After Deployment

```bash
# 1. Health check
curl https://properly-api.onrender.com/api/health

# Expected:
# {"status":"ok","azure":true,"gemini":true,"groq":true,...}

# 2. Check AI providers
curl https://properly-api.onrender.com/api/speech/status

# 3. Test registration
curl -X POST https://properly-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","childName":"Lily","phase":2}'

# 4. Test stories
curl https://properly-api.onrender.com/api/stories?phase=2
```

---

## ⚠️ Free Tier Limitations

| Limitation | Impact | Fix |
|---|---|---|
| Services **sleep** after 15 min inactivity | First request after sleep takes ~30s | Upgrade to Starter ($7/mo) or use [UptimeRobot](https://uptimerobot.com) free pinger |
| **Ephemeral filesystem** on free plan | User data lost on redeploy | Upgrade to Starter + add 1GB disk |
| 512 MB RAM | Fine for SQLite + Express | N/A |
| Shared CPU | Fine for this workload | N/A |

### Keep the free backend awake (optional)
Set up a free UptimeRobot monitor to ping `https://properly-api.onrender.com/api/health` every 14 minutes. This prevents the 30-second cold start for your users.

---

## 🔄 Updating the App

```bash
# Make changes locally, then:
git add .
git commit -m "fix: update phonics coaching tips"
git push origin main

# Render auto-deploys on push to main ✅
```

---

## 💡 Local Development

```bash
# Install all deps
npm run install:all

# Terminal 1 — backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your API keys
npm run dev:api        # → http://localhost:3001

# Terminal 2 — frontend  
npm run dev:web        # → http://localhost:5173

# The Vite dev server proxies /api → localhost:3001 automatically
```

---

## 📄 Licence

MIT — free to use, self-host, and modify.
