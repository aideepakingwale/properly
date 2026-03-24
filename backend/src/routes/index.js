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

export default router;
