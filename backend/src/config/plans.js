/**
 * Properly — Subscription Plan Definitions
 *
 * Single source of truth. Imported by:
 *   - subscription.controller.js  (enforcement)
 *   - routes/index.js              (limit middleware)
 *   - pricing page data endpoint
 */

export const PLANS = {
  free: {
    id:          'free',
    name:        'Seedling',
    emoji:       '🌱',
    price:       0,
    currency:    'GBP',
    interval:    null,
    tagline:     'Get started free',
    color:       '#059669',

    // Feature limits
    limits: {
      curriculumStories:  3,       // out of 14
      aiStoriesPerDay:    2,
      children:           1,
      azureScoring:       false,   // browser STT only
      azureTTS:           false,   // browser SpeechSynthesis only
      parentDashboard:    false,
      downloadReports:    false,
      customGoals:        false,
      phaseAccess:        [2],     // Phase 2 only
    },

    features: [
      '3 curriculum phonics stories',
      '2 AI personalised stories/day',
      'Browser microphone scoring',
      'Golden Acorn rewards',
      'Basic progress tracking',
    ],
    notIncluded: [
      'Azure phoneme-level scoring',
      'Natural Mrs. Owl voice',
      'All 5 phonics phases',
      'Multiple children',
      'Parent analytics dashboard',
    ],
  },

  sprout: {
    id:          'sprout',
    name:        'Sprout',
    emoji:       '🌿',
    price:       3.99,
    currency:    'GBP',
    interval:    'month',
    tagline:     'Most popular',
    color:       '#2D6A4F',
    recommended: true,

    // Stripe Price IDs (set in .env or Stripe dashboard)
    // STRIPE_PRICE_SPROUT_MONTHLY=price_xxx
    stripePriceEnvKey: 'STRIPE_PRICE_SPROUT_MONTHLY',

    limits: {
      curriculumStories:  14,      // all stories
      aiStoriesPerDay:    10,
      children:           1,
      azureScoring:       true,    // real phoneme analysis
      azureTTS:           true,    // en-GB-SoniaNeural voice
      parentDashboard:    true,
      downloadReports:    false,
      customGoals:        true,
      phaseAccess:        [2,3,4,5,6],
    },

    features: [
      'All 14 curriculum stories',
      '10 AI personalised stories/day',
      '☁️ Azure phoneme-level scoring',
      '🦉 Natural Mrs. Owl UK voice',
      'All 5 phonics phases (2–6)',
      'Parent analytics dashboard',
      'Custom reading goals',
    ],
    notIncluded: [
      'Multiple children profiles',
      'PDF progress reports',
    ],
  },

  forest: {
    id:          'forest',
    name:        'Forest',
    emoji:       '🌳',
    price:       6.99,
    currency:    'GBP',
    interval:    'month',
    tagline:     'For families',
    color:       '#1B4332',

    stripePriceEnvKey: 'STRIPE_PRICE_FOREST_MONTHLY',

    limits: {
      curriculumStories:  14,
      aiStoriesPerDay:    -1,      // unlimited
      children:           5,       // up to 5 children
      azureScoring:       true,
      azureTTS:           true,
      parentDashboard:    true,
      downloadReports:    true,
      customGoals:        true,
      phaseAccess:        [2,3,4,5,6],
    },

    features: [
      'Everything in Sprout',
      'Up to 5 children profiles',
      'Unlimited AI stories',
      'PDF progress reports',
      'Priority email support',
      'Early access to new features',
    ],
    notIncluded: [],
  },
};

/**
 * Get plan for a user — defaults to free
 */
export function getPlanForUser(subscription) {
  if (!subscription || subscription.status !== 'active') return PLANS.free;
  return PLANS[subscription.plan] || PLANS.free;
}

/**
 * Check if a user's plan allows a feature
 */
export function canAccess(subscription, feature) {
  const plan = getPlanForUser(subscription);
  const val  = plan.limits[feature];
  if (val === false) return false;
  if (val === true)  return true;
  if (val === -1)    return true;   // unlimited
  if (typeof val === 'number') return true; // has some access
  if (Array.isArray(val)) return val.length > 0;
  return false;
}

/**
 * Get the numeric limit for a feature
 */
export function getLimit(subscription, feature) {
  const plan = getPlanForUser(subscription);
  return plan.limits[feature];
}

export default PLANS;
