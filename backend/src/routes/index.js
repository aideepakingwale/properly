/**
 * @file        index.js
 * @description Express router — all REST API routes for auth, children, progress, stories, AI, shop, speech and admin
 * @module      Routes
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Literal path segments (e.g. /sessions/page) must appear BEFORE param routes (/:id) to avoid Express mis-matching
 *   - Admin routes all require authMiddleware + requireAdmin
 *   - Speech routes use uploadMiddleware (multer) before the controller
 */

import { Router }     from 'express';
import passport       from 'passport';
import { register, login, getMe, verifyEmail, resendVerification } from '../controllers/auth.controller.js';
import { googleCallback, facebookCallback, socialStatus }          from '../controllers/social-auth.controller.js';
import { getStories, getStory, getPhases }                         from '../controllers/story.controller.js';
import {
  getChild, updateChild, startSession, submitPage,
  completeSession, getProgress, upsertGoal, deleteGoal
} from '../controllers/progress.controller.js';
import { getShopItems, getOwnedItems, purchaseItem }               from '../controllers/shop.controller.js';
import { getFeedback, getTTS }                                      from '../services/ai.service.js';
import { assessSpeech, uploadMiddleware, getSpeechToken, getSpeechStatus, testAzureConnectivity } from '../controllers/speech.controller.js';
import {
  generateAiStoryBatch, getAiStories, getAiStory, deleteAiStory,
  getAiStoryProgress, getThemes, getPhaseInfo,
  getInterests, setInterests, recordStruggle, getStruggles, getGenerationStatus
} from '../controllers/ai-story.controller.js';
import { authMiddleware, requireChild } from '../middleware/auth.middleware.js';
import getDb from '../db/database.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { submitReport, myReports, adminListReports, adminReviewReport } from '../controllers/report.controller.js';
import { getUserCredits, listBooks, getBook, createBook, deleteBook, orderPrint, getBookDebug, retryBook } from '../controllers/book.controller.js';
import { adminListBooks, adminAddCredits, adminGetCredits, getBookLogs } from '../controllers/book.controller.js';
import { getDashboard, listUsers, getUser, updateUser, deleteUser, listShopItems, createShopItem, updateShopItem, deleteShopItem, listStories, getAiStoryStats, getAnalytics, getConfig, getR2Status, triggerBackup, testAzure, testGemini, testGroq, testResend, testStripe, testPollinations, testAudioPipeline, debugEnv, getDebugMode, setDebugMode } from '../controllers/admin.controller.js';
import { listChildren, addChild, updateChild as updateChildMgmt, deleteChild } from '../controllers/children.controller.js';
import {
  getPlans, getSubscription, createCheckoutSession,
  createPortalSession, stripeWebhook, verifyCheckout
} from '../controllers/subscription.controller.js';

const router = Router();

// ── AUTH — email/password ─────────────────────────────────────
router.post('/auth/register',            register);
router.post('/auth/login',               login);
router.get('/auth/me',                   authMiddleware, getMe);
router.get('/auth/verify-email',         verifyEmail);
router.post('/auth/resend-verification', resendVerification);

// ── AUTH — social OAuth status ────────────────────────────────
router.get('/auth/social/status', socialStatus);

// ── GOOGLE OAUTH ─────────────────────────────────────────────
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/auth?error=Google+authentication+failed`, session: true }),
  googleCallback
);

// ── FACEBOOK OAUTH ────────────────────────────────────────────
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email', 'public_profile'] })
);
router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/auth?error=Facebook+authentication+failed`, session: true }),
  facebookCallback
);

// ── STATIC STORIES ────────────────────────────────────────────
router.get('/phases',      getPhases);
router.get('/stories',     getStories);
router.get('/stories/:id', getStory);

// ── AI STORIES ────────────────────────────────────────────────
// AI Stories — meta
router.get('/ai-stories/themes',                              getThemes);
router.get('/ai-stories/phase/:phase',                        getPhaseInfo);
router.get('/ai-stories/status',                              getGenerationStatus);

// AI Stories — CRUD + batch generation
router.get('/children/:childId/ai-stories',                   authMiddleware, requireChild, getAiStories);
router.post('/children/:childId/ai-stories/batch',            authMiddleware, requireChild, generateAiStoryBatch);
router.get('/children/:childId/ai-stories/progress',          authMiddleware, requireChild, getAiStoryProgress);
router.get('/children/:childId/ai-stories/:storyId',          authMiddleware, requireChild, getAiStory);
router.delete('/children/:childId/ai-stories/:storyId',       authMiddleware, requireChild, deleteAiStory);

// AI Story reading sessions handled by unified /sessions routes below

// Child interests & struggle words
router.get('/children/:childId/interests',                    authMiddleware, requireChild, getInterests);
router.put('/children/:childId/interests',                    authMiddleware, requireChild, setInterests);
router.post('/children/:childId/struggles',                   authMiddleware, requireChild, recordStruggle);
router.get('/children/:childId/struggles',                    authMiddleware, requireChild, getStruggles);

// ── CHILDREN MANAGEMENT (parent manages all kids) ───────────────
router.get('/children',             authMiddleware, listChildren);
router.post('/children',            authMiddleware, addChild);
router.patch('/children/:childId',  authMiddleware, updateChildMgmt);
router.delete('/children/:childId', authMiddleware, deleteChild);

// ── CHILD PROGRESS ────────────────────────────────────────────
router.get('/children/:childId',                   authMiddleware, requireChild, getChild);
router.get('/children/:childId/progress',          authMiddleware, requireChild, getProgress);
router.post('/children/:childId/sessions',         authMiddleware, requireChild, startSession);
router.post('/children/:childId/sessions/page',    authMiddleware, requireChild, submitPage);
router.post('/children/:childId/sessions/complete',authMiddleware, requireChild, completeSession);
router.put('/children/:childId/goal',              authMiddleware, requireChild, upsertGoal);
router.delete('/children/:childId/goal',           authMiddleware, requireChild, deleteGoal);

// ── SHOP ──────────────────────────────────────────────────────
router.get('/shop/items',                     getShopItems);
router.get('/children/:childId/shop/owned',   authMiddleware, requireChild, getOwnedItems);
router.post('/children/:childId/shop/buy',    authMiddleware, requireChild, purchaseItem);

// ── AI COACHING & TTS ─────────────────────────────────────────
router.post('/ai/feedback', authMiddleware, getFeedback);
router.post('/ai/tts',      authMiddleware, getTTS);
// ── PHONEME PRELOAD — all 44 phonemes in one request ────────────
// Called once at app startup. Returns { '/k/': '<base64 mp3>', ... }
// Client caches in localStorage — zero API calls during reading sessions.
router.get('/ai/phonemes/preload', authMiddleware, async (req, res) => {
  if (!azureAvail()) {
    return res.json({ success: false, message: 'Azure TTS not configured', data: {} });
  }

  // All IPA phonemes used in DfE Letters & Sounds Phase 2–6
  const PHONEMES = [
    // Consonant stops
    { ipa: 'p', grapheme: 'p' }, { ipa: 'b', grapheme: 'b' },
    { ipa: 't', grapheme: 't' }, { ipa: 'd', grapheme: 'd' },
    { ipa: 'k', grapheme: 'c' }, { ipa: 'g', grapheme: 'g' },
    // Fricatives
    { ipa: 'f', grapheme: 'f' }, { ipa: 'v', grapheme: 'v' },
    { ipa: 's', grapheme: 's' }, { ipa: 'z', grapheme: 'z' },
    { ipa: 'ʃ', grapheme: 'sh'}, { ipa: 'h', grapheme: 'h' },
    { ipa: 'ð', grapheme: 'th'}, { ipa: 'θ', grapheme: 'th'},
    // Affricates
    { ipa: 'tʃ', grapheme: 'ch'}, { ipa: 'dʒ', grapheme: 'j' },
    // Nasals & approximants
    { ipa: 'm', grapheme: 'm' }, { ipa: 'n', grapheme: 'n' },
    { ipa: 'ŋ', grapheme: 'ng'}, { ipa: 'l', grapheme: 'l' },
    { ipa: 'r', grapheme: 'r' }, { ipa: 'w', grapheme: 'w' },
    { ipa: 'j', grapheme: 'y' }, { ipa: 'kw',grapheme: 'qu'},
    { ipa: 'ks',grapheme: 'x' },
    // Short vowels
    { ipa: 'æ', grapheme: 'a' }, { ipa: 'ɛ', grapheme: 'e' },
    { ipa: 'ɪ', grapheme: 'i' }, { ipa: 'ɒ', grapheme: 'o' },
    { ipa: 'ʌ', grapheme: 'u' }, { ipa: 'ʊ', grapheme: 'oo'},
    { ipa: 'ə', grapheme: 'a' },
    // Long vowels & diphthongs
    { ipa: 'eɪ', grapheme: 'ai' }, { ipa: 'iː', grapheme: 'ee' },
    { ipa: 'aɪ', grapheme: 'igh'}, { ipa: 'əʊ', grapheme: 'oa' },
    { ipa: 'uː', grapheme: 'oo' }, { ipa: 'aʊ', grapheme: 'ow' },
    { ipa: 'ɔɪ', grapheme: 'oi' }, { ipa: 'ɑː', grapheme: 'ar' },
    { ipa: 'ɔː', grapheme: 'or' }, { ipa: 'ɜː', grapheme: 'ur' },
    { ipa: 'juː',grapheme: 'ue' }, { ipa: 'ɪə', grapheme: 'ear'},
    { ipa: 'eə', grapheme: 'air'}, { ipa: 'ʊə', grapheme: 'ure'},
  ];

  // Fetch all phonemes in parallel (Azure TTS is fast per request ~200-400ms)
  const results = {};
  const errors  = [];

  await Promise.allSettled(
    PHONEMES.map(async ({ ipa, grapheme }) => {
      try {
        const buf = await synthesisePhoneme(ipa, grapheme, 0.55);
        results[ipa] = buf.toString('base64');
      } catch (e) {
        errors.push({ ipa, error: e.message });
      }
    })
  );

  console.log(`[Phoneme Preload] ${Object.keys(results).length}/${PHONEMES.length} phonemes generated. ${errors.length} errors.`);
  if (errors.length) console.warn('[Phoneme Preload] Errors:', errors);

  res.json({
    success: true,
    data: {
      phonemes: results,
      count:    Object.keys(results).length,
      errors,
      generatedAt: new Date().toISOString(),
    },
  });
});

router.post('/ai/phoneme',  authMiddleware, async (req, res) => {
  // Returns MP3 audio of a single IPA phoneme spoken by Azure TTS
  // Used by the phonics mode "Hear the Sounds" feature
  const { ipa, grapheme, rate = 0.55 } = req.body;
  if (!ipa || !grapheme) return res.status(400).json({ success: false, message: 'ipa and grapheme required' });
  if (!azureAvail()) return res.status(503).json({ success: false, message: 'Azure TTS not configured' });
  try {
    const buf = await synthesisePhoneme(ipa, grapheme, rate);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=31536000'); // cache 1 year — phonemes never change
    res.send(buf);
  } catch (e) {
    console.error('[Phoneme TTS]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── SPEECH ────────────────────────────────────────────────────
router.get('/speech/status',  getSpeechStatus);
router.post('/speech/test-azure', authMiddleware, testAzureConnectivity);
router.get('/speech/token',   authMiddleware, getSpeechToken);
router.post('/speech/assess', authMiddleware, uploadMiddleware, assessSpeech);

// ── SUBSCRIPTIONS ────────────────────────────────────────────
router.get('/plans',                        getPlans);
router.get('/subscription',                 authMiddleware, getSubscription);
router.post('/subscription/checkout',       authMiddleware, createCheckoutSession);
router.post('/subscription/portal',         authMiddleware, createPortalSession);
router.get('/subscription/verify',          authMiddleware, verifyCheckout);
// Stripe webhook — raw body required (configured in app.js)
router.post('/webhooks/stripe',             stripeWebhook);

// ── HEALTH ────────────────────────────────────────────────────
// Public — frontend reads to show/hide debug panel (no auth needed)
router.get('/debug-mode', (_req, res) => {
  try {
    const db = getDb();
    const s  = db.prepare("SELECT value FROM app_settings WHERE key='debug_mode'").get();
    res.json({ success: true, data: { enabled: s?.value === 'true' } });
  } catch { res.json({ success: true, data: { enabled: false } }); }
});

// ── BOOK ROUTES ──────────────────────────────────────────────
// ── REPORT ROUTES ────────────────────────────────────────────
router.post('/reports',                         authMiddleware, submitReport);
router.get('/reports/mine',                     authMiddleware, myReports);
router.get('/admin/reports',                    authMiddleware, requireAdmin, adminListReports);
router.post('/admin/reports/:id/review',        authMiddleware, requireAdmin, adminReviewReport);

router.get('/books/credits',                    authMiddleware, getUserCredits);
router.get('/books/child/:childId',             authMiddleware, listBooks);
router.post('/books',                           authMiddleware, createBook);
router.get('/books/:bookId',                    authMiddleware, getBook);
router.delete('/books/:bookId',                 authMiddleware, deleteBook);
router.get('/books/:bookId/debug',              authMiddleware, requireAdmin, getBookDebug);
router.post('/books/:bookId/retry',             authMiddleware, retryBook);
router.post('/books/:bookId/order-print',       authMiddleware, orderPrint);

// ── ADMIN BOOK ROUTES ─────────────────────────────────────────
router.get('/admin/books',                      authMiddleware, requireAdmin, adminListBooks);
router.get('/admin/books/:bookId/logs',          authMiddleware, requireAdmin, getBookLogs);
router.get('/admin/books/credits',              authMiddleware, requireAdmin, adminGetCredits);
router.post('/admin/users/:userId/credits',     authMiddleware, requireAdmin, adminAddCredits);

router.get('/health', (_req, res) => res.json({
  status:   'ok',
  ts:       new Date().toISOString(),
  azure:    Boolean(process.env.AZURE_SPEECH_KEY),
  gemini:   Boolean(process.env.GEMINI_API_KEY),
  groq:     Boolean(process.env.GROQ_API_KEY),
  email:    Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  google:   Boolean(process.env.GOOGLE_CLIENT_ID),
  facebook: Boolean(process.env.FACEBOOK_APP_ID),
}));

// ── ADMIN ROUTES ──────────────────────────────────────────────
router.get('/admin/dashboard',              authMiddleware, requireAdmin, getDashboard);
router.get('/admin/users',                  authMiddleware, requireAdmin, listUsers);
router.get('/admin/users/:userId',          authMiddleware, requireAdmin, getUser);
router.patch('/admin/users/:userId',        authMiddleware, requireAdmin, updateUser);
router.delete('/admin/users/:userId',       authMiddleware, requireAdmin, deleteUser);
router.get('/admin/shop',                   authMiddleware, requireAdmin, listShopItems);
router.post('/admin/shop',                  authMiddleware, requireAdmin, createShopItem);
router.patch('/admin/shop/:itemId',         authMiddleware, requireAdmin, updateShopItem);
router.delete('/admin/shop/:itemId',        authMiddleware, requireAdmin, deleteShopItem);
router.get('/admin/stories',               authMiddleware, requireAdmin, listStories);
router.get('/admin/stories/ai-stats',      authMiddleware, requireAdmin, getAiStoryStats);
router.get('/admin/analytics',             authMiddleware, requireAdmin, getAnalytics);
router.get('/admin/config',                authMiddleware, requireAdmin, getConfig);
router.get('/admin/r2-status',             authMiddleware, requireAdmin, getR2Status);
router.post('/admin/r2-backup',            authMiddleware, requireAdmin, triggerBackup);
router.post('/admin/test/azure',           authMiddleware, requireAdmin, testAzure);
router.post('/admin/test/gemini',          authMiddleware, requireAdmin, testGemini);
router.post('/admin/test/groq',            authMiddleware, requireAdmin, testGroq);
router.post('/admin/test/resend',          authMiddleware, requireAdmin, testResend);
router.post('/admin/test/stripe',          authMiddleware, requireAdmin, testStripe);
router.post('/admin/test/pollinations',     authMiddleware, requireAdmin, testPollinations);
router.post('/admin/test/audio-pipeline',   authMiddleware, requireAdmin, testAudioPipeline);
router.get('/admin/debug/env',             authMiddleware, requireAdmin, debugEnv);
router.get('/admin/debug-mode',            authMiddleware, requireAdmin, getDebugMode);
router.post('/admin/debug-mode',           authMiddleware, requireAdmin, setDebugMode);

export default router;
