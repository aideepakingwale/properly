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
import { assessSpeech, uploadMiddleware, getSpeechToken, getSpeechStatus } from '../controllers/speech.controller.js';
import {
  generateAiStoryBatch, getAiStories, getAiStory, deleteAiStory,
  getAiStoryProgress, getThemes, getPhaseInfo,
  getInterests, setInterests, recordStruggle, getStruggles, getGenerationStatus
} from '../controllers/ai-story.controller.js';
import { authMiddleware, requireChild } from '../middleware/auth.middleware.js';
import getDb from '../db/database.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { getDashboard, listUsers, getUser, updateUser, deleteUser, listShopItems, createShopItem, updateShopItem, deleteShopItem, listStories, getAiStoryStats, getAnalytics, getConfig, getR2Status, triggerBackup, testAzure, testGemini, testGroq, testResend, testStripe, debugEnv, getDebugMode, setDebugMode } from '../controllers/admin.controller.js';
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

// ── SPEECH ────────────────────────────────────────────────────
router.get('/speech/status',  getSpeechStatus);
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
router.get('/admin/debug/env',             authMiddleware, requireAdmin, debugEnv);
router.get('/admin/debug-mode',            authMiddleware, requireAdmin, getDebugMode);
router.post('/admin/debug-mode',           authMiddleware, requireAdmin, setDebugMode);

export default router;
