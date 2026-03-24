/**
 * @file        subscription.controller.js
 * @description Stripe subscription controller — checkout, webhook handler, portal session
 * @module      Subscriptions
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Webhook signature verified with STRIPE_WEBHOOK_SECRET before processing
 *   - Handles: checkout.session.completed, invoice.paid, customer.subscription.deleted
 */

import getDb   from '../db/database.js';
import { PLANS, getPlanForUser } from '../config/plans.js';

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { default: Stripe } = await import('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  } catch {
    console.warn('stripe package not installed — run npm install in backend/');
    return null;
  }
}

export function stripeAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// ── GET SUBSCRIPTION STATUS ───────────────────────────────────
export const getSubscription = (req, res) => {
  const db  = getDb();
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.userId);
  const plan = getPlanForUser(sub);

  res.json({
    success: true,
    data: {
      plan:              plan.id,
      planName:          plan.name,
      planEmoji:         plan.emoji,
      status:            sub?.status || 'active',
      currentPeriodEnd:  sub?.current_period_end || null,
      cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
      limits:            plan.limits,
      stripeAvailable:   stripeAvailable(),
    },
  });
};

// ── CREATE CHECKOUT SESSION ───────────────────────────────────
export const createCheckoutSession = async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) {
    return res.status(503).json({ success: false, message: 'Payment processing not configured. Please contact support.' });
  }

  const { planId } = req.body;
  const plan = PLANS[planId];
  if (!plan || plan.id === 'free') {
    return res.status(400).json({ success: false, message: 'Invalid plan selected' });
  }

  const priceId = process.env[plan.stripePriceEnvKey];
  if (!priceId) {
    return res.status(503).json({ success: false, message: `Price not configured for ${plan.name} plan` });
  }

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  const sub  = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.userId);

  try {
    // If customer already exists in Stripe, use existing ID
    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${frontendUrl}/pricing`,
      subscription_data: {
        trial_period_days: 7,   // 7-day free trial
        metadata: { userId: user.id, planId: plan.id },
      },
      allow_promotion_codes: true,
      metadata: { userId: user.id, planId: plan.id },
    });

    res.json({ success: true, data: { checkoutUrl: session.url } });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
};

// ── CUSTOMER PORTAL (manage/cancel subscription) ──────────────
export const createPortalSession = async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) return res.status(503).json({ success: false, message: 'Not configured' });

  const db  = getDb();
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.userId);
  if (!sub?.stripe_customer_id) {
    return res.status(400).json({ success: false, message: 'No active subscription found' });
  }

  try {
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
    const portal = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: `${frontendUrl}/settings`,
    });
    res.json({ success: true, data: { portalUrl: portal.url } });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ success: false, message: 'Failed to open billing portal' });
  }
};

// ── STRIPE WEBHOOK ────────────────────────────────────────────
// Receives events from Stripe to update subscription state in DB
export const stripeWebhook = async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) return res.status(503).send('Not configured');

  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(503).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') break;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      if (!userId || !planId) break;

      // Upsert subscription record
      db.prepare(`
        INSERT INTO subscriptions (user_id, plan, status, stripe_customer_id, stripe_sub_id, updated_at)
        VALUES (?, ?, 'trialing', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          plan = excluded.plan,
          status = excluded.status,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_sub_id = excluded.stripe_sub_id,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, planId, session.customer, session.subscription);

      console.log(`✅ Subscription created: user ${userId} → ${planId}`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const planId = mapStripePriceToplan(sub.items.data[0]?.price?.id);
      db.prepare(`
        UPDATE subscriptions SET
          plan = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?,
          stripe_price_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE stripe_sub_id = ?
      `).run(
        planId,
        sub.status,
        new Date(sub.current_period_end * 1000).toISOString(),
        sub.cancel_at_period_end ? 1 : 0,
        sub.items.data[0]?.price?.id,
        sub.id
      );

      console.log(`✅ Subscription updated: ${planId} → ${sub.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      db.prepare(`
        UPDATE subscriptions SET plan = 'free', status = 'active',
          stripe_sub_id = NULL, stripe_price_id = NULL, current_period_end = NULL,
          cancel_at_period_end = 0, updated_at = CURRENT_TIMESTAMP
        WHERE stripe_sub_id = ?
      `).run(sub.id);
      console.log(`✅ Subscription cancelled, downgraded to free`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      db.prepare(`UPDATE subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP WHERE stripe_sub_id = ?`)
        .run(invoice.subscription);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      db.prepare(`UPDATE subscriptions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE stripe_sub_id = ?`)
        .run(invoice.subscription);
      break;
    }
  }

  res.json({ received: true });
};

// ── GET PLANS (public) ────────────────────────────────────────
export const getPlans = (_req, res) => {
  const plans = Object.values(PLANS).map(p => ({
    id:          p.id,
    name:        p.name,
    emoji:       p.emoji,
    price:       p.price,
    currency:    p.currency,
    interval:    p.interval,
    tagline:     p.tagline,
    color:       p.color,
    recommended: p.recommended || false,
    features:    p.features,
    notIncluded: p.notIncluded,
    limits:      p.limits,
    available:   p.id === 'free' ? true : stripeAvailable() && Boolean(process.env[p.stripePriceEnvKey]),
  }));
  res.json({ success: true, data: { plans, stripeAvailable: stripeAvailable() } });
};

// ── VERIFY CHECKOUT SUCCESS ───────────────────────────────────
export const verifyCheckout = async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) return res.status(503).json({ success: false });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    res.json({ success: true, data: { status: session.status, plan: session.metadata?.planId } });
  } catch {
    res.status(400).json({ success: false, message: 'Invalid session' });
  }
};

// Helper: map Stripe price ID back to plan ID
function mapStripePriceToplan(priceId) {
  if (!priceId) return 'free';
  if (priceId === process.env.STRIPE_PRICE_SPROUT_MONTHLY) return 'sprout';
  if (priceId === process.env.STRIPE_PRICE_FOREST_MONTHLY) return 'forest';
  return 'sprout'; // default paid
}
