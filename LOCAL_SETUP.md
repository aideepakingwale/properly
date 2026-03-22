# 🦉 Properly — Local Development Guide

Everything you need to run the full app on your machine in **under 10 minutes**.

---

## ✅ What You Need First

| Tool | Version | Download |
|---|---|---|
| **Node.js** | v22 or v24 | [nodejs.org](https://nodejs.org) — download the **LTS** version (v22 LTS recommended) |
| **Chrome** | Any recent | [chrome.google.com](https://www.google.com/chrome) — needed for microphone/speech |
| **A code editor** | Optional | [VS Code](https://code.visualstudio.com) recommended |

That's it. Everything else is installed automatically.

---

## 🚀 Quick Start (3 steps)

### Step 1 — Run the setup script

```bash
# macOS / Linux
chmod +x setup.sh && ./setup.sh

# Windows
# Double-click setup.bat
```

This installs all packages and creates your `backend/.env` file automatically.

### Step 2 — Start both servers

Open **two terminal windows** (or two VS Code terminals):

**Terminal 1 — API Server:**
```bash
cd backend
npm run dev
```
You'll see:
```
🦉 Properly API
   Port    : 3001
   DB      : ./data/properly.db
   Azure   : ⚠️  not set (browser fallback)
   Gemini  : ⚠️  not set
```

**Terminal 2 — React App:**
```bash
cd frontend
npm run dev
```
You'll see:
```
  VITE v5.x.x  ready in 800ms

  ➜  Local:   http://localhost:5173/
```

### Step 3 — Open in Chrome

```
http://localhost:5173
```

Register an account, create a child profile, pick a phase, and start reading! 🌳

---

## 🔑 Optional: Add Free API Keys (Recommended)

The app works without any keys — it falls back to browser speech and template stories. Adding keys unlocks the full AI experience.

Open **`backend/.env`** in any text editor:

```
# Google Gemini Flash — FREE, no billing needed
# 1,500 AI coaching tips + story generations per day
GEMINI_API_KEY=AIzaSy...your-key-here

# Azure Speech — FREE F0 tier
# Real pronunciation scoring + natural UK TTS voice
AZURE_SPEECH_KEY=abc123...your-key-here
AZURE_SPEECH_REGION=uksouth

# Groq (Llama 3.1) — FREE BACKUP, not needed (Gemini is free)
# GROQ_API_KEY=sk-ant-...only-add-if-you-want-to-pay
```

**After editing `.env`, restart the backend** (Ctrl+C then `npm run dev` again).


### Why Node.js v22+ is required

This project uses **`node:sqlite`** — SQLite built directly into Node.js (no npm install needed).
It was added in Node 22.5. On v24 (which you have) it works perfectly.

Older Node versions (v18, v20) would require `better-sqlite3` which is a native C++ module
that needs Visual Studio Build Tools on Windows — causing the install error you saw.
Node v22+ eliminates that problem entirely.

### Getting the free keys (5 minutes)

**Google Gemini Flash (FREE):**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key → Create in new project**
3. Copy the key into `GEMINI_API_KEY=`

**Groq — Llama 3.1 (FREE, 14,400 req/day):**
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up (no billing required) → click **Create API Key**
3. Copy the key into `GROQ_API_KEY=`

**Azure Speech FREE F0 (5 hrs/month STT + 500K chars/month TTS):**
1. Go to [portal.azure.com](https://portal.azure.com) → Sign in (free account works)
2. Click **Create a resource** → search **Speech** → select it
3. Fill in:
   - Resource group: `properly-rg` (create new)
   - Region: **UK South**
   - Name: `properly-speech`
   - Pricing tier: **Free F0** ✅
4. Click **Review + Create → Create**
5. Go to your resource → **Keys and Endpoint** → copy **Key 1**
6. Paste into `AZURE_SPEECH_KEY=`

---

## 🗂️ Project Structure at a Glance

```
properly-render/
├── setup.sh              ← Run this first (Mac/Linux)
├── setup.bat             ← Run this first (Windows)
│
├── backend/              ← Terminal 1: npm run dev → :3001
│   ├── .env              ← Created by setup.sh — add your API keys here
│   ├── package.json
│   └── src/
│       ├── app.js                     Express server entry point
│       ├── db/
│       │   ├── schema.sql             All 14 database tables
│       │   ├── seed.js                14 stories, 15 shop items, 14 achievements
│       │   └── database.js            SQLite (node:sqlite — built into Node 22+)
│       ├── controllers/
│       │   ├── auth.controller.js     POST /auth/register, /login
│       │   ├── story.controller.js    GET  /stories, /phases
│       │   ├── ai-story.controller.js POST /children/:id/ai-stories (AI gen)
│       │   ├── progress.controller.js Sessions, acorns, achievements
│       │   ├── shop.controller.js     Items, purchase
│       │   └── speech.controller.js   Azure pronunciation assessment
│       ├── services/
│       │   ├── story-generator.service.js  AI story generation logic
│       │   ├── ai.service.js               Mrs. Owl coaching (Gemini free → Claude free backup)
│       │   └── azure-speech.service.js     Pronunciation + TTS
│       └── routes/index.js            All 34 REST endpoints
│
└── frontend/             ← Terminal 2: npm run dev → :5173
    ├── package.json
    ├── vite.config.js    Proxies /api → localhost:3001
    └── src/
        ├── pages/
        │   ├── Landing.jsx            Marketing page
        │   ├── Auth.jsx               Login / Register
        │   ├── Home.jsx               Phonics Forest (tabs: Curriculum + AI)
        │   ├── ReadingSession.jsx     Live reading with mic scoring
        │   ├── Shop.jsx               Acorn shop
        │   ├── Trophies.jsx           Achievement room
        │   └── ParentDash.jsx         Parent analytics + interests
        ├── components/
        │   ├── StoryForest.jsx        AI story generator UI
        │   ├── InterestsPanel.jsx     Parent interest picker
        │   └── ui/index.jsx           All shared UI components
        ├── services/api.js            Axios client (auto-attaches JWT)
        └── hooks/
            ├── useAudioRecorder.js    MediaRecorder (mic capture)
            └── useMrsOwl.js           Azure TTS → browser fallback
```

---

## 🔍 Verify Everything Works

After both servers are running:

```bash
# 1. API health (should return JSON)
curl http://localhost:3001/api/health

# Expected:
# {"status":"ok","azure":true/false,"gemini":true/false,...}

# 2. Stories available
curl http://localhost:3001/api/stories?phase=2

# 3. AI story provider status
curl http://localhost:3001/api/ai-stories/status
```

Or just open Chrome at `http://localhost:5173` and:
1. Register → create child "Lily", Phase 2
2. The API health shows in the reading screen (Azure chip)
3. Go to ✨ My Stories tab → tap "New Story"

---

## 🗄️ Database

SQLite database is created automatically at `backend/data/properly.db` on first start.

```bash
# Manually re-seed stories/achievements/shop items
cd backend && npm run seed

# Reset database completely (deletes all accounts + progress)
rm backend/data/properly.db
# Then restart: npm run dev (re-creates from schema + seeds)
```

---

## 🐛 Troubleshooting

### "Cannot find module" / install errors
```bash
# Delete node_modules and reinstall
rm -rf backend/node_modules frontend/node_modules
cd backend && npm install && cd ../frontend && npm install
```

### Backend port 3001 already in use
```bash
# macOS/Linux — find and kill the process
lsof -ti:3001 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

### Frontend can't reach API (CORS or network errors)
- Make sure backend is running: `curl http://localhost:3001/api/health`
- Check `backend/.env` has `CORS_ORIGINS=http://localhost:5173`
- Restart the backend after editing `.env`

### Speech recognition not working
- **Must use Chrome** — Firefox and Safari have limited/no Web Speech API support
- Allow microphone when the browser asks
- Check `chrome://settings/content/microphone` — localhost must not be blocked

### Azure speech not working
- Check the key is correct: `AZURE_SPEECH_KEY=` (no quotes, no spaces)
- Confirm region matches: `AZURE_SPEECH_REGION=uksouth`
- Free F0 limit: 5 audio hours/month. Check usage at [portal.azure.com](https://portal.azure.com)

### AI stories not generating
- Check `GEMINI_API_KEY=` is set in `backend/.env`
- Verify via: `curl http://localhost:3001/api/ai-stories/status`
- The daily limit is 5 stories per child per day (even locally)
- Without any AI key, it uses built-in template stories (always works)

### "node:sqlite is an experimental feature" warning
This is just a console notice — it doesn't affect functionality. The warning is suppressed automatically via the `--no-warnings` flag already added to all npm scripts.

If you still see it, you can safely ignore it or run:
```bash
node --no-warnings=ExperimentalWarning src/app.js
```

### npm install still fails on Windows
```bash
# Delete node_modules and retry
rmdir /s /q backend\node_modules
cd backend && npm install
```
All packages are pure JavaScript — no C++ compilation required.

---

## ♻️ Development Workflow

```bash
# Both servers auto-reload on file changes via Vite HMR + nodemon

# Make a backend change (e.g., edit a controller)
# → nodemon detects it → API restarts automatically

# Make a frontend change (e.g., edit Home.jsx)
# → Vite HMR → browser updates instantly, no full reload

# Add a new story to seed.js
cd backend && npm run seed  # re-runs seed data

# Test a specific API endpoint
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","childName":"Lily","phase":2}'
```

---

## 🌐 View the full app at

| URL | What |
|---|---|
| `http://localhost:5173` | React app (child + parent UI) |
| `http://localhost:3001/api/health` | API health check |
| `http://localhost:3001/api/speech/status` | AI provider status |
| `http://localhost:3001/api/ai-stories/themes` | Available story themes |
| `http://localhost:3001/api/stories?phase=2` | Curriculum stories |

---

## 🚀 When ready to go live

```bash
# Build the frontend for production
cd frontend && npm run build
# → Creates frontend/dist/ — deploy this to Render Static Site

# The backend runs as-is with NODE_ENV=production
# → Deploy to Render Web Service (rootDir: backend)

# See README.md → "Deploy to Render" section for full instructions
```
