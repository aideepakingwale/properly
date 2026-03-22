@echo off
:: ================================================================
:: Properly — Local Setup Script for Windows
:: Run from Command Prompt:  setup.bat
:: Or double-click in File Explorer
:: ================================================================

echo.
echo  ============================================
echo   Properly - AI Phonics Tutor - Local Setup
echo  ============================================
echo.

:: ── CHECK NODE VERSION ──────────────────────────────────────────
echo [1/4] Checking Node.js...
where node >nul 2>&1
IF ERRORLEVEL 1 (
  echo.
  echo  ERROR: Node.js is not installed.
  echo.
  echo  Please download and install Node.js v22 or v24 from:
  echo  https://nodejs.org  ^(choose the LTS version^)
  echo.
  echo  After installing, restart this script.
  pause
  exit /b 1
)

FOR /F "tokens=*" %%i IN ('node --version') DO SET NODE_VER=%%i
echo  OK: Node.js %NODE_VER% found

:: Check version is 22+
FOR /F "tokens=1 delims=." %%a IN ("%NODE_VER:v=%") DO SET NODE_MAJOR=%%a
IF %NODE_MAJOR% LSS 22 (
  echo.
  echo  ERROR: Node.js %NODE_VER% is too old.
  echo  This app needs Node.js v22 or higher for the built-in SQLite module.
  echo  Download v22 LTS from: https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo  OK: Version is compatible ^(v22+ required for built-in SQLite^)

:: ── CREATE DATA DIR ──────────────────────────────────────────────
echo.
echo [2/4] Creating data directory...
IF NOT EXIST "backend\data" mkdir "backend\data"
echo  OK: backend\data\ ready

:: ── INSTALL BACKEND DEPS ─────────────────────────────────────────
echo.
echo [3/4] Installing backend packages...
echo  ^(This uses only pure JavaScript packages - no compilation needed^)
cd backend
call npm install
IF ERRORLEVEL 1 (
  echo.
  echo  ERROR: npm install failed in backend folder.
  echo.
  echo  Try these fixes:
  echo    1. Delete backend\node_modules and try again
  echo    2. Run: npm cache clean --force
  echo    3. Make sure you have internet access
  echo.
  cd ..
  pause
  exit /b 1
)
echo  OK: Backend packages installed
cd ..

:: ── INSTALL FRONTEND DEPS ────────────────────────────────────────
echo.
echo [4/4] Installing frontend packages...
cd frontend
call npm install
IF ERRORLEVEL 1 (
  echo.
  echo  ERROR: npm install failed in frontend folder.
  echo.
  echo  Try: delete frontend\node_modules and run setup.bat again.
  echo.
  cd ..
  pause
  exit /b 1
)
echo  OK: Frontend packages installed
cd ..

:: ── CREATE .ENV ──────────────────────────────────────────────────
IF EXIST "backend\.env" (
  echo.
  echo  SKIP: backend\.env already exists
) ELSE (
  echo.
  echo  Creating backend\.env ...
  (
    echo NODE_ENV=development
    echo PORT=3001
    echo DB_PATH=./data/properly.db
    echo JWT_SECRET=local-dev-secret-change-me-for-production
    echo JWT_EXPIRES_IN=7d
    echo CORS_ORIGINS=http://localhost:5173,http://localhost:4173
    echo RATE_LIMIT_WINDOW_MS=900000
    echo RATE_LIMIT_MAX=500
    echo.
    echo # Google Gemini Flash ^(FREE - 1,500 req/day, no billing^)
    echo # Get key: https://aistudio.google.com/app/apikey
    echo GEMINI_API_KEY=
    echo.
    echo # Groq / Llama 3.1 ^(FREE - 14,400 req/day, no billing^)
    echo # Get key: https://console.groq.com/keys
    echo GROQ_API_KEY=
    echo.
    echo # Azure Speech ^(FREE F0 tier - pronunciation scoring + TTS^)
    echo # Get key: https://portal.azure.com -^> Speech -^> Free F0
    echo AZURE_SPEECH_KEY=
    echo AZURE_SPEECH_REGION=uksouth
    echo.
    echo # Email verification ^(optional - app works without it^)
    echo # Gmail: enable 2FA, then create an App Password at myaccount.google.com
    echo SMTP_PROVIDER=gmail
    echo SMTP_USER=your.email@gmail.com
    echo SMTP_PASS=your-16-char-app-password
    echo SMTP_FROM_NAME=Properly Phonics
    echo APP_URL=http://localhost:5173
  ) > "backend\.env"
  echo  OK: backend\.env created
)

:: ── DONE ─────────────────────────────────────────────────────────
echo.
echo  ============================================
echo   Setup complete!
echo  ============================================
echo.
echo  NEXT STEPS:
echo.
echo  1. ^(Optional^) Open backend\.env in Notepad and add your free keys:
echo     GEMINI_API_KEY  -^>  https://aistudio.google.com/app/apikey
echo     GROQ_API_KEY    -^>  https://console.groq.com/keys
echo     AZURE_SPEECH_KEY-^>  https://portal.azure.com
echo.
echo  2. Open TWO Command Prompt windows:
echo.
echo     Window 1 - API backend:
echo       cd backend
echo       npm run dev
echo.
echo     Window 2 - React frontend:
echo       cd frontend
echo       npm run dev
echo.
echo  3. Open Chrome and go to:
echo       http://localhost:5173
echo.
echo  API health check:
echo       http://localhost:3001/api/health
echo.
pause
