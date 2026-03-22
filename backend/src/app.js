import 'dotenv/config';
import express       from 'express';
import cors          from 'cors';
import helmet        from 'helmet';
import morgan        from 'morgan';
import rateLimit     from 'express-rate-limit';
import session       from 'express-session';
import { getDb }     from './db/database.js';
import { seed }      from './db/seed.js';
import routes        from './routes/index.js';
import { configurePassport } from './services/passport.service.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// ── SECURITY HEADERS ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────
const allowed = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowed.push('http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173');
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());

// ── SESSION (required for Passport OAuth handshake only) ──────
app.use(session({
  secret:            process.env.JWT_SECRET || 'dev-session-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 minutes — only needed during OAuth flow
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// ── PASSPORT ──────────────────────────────────────────────────
const passport = configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ── RATE LIMITING ─────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 200,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
}));
app.use('/api/ai',             rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/speech/assess',  rateLimit({ windowMs: 60_000, max: 20 }));

// ── BODY PARSING ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── LOGGING ───────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api', routes);
app.get('/', (_req, res) => res.json({ app: 'Properly API', status: 'ok' }));
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
});

// ── STARTUP ───────────────────────────────────────────────────
async function start() {
  try {
    getDb(); seed();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🦉 Properly API');
      console.log(`   Port     : ${PORT}`);
      console.log(`   Env      : ${process.env.NODE_ENV}`);
      console.log(`   DB       : ${process.env.DB_PATH}`);
      console.log(`   Azure    : ${process.env.AZURE_SPEECH_KEY    ? '✅' : '⚠️  not set'}`);
      console.log(`   Gemini   : ${process.env.GEMINI_API_KEY      ? '✅' : '⚠️  not set'}`);
      console.log(`   Email    : ${process.env.SMTP_USER           ? '✅' : '⚠️  not set'}`);
      console.log(`   Google   : ${process.env.GOOGLE_CLIENT_ID    ? '✅' : '⚠️  not set'}`);
      console.log(`   Facebook : ${process.env.FACEBOOK_APP_ID     ? '✅' : '⚠️  not set'}\n`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();
export default app;
