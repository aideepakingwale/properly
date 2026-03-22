# 🚀 Properly — Render Deploy Checklist

## Before you start
- [ ] GitHub account ready
- [ ] Render.com account created (free)
- [ ] Azure Speech key copied (portal.azure.com → Speech → Free F0 → Keys)
- [ ] Gemini API key copied (aistudio.google.com/app/apikey)

## Push code
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOU/properly.git
git push -u origin main
```

## Render — Backend (Web Service)
- Root dir: `backend`
- Build: `npm install`
- Start: `npm start`
- Set env vars:

| Key | Value |
|---|---|
| NODE_ENV | production |
| PORT | 10000 |
| DB_PATH | /tmp/properly.db |
| JWT_SECRET | *(auto-generate)* |
| JWT_EXPIRES_IN | 7d |
| CORS_ORIGINS | https://properly-web.onrender.com |
| AZURE_SPEECH_KEY | *(your key)* |
| AZURE_SPEECH_REGION | uksouth |
| GROQ_API_KEY | *(leave blank — free backup only)* |

## Render — Frontend (Static Site)
- Root dir: `frontend`
- Build: `npm install && npm run build`
- Publish dir: `dist`
- Rewrite rule: `/*` → `/index.html`

| Key | Value |
|---|---|
| VITE_API_URL | https://properly-api.onrender.com/api |

## After deploy
- [ ] Visit `https://properly-api.onrender.com/api/health` — should return `{"status":"ok"}`
- [ ] Update `CORS_ORIGINS` to exact frontend URL
- [ ] Test register at `https://properly-web.onrender.com`
- [ ] Open Chrome, register, start a story, tap mic
- [ ] Check Azure chip appears on reading screen 🎉

## Optional: prevent free-tier sleep
Add UptimeRobot monitor → HTTP → `https://properly-api.onrender.com/api/health` → every 14 min
