/**
 * Children (Kids) Management Controller
 *
 * Parents manage all their children from here.
 * Number of children allowed is gated by subscription plan.
 */

import getDb   from '../db/database.js';
import { getPlanForUser, getLimit } from '../config/plans.js';

const PHASES = [2,3,4,5,6];
const AVATARS = ['hedgehog','owl','fox','rabbit','deer','bear','penguin','cat'];
const GENDERS = ['boy','girl','neutral'];

function formatChild(c) {
  return {
    id:          c.id,
    name:        c.name,
    phase:       c.phase,
    age:         c.age || null,
    gender:      c.gender || 'neutral',
    avatar:      c.avatar || 'hedgehog',
    acorns:      c.acorns,
    totalAcorns: c.total_acorns,
    wordsRead:   c.words_read,
    streak:      c.streak,
    lastRead:    c.last_read,
    hasPerfect:  Boolean(c.has_perfect),
    createdAt:   c.created_at,
  };
}

function getChildLimit(userId, db) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id=?').get(userId);
  return getLimit(sub, 'children') ?? 1;
}

// ── LIST ALL CHILDREN ─────────────────────────────────────────
export const listChildren = (req, res) => {
  const db       = getDb();
  const children = db.prepare('SELECT * FROM children WHERE user_id=? ORDER BY created_at').all(req.user.userId);
  const limit    = getChildLimit(req.user.userId, db);
  res.json({ success: true, data: { children: children.map(formatChild), limit, canAdd: children.length < limit } });
};

// ── ADD CHILD ─────────────────────────────────────────────────
export const addChild = (req, res) => {
  const db      = getDb();
  const userId  = req.user.userId;
  const { name, phase = 2, age, gender = 'neutral', avatar = 'hedgehog' } = req.body;

  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Child name is required' });
  if (!PHASES.includes(parseInt(phase))) return res.status(400).json({ success: false, message: 'Phase must be 2–6' });

  // Check plan limit
  const limit    = getChildLimit(userId, db);
  const existing = db.prepare('SELECT COUNT(*) as n FROM children WHERE user_id=?').get(userId).n;
  if (existing >= limit) {
    return res.status(403).json({
      success: false,
      limitReached: true,
      message: `Your plan allows up to ${limit} child profile${limit>1?'s':''}. Upgrade to add more.`,
    });
  }

  const child = db.prepare(`
    INSERT INTO children (user_id, name, phase, age, gender, avatar, acorns, total_acorns)
    VALUES (?,?,?,?,?,?,60,60) RETURNING *
  `).get(userId, name.trim(), parseInt(phase), age ? parseInt(age) : null, gender, avatar);

  res.status(201).json({ success: true, data: { child: formatChild(child) } });
};

// ── UPDATE CHILD ──────────────────────────────────────────────
export const updateChild = (req, res) => {
  const db     = getDb();
  const userId = req.user.userId;
  const { childId } = req.params;

  // Verify ownership
  const existing = db.prepare('SELECT * FROM children WHERE id=? AND user_id=?').get(childId, userId);
  if (!existing) return res.status(404).json({ success: false, message: 'Child not found' });

  const { name, phase, age, gender, avatar } = req.body;
  const sets = [], vals = [];

  if (name   !== undefined) { sets.push('name=?');   vals.push(name.trim()); }
  if (phase  !== undefined) { sets.push('phase=?');  vals.push(parseInt(phase)); }
  if (age    !== undefined) { sets.push('age=?');    vals.push(age ? parseInt(age) : null); }
  if (gender !== undefined && GENDERS.includes(gender)) { sets.push('gender=?'); vals.push(gender); }
  if (avatar !== undefined && AVATARS.includes(avatar)) { sets.push('avatar=?'); vals.push(avatar); }

  if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

  sets.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(childId);

  const updated = db.prepare(`UPDATE children SET ${sets.join(',')} WHERE id=? RETURNING *`).get(...vals);
  res.json({ success: true, data: { child: formatChild(updated) } });
};

// ── DELETE CHILD ──────────────────────────────────────────────
export const deleteChild = (req, res) => {
  const db     = getDb();
  const userId = req.user.userId;
  const { childId } = req.params;

  const child = db.prepare('SELECT * FROM children WHERE id=? AND user_id=?').get(childId, userId);
  if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

  // Prevent deleting the last child (user would be locked out)
  const count = db.prepare('SELECT COUNT(*) as n FROM children WHERE user_id=?').get(userId).n;
  if (count <= 1) {
    return res.status(400).json({ success: false, message: 'Cannot delete the only child profile. Add another first, then delete this one.' });
  }

  db.prepare('DELETE FROM children WHERE id=?').run(childId);
  res.json({ success: true });
};
