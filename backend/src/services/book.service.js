/**
 * @file        book.service.js
 * @description Story book generation — AI images via Pollinations.ai,
 *              PDF via PDFKit (falls back to HTML if pdfkit not installed).
 *              Every step logged to DB for admin debugging.
 * @module      Book Service
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { getDb }                     from '../db/database.js';
import { r2Put, r2Url, r2Available } from './r2.service.js';

// ── IMAGE GENERATION STRATEGIES ──────────────────────────────
// Pollinations.ai changed their API. We try 3 endpoints with proper headers,
// then fall back to a beautiful SVG illustration we generate ourselves.

// ── IMAGE PROVIDER CONFIGURATION ───────────────────────────
// Priority order (first with a key wins, Picsum always available as fallback):
//
//   1. Pollinations.ai  — FASTEST ~5s. Free key at: pollinations.ai → Settings → API Key
//                         Add POLLINATIONS_TOKEN to Render env.
//
//   2. HuggingFace AI   — BEST QUALITY ~15-30s. Free key at: huggingface.co/settings/tokens
//                         Add HUGGINGFACE_TOKEN to Render env.
//
//   3. Picsum Photos    — ALWAYS FREE, no key. Real photography, seeded by story ID.
//
//   4. SVG Illustration — LOCAL fallback, no external calls needed.
//
// RECOMMENDATION: Add POLLINATIONS_TOKEN first (fastest), HUGGINGFACE_TOKEN for best quality.
const HF_TOKEN   = (process.env.HUGGINGFACE_TOKEN   || '').trim();
const POLL_TOKEN = (process.env.POLLINATIONS_TOKEN   || '').trim();

// HuggingFace models — free tier, ~10-30s per image
// Primary: flux-schnell (fast, good quality), fallback: sd-xl-turbo
// Models confirmed working on router.huggingface.co/hf-inference/models/
// FLUX.1-schnell is fast free tier; SD v2.1 is reliable fallback
const HF_MODELS = [
  'black-forest-labs/FLUX.1-schnell',          // fast, excellent quality
  'stabilityai/stable-diffusion-2-1',           // reliable SD v2.1
  'stabilityai/stable-diffusion-xl-base-1.0',  // SDXL base
];

// Unsplash themed search terms for children's book topics
function unsplashUrl(prompt, seed) {
  const themes = ['nature','animals','adventure','sky','forest','ocean','farm','space','fairy','garden'];
  const words  = prompt.toLowerCase().split(/\s+/);
  const match  = themes.find(t => words.includes(t)) || 'nature';
  // Use picsum for a stable seeded photo — always free, no key
  return `https://picsum.photos/seed/${seed}/800/600`;
}

// ── STEP LOGGER ───────────────────────────────────────────────
function makeLogger(db, bookId) {
  const steps = [];
  const log = (step, status, detail = '') => {
    const entry = { step, status, detail, ts: new Date().toISOString() };
    steps.push(entry);
    const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌';
    console.log(`[Book:${bookId.slice(0,8)}] ${icon} ${step}: ${detail}`);
    try {
      db.prepare(`UPDATE story_books SET generation_log=?, generation_progress=? WHERE id=?`)
        .run(JSON.stringify(steps), step, bookId);
    } catch {}
  };
  return { log, steps };
}

// ── IMAGE HELPERS ─────────────────────────────────────────────
function safeSeed(bookId, offset) {
  const hex = bookId.replace(/[^0-9a-fA-F]/g, '').slice(0, 8) || 'a1b2c3d4';
  return (parseInt(hex, 16) + offset) % 2147483647;
}

function buildImagePrompt(text, childName) {
  const clean = (text || '').replace(/['"]/g, '').replace(/[^a-zA-Z0-9 .,]/g, '').trim().slice(0, 120);
  // IMPORTANT: be very explicit about illustration style — NOT a photo
  return [
    'digital cartoon illustration, children picture book style,',
    'thick outlines, flat bold colours, friendly cute characters,',
    'soft warm lighting, storybook art, 2D animated style,',
    'NO PHOTO NO REALISTIC NO TEXT NO WORDS,',
    clean + ',',
    'cute child character named ' + childName + ',',
    'kawaii pastel palette, professional children book art',
  ].join(' ');
}

// ── FETCH IMAGE — MULTI-PROVIDER CASCADE ─────────────────────
async function fetchImageWithFallback(prompt, seed, label, logger) {
  const L = (step, status, detail) => {
    console[status === 'ok' ? 'log' : 'warn'](`[Book] ${label} ${step}: ${detail}`);
    logger?.log?.(`img_${label}_${step}`, status, detail);
  };

  // ── Provider 1: HuggingFace Inference API (free, requires HF_TOKEN) ──
  if (HF_TOKEN) {
    for (const model of HF_MODELS) {
      try {
        L(`hf_${model.split('/')[1]}`, 'ok', `Trying ${model}`);
        // New HuggingFace Inference API (api-inference.huggingface.co deprecated as of 2025)
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ inputs: prompt.slice(0, 500) }),
          signal:  AbortSignal.timeout(60000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // 503 = model loading — try next model
          L(`hf_err`, 'warn', `HTTP ${res.status} ${model.split('/')[1]}: ${body.slice(0,80)}`);
          continue;
        }
        const ct  = res.headers.get('content-type') || '';
        const buf = Buffer.from(await res.arrayBuffer());
        if (!ct.includes('image') || buf.length < 5000) {
          L(`hf_skip`, 'warn', `bad response: ${ct} ${buf.length}b`);
          continue;
        }
        L(`hf_ok`, 'ok', `${model.split('/')[1]}: ${(buf.length/1024).toFixed(0)}KB`);
        return { buf, source: `huggingface_${model.split('/')[1]}` };
      } catch (e) {
        L(`hf_err`, 'warn', `${model.split('/')[1]}: ${e.message.slice(0,80)}`);
      }
    }
    L('hf_failed', 'warn', 'All HuggingFace models failed — trying next provider');
  } else {
    L('hf_skip', 'warn', 'HUGGINGFACE_TOKEN not set — add it in Render env for AI images');
  }

  // ── Provider 2: Pollinations.ai (free key at pollinations.ai/settings) ──
  if (POLL_TOKEN) {
    // Try both auth methods — Pollinations accepts Bearer header OR ?token= param
    const pollAttempts = [
      {
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0,200))}` +
             `?width=800&height=600&seed=${seed}&nologo=true&nofeed=true`,
        headers: { 'Authorization': `Bearer ${POLL_TOKEN}`, 'User-Agent': 'Mozilla/5.0' },
        label: 'bearer',
      },
      {
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0,200))}` +
             `?width=800&height=600&seed=${seed}&nologo=true&key=${POLL_TOKEN}`,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        label: 'query-token',
      },
    ];

    for (const attempt of pollAttempts) {
      try {
        L(`poll_${attempt.label}`, 'ok', attempt.url.slice(0, 80));
        const res = await fetch(attempt.url, {
          headers: attempt.headers,
          signal:  AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          L(`poll_${attempt.label}_err`, 'warn', `HTTP ${res.status}: ${body.slice(0,80)}`);
          continue;
        }
        const ct  = res.headers.get('content-type') || '';
        const buf = Buffer.from(await res.arrayBuffer());
        if (ct.includes('image') && buf.length > 5000) {
          L('poll_ok', 'ok', `[${attempt.label}] ${(buf.length/1024).toFixed(0)}KB`);
          return { buf, source: `pollinations_${attempt.label}` };
        }
        L(`poll_${attempt.label}_skip`, 'warn', `bad response: ${ct} ${buf.length}b`);
      } catch (e) {
        L(`poll_${attempt.label}_err`, 'warn', e.message.slice(0,80));
      }
    }
    L('poll_failed', 'warn', 'Both Pollinations auth methods failed — trying next provider');
  } else {
    L('poll_skip', 'warn', 'POLLINATIONS_TOKEN not set — add free key from pollinations.ai');
  }

  // ── Provider 3: Picsum Photos (free, no key, real photography) ──
  try {
    const url = `https://picsum.photos/seed/${seed}/800/600`;
    L('picsum', 'ok', `Trying ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const ct  = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (ct.includes('image') && buf.length > 5000) {
        L('picsum_ok', 'ok', `${(buf.length/1024).toFixed(0)}KB photo`);
        return { buf, source: 'picsum' };
      }
    }
  } catch (e) { L('picsum_err', 'warn', e.message.slice(0,80)); }

  // ── Provider 4: SVG fallback (always works, local generation) ──
  L('svg_fallback', 'warn', 'All image providers failed — using SVG illustration');
  const svgBuf = buildSvgPage(prompt, seed, detectTheme(prompt));
  return { buf: svgBuf, source: 'svg_fallback' };
}

// ── SVG PAGE ILLUSTRATION FALLBACK ─────────────────────────
// Theme-aware cartoon SVG illustrations — far better than generic shapes.
// Each theme has its own scene, palette, and character silhouettes.
const THEME_SCENES = {
  space:    { sky:'#0B0C2A', mid:'#1A1B4B', ground:'#2D1B69', stars:true,  char:'rocket',  accent:'#F59E0B', acc2:'#7C3AED' },
  adventure:{ sky:'#87CEEB', mid:'#228B22', ground:'#8B6914', stars:false, char:'explorer', accent:'#F97316', acc2:'#10B981' },
  animals:  { sky:'#FDE68A', mid:'#86EFAC', ground:'#6EE7B7', stars:false, char:'cat',      accent:'#F472B6', acc2:'#FBBF24' },
  forest:   { sky:'#D1FAE5', mid:'#16A34A', ground:'#92400E', stars:false, char:'owl',      accent:'#F59E0B', acc2:'#7C3AED' },
  ocean:    { sky:'#BAE6FD', mid:'#0EA5E9', ground:'#1E3A5F', stars:false, char:'fish',     accent:'#34D399', acc2:'#F59E0B' },
  dragons:  { sky:'#1C1917', mid:'#7C2D12', ground:'#292524', stars:true,  char:'dragon',   accent:'#F97316', acc2:'#EF4444' },
  magic:    { sky:'#4C1D95', mid:'#7C3AED', ground:'#2E1065', stars:true,  char:'wizard',   accent:'#F59E0B', acc2:'#EC4899' },
  farm:     { sky:'#FEF3C7', mid:'#84CC16', ground:'#A16207', stars:false, char:'cow',      accent:'#EF4444', acc2:'#F97316' },
  default:  { sky:'#E0F2FE', mid:'#7C3AED', ground:'#4C1D95', stars:false, char:'star',     accent:'#FBBF24', acc2:'#EC4899' },
};

// Detect story theme from prompt text
function detectTheme(text) {
  const t = (text||'').toLowerCase();
  if (/space|star|planet|rocket|moon|alien/.test(t))  return 'space';
  if (/dragon|fire|castle|knight/.test(t))            return 'dragons';
  if (/magic|wizard|wand|spell|enchant/.test(t))      return 'magic';
  if (/ocean|sea|fish|wave|underwater/.test(t))       return 'ocean';
  if (/forest|tree|wood|mushroom|owl/.test(t))        return 'forest';
  if (/farm|cow|horse|barn|chicken/.test(t))          return 'farm';
  if (/animal|cat|dog|lion|tiger|bear/.test(t))       return 'animals';
  if (/adventure|quest|journey|explore/.test(t))      return 'adventure';
  return 'default';
}

// Character SVG snippets — cartoon silhouettes
function charSvg(char, cx, cy, color, size) {
  const s = size || 1;
  switch(char) {
    case 'rocket': return `
      <ellipse cx="${cx}" cy="${cy+20*s}" rx="${22*s}" ry="${50*s}" fill="${color}"/>
      <polygon points="${cx},${cy-40*s} ${cx-20*s},${cy+20*s} ${cx+20*s},${cy+20*s}" fill="#EF4444"/>
      <polygon points="${cx-22*s},${cy+30*s} ${cx-38*s},${cy+55*s} ${cx-10*s},${cy+40*s}" fill="#F97316"/>
      <polygon points="${cx+22*s},${cy+30*s} ${cx+38*s},${cy+55*s} ${cx+10*s},${cy+40*s}" fill="#F97316"/>
      <circle  cx="${cx}" cy="${cy}" r="${13*s}" fill="#BAE6FD" opacity="0.9"/>
      <circle  cx="${cx}" cy="${cy+15*s}" r="${7*s}" fill="#FBBF24"/>
      <ellipse cx="${cx}" cy="${cy+60*s}" rx="${32*s}" ry="${8*s}" fill="#F97316" opacity="0.6"/>`;
    case 'cat': return `
      <ellipse cx="${cx}" cy="${cy+10*s}" rx="${30*s}" ry="${35*s}" fill="${color}"/>
      <circle  cx="${cx}" cy="${cy-18*s}" r="${22*s}" fill="${color}"/>
      <polygon points="${cx-16*s},${cy-36*s} ${cx-24*s},${cy-54*s} ${cx-8*s},${cy-36*s}" fill="${color}"/>
      <polygon points="${cx+16*s},${cy-36*s} ${cx+24*s},${cy-54*s} ${cx+8*s},${cy-36*s}" fill="${color}"/>
      <circle  cx="${cx-8*s}" cy="${cy-20*s}" r="${4*s}" fill="#1F2937"/>
      <circle  cx="${cx+8*s}" cy="${cy-20*s}" r="${4*s}" fill="#1F2937"/>
      <ellipse cx="${cx}" cy="${cy-12*s}" rx="${5*s}" ry="${3*s}" fill="#F9A8D4"/>
      <path d="M ${cx-4*s} ${cy-8*s} Q ${cx} ${cy-2*s} ${cx+4*s} ${cy-8*s}" stroke="#1F2937" stroke-width="${1.5*s}" fill="none"/>`;
    case 'star': return `
      <polygon points="${cx},${cy-50*s} ${cx+12*s},${cy-18*s} ${cx+47*s},${cy-15*s} ${cx+20*s},${cy+10*s} ${cx+29*s},${cy+45*s} ${cx},${cy+25*s} ${cx-29*s},${cy+45*s} ${cx-20*s},${cy+10*s} ${cx-47*s},${cy-15*s} ${cx-12*s},${cy-18*s}" fill="${color}" opacity="0.95"/>
      <circle cx="${cx}" cy="${cy}" r="${14*s}" fill="white" opacity="0.8"/>`;
    case 'owl': return `
      <ellipse cx="${cx}" cy="${cy+15*s}" rx="${28*s}" ry="${38*s}" fill="${color}"/>
      <circle  cx="${cx}" cy="${cy-5*s}" r="${24*s}" fill="${color}"/>
      <circle  cx="${cx-9*s}" cy="${cy-8*s}" r="${11*s}" fill="white"/>
      <circle  cx="${cx+9*s}" cy="${cy-8*s}" r="${11*s}" fill="white"/>
      <circle  cx="${cx-9*s}" cy="${cy-8*s}" r="${6*s}" fill="#1F2937"/>
      <circle  cx="${cx+9*s}" cy="${cy-8*s}" r="${6*s}" fill="#1F2937"/>
      <polygon points="${cx-3*s},${cy-2*s} ${cx+3*s},${cy-2*s} ${cx},${cy+4*s}" fill="#F97316"/>
      <polygon points="${cx-26*s},${cy-30*s} ${cx-18*s},${cy-48*s} ${cx-10*s},${cy-30*s}" fill="${color}"/>
      <polygon points="${cx+26*s},${cy-30*s} ${cx+18*s},${cy-48*s} ${cx+10*s},${cy-30*s}" fill="${color}"/>`;
    case 'dragon': return `
      <ellipse cx="${cx}" cy="${cy+20*s}" rx="${40*s}" ry="${30*s}" fill="${color}"/>
      <circle  cx="${cx-10*s}" cy="${cy-10*s}" r="${24*s}" fill="${color}"/>
      <polygon points="${cx-18*s},${cy-30*s} ${cx-26*s},${cy-52*s} ${cx-6*s},${cy-30*s}" fill="#EF4444"/>
      <polygon points="${cx+2*s},${cy-30*s} ${cx+10*s},${cy-52*s} ${cx+20*s},${cy-30*s}" fill="#EF4444"/>
      <circle  cx="${cx-18*s}" cy="${cy-12*s}" r="${5*s}" fill="#FBBF24"/>
      <circle  cx="${cx}" cy="${cy-12*s}" r="${5*s}" fill="#FBBF24"/>
      <polygon points="${cx+40*s},${cy+10*s} ${cx+75*s},${cy-15*s} ${cx+50*s},${cy+25*s}" fill="${color}"/>
      <path d="M ${cx-5*s} ${cy-5*s} Q ${cx+5*s} ${cy+5*s} ${cx+18*s} ${cy}" stroke="#EF4444" stroke-width="${2*s}" fill="none"/>`;
    default: return `
      <circle  cx="${cx}" cy="${cy-28*s}" r="${22*s}" fill="${color}"/>
      <rect    x="${cx-18*s}" y="${cy-6*s}" width="${36*s}" height="${48*s}" rx="${8*s}" fill="${color}"/>
      <rect    x="${cx-30*s}" y="${cy-2*s}" width="${14*s}" height="${35*s}" rx="${7*s}" fill="${color}"/>
      <rect    x="${cx+16*s}" y="${cy-2*s}" width="${14*s}" height="${35*s}" rx="${7*s}" fill="${color}"/>
      <rect    x="${cx-18*s}" y="${cy+40*s}" width="${14*s}" height="${36*s}" rx="${7*s}" fill="${color}"/>
      <rect    x="${cx+4*s}"  y="${cy+40*s}" width="${14*s}" height="${36*s}" rx="${7*s}" fill="${color}"/>`;
  }
}

function buildSvgPage(text, seed, theme) {
  const n   = typeof seed === 'number' ? Math.abs(seed) : 42;
  const sc  = THEME_SCENES[theme] || THEME_SCENES[detectTheme(text)] || THEME_SCENES.default;
  const acc = sc.accent, acc2 = sc.acc2;

  // Stars for space/magic/dragons themes
  const starsSvg = sc.stars ? [...Array(22)].map((_, i) => {
    const sx = 20 + ((n * (i+1) * 73) % 760);
    const sy = 10 + ((n * (i+1) * 37) % 320);
    const sr = 1 + (i % 3);
    const op = 0.4 + (i % 5) * 0.12;
    return `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="white" opacity="${op.toFixed(2)}"/>`;
  }).join('') : '';

  // Trees for forest/adventure
  const treesSvg = ['forest','adventure','farm'].includes(theme) ? `
    <polygon points="80,350 110,250 140,350" fill="#16A34A" opacity="0.7"/>
    <rect x="103" y="350" width="14" height="40" fill="#92400E" opacity="0.7"/>
    <polygon points="660,340 700,220 740,340" fill="#15803D" opacity="0.6"/>
    <rect x="693" y="340" width="14" height="50" fill="#92400E" opacity="0.6"/>
  ` : '';

  // Waves for ocean theme
  const wavesSvg = theme === 'ocean' ? `
    <path d="M 0 460 Q 100 420 200 460 Q 300 500 400 460 Q 500 420 600 460 Q 700 500 800 460 L 800 600 L 0 600 Z" fill="#0EA5E9" opacity="0.6"/>
    <path d="M 0 490 Q 120 455 240 490 Q 360 525 480 490 Q 600 455 720 490 L 800 490 L 800 600 L 0 600 Z" fill="#0284C7" opacity="0.7"/>
    <circle cx="150" cy="430" r="25" fill="#F59E0B" opacity="0.6"/>
    <circle cx="650" cy="440" r="18" fill="#F59E0B" opacity="0.5"/>
  ` : '';

  // Ground
  const groundY = 420;
  // Character position
  const charX = 220 + (n % 80), charY = 360;
  const charColor = acc;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sc.sky}"/>
      <stop offset="100%" stop-color="${sc.mid}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${acc2}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${sc.sky}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Sky gradient -->
  <rect width="800" height="600" fill="url(#sky)"/>
  <rect width="800" height="600" fill="url(#glow)"/>

  ${starsSvg}
  ${treesSvg}
  ${wavesSvg}

  <!-- Clouds (not for space/dragons) -->
  ${!sc.stars ? `
  <ellipse cx="160" cy="90"  rx="70" ry="28" fill="white" opacity="0.55"/>
  <ellipse cx="120" cy="85"  rx="45" ry="22" fill="white" opacity="0.55"/>
  <ellipse cx="200" cy="85"  rx="45" ry="22" fill="white" opacity="0.55"/>
  <ellipse cx="580" cy="110" rx="60" ry="25" fill="white" opacity="0.45"/>
  <ellipse cx="540" cy="106" rx="38" ry="20" fill="white" opacity="0.45"/>
  <ellipse cx="618" cy="106" rx="38" ry="20" fill="white" opacity="0.45"/>
  ` : ''}

  <!-- Ground / floor -->
  <rect x="0" y="${groundY}" width="800" height="${600-groundY}" fill="${sc.ground}" opacity="0.75" rx="0"/>
  <ellipse cx="400" cy="${groundY}" rx="400" ry="24" fill="${sc.ground}" opacity="0.5"/>

  <!-- Main character -->
  ${charSvg(sc.char, charX, charY, charColor, 1.1)}

  <!-- Decorative sparkles -->
  <circle cx="${350+(n%120)}" cy="${180+(n%80)}" r="5" fill="${acc}" opacity="0.8"/>
  <circle cx="${500+(n%100)}" cy="${220+(n%60)}" r="4" fill="${acc2}" opacity="0.7"/>
  <circle cx="${150+(n%60)}"  cy="${300+(n%50)}" r="3" fill="white"  opacity="0.6"/>

  <!-- Story text on illustrated panel -->
  <rect x="50" y="468" width="700" height="112" rx="18" fill="white" opacity="0.92"/>
  <rect x="50" y="468" width="700" height="112" rx="18" fill="none" stroke="${acc}" stroke-width="2" opacity="0.5"/>
</svg>`, 'utf8');
}

// ── PDF GENERATION ────────────────────────────────────────────
async function generatePdf(story, childName, pageImages, logger, bookUrl) {
  try {
    const { default: PDFDocument } = await import('pdfkit');
    logger.log('pdf_engine', 'ok', 'PDFKit available');
    return await buildPdf(PDFDocument, story, childName, pageImages, bookUrl);
  } catch (e) {
    logger.log('pdf_engine', 'warn', `PDFKit not available (${e.message}) — using HTML fallback`);
    return buildHtml(story, childName, pageImages);
  }
}

// ── PHONICS WORD ANALYSER (server-side for PDF) ──────────────
// Simplified version of the frontend phonicsAnalyser.
// Splits words into grapheme chunks with phase-appropriate colours.
const DIGRAPHS     = ['ch','sh','th','wh','ph','ng','ai','ea','ee','oa','oo','ou','ow','oi','oy','ar','or','er','ir','ur','au','aw','ew','ue'];
const SPLIT_DIGR   = [['a','e'],['i','e'],['o','e'],['u','e'],['e','e']];
const PHASE_COLORS = {
  vowel:   { fill:'#FEF3C7', stroke:'#F59E0B', text:'#92400E' },
  digraph: { fill:'#E0F2FE', stroke:'#0EA5E9', text:'#0C4A6E' },
  split:   { fill:'#FCE7F3', stroke:'#EC4899', text:'#831843' },
  cons:    { fill:'#F5F3FF', stroke:'#7C3AED', text:'#4C1D95' },
};
const VOWELS = new Set(['a','e','i','o','u']);

function phoneticiseWord(word) {
  const clean = word.replace(/[^a-z]/gi,'').toLowerCase();
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    // Try digraph
    const di = DIGRAPHS.find(d => clean.slice(i, i+d.length) === d);
    if (di) { chunks.push({ g: di, type:'digraph' }); i += di.length; continue; }
    // Single letter
    const ch = clean[i];
    const type = VOWELS.has(ch) ? 'vowel' : 'cons';
    chunks.push({ g: ch, type }); i++;
  }
  // Detect split digraphs (e.g. cake = c + a_e + k)
  for (let j = 0; j < chunks.length-2; j++) {
    const v = chunks[j].g, mid = chunks.slice(j+1, chunks.length-1), fin = chunks[chunks.length-1].g;
    if (SPLIT_DIGR.some(([a,e]) => v===a && fin===e) && mid.length >= 1 && mid.every(m => !VOWELS.has(m.g))) {
      chunks[j].type       = 'split';
      chunks[chunks.length-1].type = 'split';
      chunks[j].splitPair  = true;
    }
  }
  return chunks;
}

// ── COMPREHENSIVE PHONEME PRONUNCIATION MAP ──────────────────
// Covers every grapheme a child encounters in Phases 2-6.
// Format: grapheme → [pronunciation label, example word hint]
const PHONEME_GUIDE = {
  // ── Consonants ─────────────────────────────────────────────
  's': ['s', 'sun'],   'a': ['a', 'cat'],   't': ['t', 'tap'],
  'p': ['p', 'pin'],   'i': ['i', 'sit'],   'n': ['n', 'net'],
  'm': ['m', 'map'],   'd': ['d', 'dog'],   'g': ['g', 'got'],
  'o': ['o', 'hot'],   'c': ['k', 'cat'],   'k': ['k', 'kit'],
  'e': ['e', 'bed'],   'u': ['u', 'cup'],   'r': ['r', 'red'],
  'h': ['h', 'hat'],   'b': ['b', 'big'],   'f': ['f', 'fan'],
  'l': ['l', 'lip'],   'j': ['j', 'jam'],   'v': ['v', 'van'],
  'w': ['w', 'wet'],   'x': ['ks', 'fox'],  'y': ['y', 'yes'],
  'z': ['z', 'zip'],   'q': ['kw', 'quiz'],
  // ── Phase 2 doubles ────────────────────────────────────────
  'ff': ['f', 'off'],  'll': ['l', 'ball'], 'ss': ['s', 'hiss'],
  'zz': ['z', 'buzz'], 'ck': ['k', 'duck'],
  // ── Phase 3 digraphs ───────────────────────────────────────
  'ch': ['ch', 'chip'], 'sh': ['sh', 'ship'], 'th': ['th', 'the'],
  'ng': ['ng', 'ring'], 'wh': ['w', 'when'],  'ph': ['f', 'phone'],
  // ── Phase 3 vowel digraphs ─────────────────────────────────
  'ai': ['ay', 'rain'], 'ee': ['ee', 'feet'], 'igh': ['ie', 'night'],
  'oa': ['oh', 'boat'], 'oo': ['oo', 'moon'], 'ar': ['ar', 'car'],
  'or': ['or', 'fork'], 'ur': ['er', 'turn'], 'ow': ['ow', 'cow'],
  'oi': ['oy', 'coin'], 'ear': ['eer', 'hear'],'air': ['air', 'fair'],
  'ure': ['yoor', 'pure'],'er': ['er', 'her'], 'ea': ['ee', 'eat'],
  'ou': ['ow', 'out'],
  // ── Phase 4 blends ─────────────────────────────────────────
  'bl': ['bl', 'blue'], 'br': ['br', 'bring'], 'cl': ['kl', 'clap'],
  'cr': ['kr', 'crab'], 'dr': ['dr', 'drop'],  'fl': ['fl', 'flag'],
  'fr': ['fr', 'frog'], 'gl': ['gl', 'glad'],  'gr': ['gr', 'grab'],
  'pl': ['pl', 'play'], 'pr': ['pr', 'pram'],  'sl': ['sl', 'slip'],
  'sm': ['sm', 'smile'],'sn': ['sn', 'snap'],  'sp': ['sp', 'spin'],
  'st': ['st', 'step'], 'sw': ['sw', 'swim'],  'tr': ['tr', 'trip'],
  'tw': ['tw', 'twin'], 'sk': ['sk', 'skip'],  'scr':['skr','scrap'],
  'str':['str','strap'],'spr':['spr','spring'],
  // ── Phase 5 alternatives ───────────────────────────────────
  'ay': ['ay', 'play'], 'ey': ['ay', 'they'],  'ie': ['ie', 'pie'],
  'ue': ['yoo', 'blue'],'ew': ['yoo', 'new'],  'oe': ['oh', 'toe'],
  'au': ['aw', 'haul'], 'aw': ['aw', 'saw'],   'aigh':['ay','straight'],
  'eigh':['ay','eight'],'ey2':['ee','key'],
  // ── Phase 6 morphemes (shown without slashes) ──────────────
  'tion': ['shun','nation'],'sion':['zhun','vision'],'ture':['cher','nature'],
  'ous': ['us','famous'], 'ful':['ful','hopeful'], 'less':['les','careless'],
  'ness':['nes','sadness'],'ment':['ment','moment'],'ly':['lee','quickly'],
};

// Get the pronunciation label for a grapheme
function getPhonemeLabel(grapheme) {
  const g = grapheme.toLowerCase();
  const entry = PHONEME_GUIDE[g];
  if (!entry) return g;        // fallback: show the letter itself
  return entry[0];             // return the pronunciation string
}

// Get example word for tooltip/sub-label
function getExampleWord(grapheme) {
  const entry = PHONEME_GUIDE[grapheme.toLowerCase()];
  return entry ? entry[1] : '';
}

// Draw a phonics word as tiles in the PDF — pronunciation below every grapheme
// ── LETTER-LEVEL IPA MAP ──────────────────────────────────────
// Maps every letter/digraph to its IPA phoneme symbol for the footer strip.
// Uses UK English (British RP) phonemes.
const LETTER_IPA = {
  // ── Consonants ──────────────────────────────────────────────────
  'b':'/b/','c':'/k/','d':'/d/','f':'/f/','g':'/ɡ/','h':'/h/',
  'j':'/dʒ/','k':'/k/','l':'/l/','m':'/m/','n':'/n/','p':'/p/',
  'q':'/k/','r':'/r/','s':'/s/','t':'/t/','v':'/v/','w':'/w/',
  'x':'/ks/','y':'/j/','z':'/z/',
  // ── Short vowels ────────────────────────────────────────────────
  'a':'/æ/','e':'/ɛ/','i':'/ɪ/','o':'/ɒ/','u':'/ʌ/',
  // ── Digraphs (Phase 3) ──────────────────────────────────────────
  'ch':'/tʃ/','sh':'/ʃ/','th':'/ð/','ng':'/ŋ/','wh':'/w/','ph':'/f/',
  'ck':'/k/','ff':'/f/','ll':'/l/','ss':'/s/','zz':'/z/',
  // ── Vowel digraphs ──────────────────────────────────────────────
  'ai':'/eɪ/','ay':'/eɪ/','ee':'/iː/','ea':'/iː/','igh':'/aɪ/','ie':'/aɪ/',
  'oa':'/əʊ/','ow':'/əʊ/','oe':'/əʊ/','oo':'/uː/','ue':'/juː/','ew':'/juː/',
  'ar':'/ɑː/','or':'/ɔː/','ur':'/ɜː/','er':'/ɜː/','ir':'/ɜː/',
  'oi':'/ɔɪ/','oy':'/ɔɪ/','ou':'/aʊ/','au':'/ɔː/','aw':'/ɔː/',
  'ear':'/ɪə/','air':'/ɛː/','ure':'/jʊə/','ew':'/juː/',
  // ── Blends — show component phonemes ────────────────────────────
  'bl':'/bl/','br':'/br/','cl':'/kl/','cr':'/kr/','dr':'/dr/',
  'fl':'/fl/','fr':'/fr/','gl':'/ɡl/','gr':'/ɡr/','pl':'/pl/',
  'pr':'/pr/','sl':'/sl/','sm':'/sm/','sn':'/sn/','sp':'/sp/',
  'st':'/st/','sw':'/sw/','tr':'/tr/','tw':'/tw/','sk':'/sk/',
  'scr':'/skr/','str':'/str/','spr':'/spr/',
  // ── Morphemes ────────────────────────────────────────────────────
  'tion':'/ʃən/','sion':'/ʒən/','ture':'/tʃə/','ous':'/əs/',
  'ful':'/fʊl/','less':'/lɪs/','ness':'/nɪs/','ment':'/mənt/','ly':'/li/',
};

// Build letter-level IPA string for a whole sentence
// e.g. "the fat" → "/t//h//ɛ//f//æ//t/"
function buildIpaStrip(text) {
  const phonemes = [];
  const words = (text||'').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);

  for (const word of words) {
    if (!word) continue;
    let i = 0;
    while (i < word.length) {
      // Try longest match first (3-letter digraph, then 2, then 1)
      let matched = false;
      for (const len of [3, 2, 1]) {
        const sub = word.slice(i, i + len);
        if (LETTER_IPA[sub]) {
          phonemes.push(LETTER_IPA[sub]);
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) { phonemes.push('/' + word[i] + '/'); i++; }
    }
    phonemes.push(' ');  // word break
  }
  return phonemes.filter(p => p !== ' ' || phonemes[phonemes.indexOf(p)-1] !== ' ').join('');
}

// Draw the IPA phoneme strip as a footer row
// Each phoneme is a small pill: /t/ /h/ /ɛ/ /f/ /æ/ /t/ ...
function drawIpaStrip(doc, text, x, y, maxWidth) {
  const ipaFull = buildIpaStrip(text);
  // Split into individual /x/ tokens
  const tokens  = ipaFull.match(/\/[^/]+\//g) || [];
  if (tokens.length === 0) return y;

  const pillH  = 18;
  const padX   = 4;
  const padY   = 2;
  const gap    = 2;
  const fs     = 7.5;
  const wordSep = 6; // extra gap at word boundaries

  // Draw strip label
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#94A3B8')
     .text('IPA phonemes:', x, y, { lineBreak:false });
  y += 10;

  const words     = (text||'').toLowerCase().replace(/[^a-z ]/g,'').trim().split(/\s+/);
  const wordTokens = words.map(w => {
    const toks = [];
    let i = 0;
    while (i < w.length) {
      let matched = false;
      for (const len of [3, 2, 1]) {
        const sub = w.slice(i, i + len);
        if (LETTER_IPA[sub]) { toks.push(LETTER_IPA[sub]); i += len; matched = true; break; }
      }
      if (!matched) { toks.push('/' + w[i] + '/'); i++; }
    }
    return toks;
  });

  let cx   = x;
  const COLOURS = ['#7C3AED','#0891B2','#059669','#D97706','#DB2777','#DC2626'];

  wordTokens.forEach((wordToks, wi) => {
    wordToks.forEach((tok, ti) => {
      const tw = doc.widthOfString(tok, { font:'Helvetica', fontSize:fs }) + padX * 2;
      const col = COLOURS[(wi * 7 + ti) % COLOURS.length];

      // Wrap line if needed
      if (cx + tw > x + maxWidth) {
        cx  = x;
        y  += pillH + 4;
      }

      // Pill background
      doc.roundedRect(cx, y, tw, pillH, 3).fill(col + '15');
      doc.roundedRect(cx, y, tw, pillH, 3).stroke(col + '60').lineWidth(0.8);

      // Phoneme text
      doc.font('Helvetica-Bold').fontSize(fs).fillColor(col)
         .text(tok, cx, y + (pillH - fs) / 2, { width:tw, align:'center', lineBreak:false });

      cx += tw + gap;
    });
    cx += wordSep;  // extra gap between words
  });

  return y + pillH + 6;
}

function drawPhonicsTiles(doc, text, x, y, maxWidth, tileH) {
  const words     = (text||'').trim().split(/\s+/);
  const tilePad   = 7;
  const gap       = 5;
  const wordGap   = 14;
  const pronSize  = 8;    // font size for pronunciation label
  const exSize    = 7;    // font size for example word
  // Row height = tile + pronunciation label + example word + spacing
  const lineH = tileH + pronSize + exSize + 10;

  let cx = x, lineY = y;

  words.forEach(word => {
    if (!word) return;
    const punct  = word.match(/([.,!?!]+)$/)?.[1] || '';
    const bare   = word.replace(/[.,!?!]+$/, '');
    const chunks = phoneticiseWord(bare);

    // Measure total word width to decide line-wrap
    const wordW = chunks.reduce((sum, c) => {
      const fs = Math.max(18, Math.min(28, 26 - Math.max(0, c.g.length - 2) * 4));
      return sum + Math.max(32, doc.widthOfString(c.g, { font:'Helvetica-Bold', fontSize:fs }) + tilePad * 2) + gap;
    }, wordGap) + (punct ? 16 : 0);

    if (cx + wordW > x + maxWidth && cx > x) {
      cx = x;
      lineY += lineH + 8;
    }

    chunks.forEach(chunk => {
      const fs      = Math.max(18, Math.min(28, 26 - Math.max(0, chunk.g.length - 2) * 4));
      const label   = chunk.g.toUpperCase();
      const tw      = Math.max(32, doc.widthOfString(label, { font:'Helvetica-Bold', fontSize:fs }) + tilePad * 2);
      const colors  = PHASE_COLORS[chunk.type] || PHASE_COLORS.cons;

      // ── Tile background (rounded rect with colour by type) ──
      doc.roundedRect(cx, lineY, tw, tileH, 7).fill(colors.fill);
      doc.roundedRect(cx, lineY, tw, tileH, 7).stroke(colors.stroke).lineWidth(1.8);

      // ── Grapheme letter(s) — big and bold ──────────────────
      doc.font('Helvetica-Bold').fontSize(fs).fillColor(colors.text)
         .text(label, cx, lineY + (tileH - fs) / 2, { width:tw, align:'center', lineBreak:false });

      // ── Pronunciation label — always shown ──────────────────
      // e.g. "ch" → "ch", "ai" → "ay", "oo" → "oo", "a" → "a"
      const pronLabel  = getPhonemeLabel(chunk.g);
      const exWord     = getExampleWord(chunk.g);

      // Pronunciation box below the tile
      const pronY = lineY + tileH + 2;
      doc.roundedRect(cx, pronY, tw, pronSize + 4, 3).fill(colors.stroke + '25');
      doc.font('Helvetica-Bold').fontSize(pronSize).fillColor(colors.stroke)
         .text(pronLabel, cx, pronY + 2, { width:tw, align:'center', lineBreak:false });

      // Example word (tiny, grey) — helps parent/teacher say it right
      if (exWord) {
        doc.font('Helvetica').fontSize(exSize).fillColor('#9CA3AF')
           .text(exWord, cx, pronY + pronSize + 4, { width:tw, align:'center', lineBreak:false });
      }

      cx += tw + gap;
    });

    // Punctuation
    if (punct) {
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#9CA3AF')
         .text(punct, cx - gap + 2, lineY + (tileH - 22) / 2, { lineBreak:false });
      cx += 12;
    }
    cx += wordGap;
  });

  return lineY + lineH + 4;
}

async function buildPdf(PDFDocument, story, childName, pageImages, bookUrl) {
  // Try to load qrcode — optional, won't fail if not installed
  let qrBuf = null;
  if (bookUrl) {
    try {
      const QRCode = (await import('qrcode')).default;
      qrBuf = await QRCode.toBuffer(bookUrl, {
        type:  'png',
        width: 200,
        margin: 2,
        color: { dark: '#1E1B4B', light: '#FFFFFF' },
      });
    } catch (e) { console.warn('[Book] QR code generation failed:', e.message); }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89;
    const pages = story.pages || [];
    const bgs   = ['#FFFBF5','#F5F9FF','#FFF5FB','#F5FFF8','#FFFEF5','#F8F5FF'];

    // ── COVER ─────────────────────────────────────────────────
    doc.addPage();
    doc.rect(0,0,W,H).fill('#1E1B4B');
    // Gradient overlay
    doc.rect(0,0,W,H/2).fill('#0F0C2E');

    if (pageImages[0]) {
      try {
        const isMimeData = Buffer.isBuffer(pageImages[0]) && pageImages[0].slice(0,5).toString().includes('svg');
        doc.image(pageImages[0], 50, 40, { width: W-100, height: 380, fit:[W-100,380], align:'center', valign:'center' });
      } catch {}
    }

    // Title band
    doc.rect(0, 440, W, 120).fill('#7C3AED');
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#FBBF24')
       .text(story.title || `${childName}'s Story`, 40, 458, { width:W-80, align:'center' });
    doc.fontSize(14).font('Helvetica').fillColor('rgba(255,255,255,0.8)')
       .text(`A personalised phonics story for ${childName}`, 40, 498, { width:W-80, align:'center' });

    // Decorative dots
    [50,100,150,200,250,300,350,400,450,500,550].forEach((dx,i) => {
      doc.circle(dx, H-22, 5).fill(i%2===0?'#7C3AED':'#FBBF24').fillOpacity(0.6);
    });
    doc.rect(0, H-44, W, 44).fill('#0F0C2E');
    doc.fontSize(11).font('Helvetica').fillColor('rgba(255,255,255,0.4)')
       .text('Properly — AI Phonics Tutor  |  properly-web.onrender.com', 0, H-28, { width:W, align:'center' });

    // ── STORY PAGES ────────────────────────────────────────────
    pages.forEach((page, idx) => {
      doc.addPage();
      const bg = bgs[idx % bgs.length];
      doc.rect(0,0,W,H).fill(bg);

      // Decorative corner blobs
      doc.circle(-20, -20, 80).fill('#7C3AED').fillOpacity(0.07);
      doc.circle(W+20, H+20, 80).fill('#7C3AED').fillOpacity(0.07);
      doc.fillOpacity(1);

      // Page number badge
      doc.circle(W-38, 38, 22).fill('#7C3AED');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#fff')
         .text(String(idx+1), W-58, 30, { width:44, align:'center' });

      // Illustration
      const imgBuf = pageImages[idx+1];
      const imgH   = 390, imgY = 18;
      if (imgBuf) {
        try {
          doc.save();
          doc.roundedRect(36, imgY, W-72, imgH, 16).clip();
          doc.image(imgBuf, 36, imgY, { width: W-72, height: imgH, fit:[W-72,imgH], align:'center', valign:'center' });
          doc.restore();
          // Image border
          doc.roundedRect(36, imgY, W-72, imgH, 16).stroke('#DDD6FE').lineWidth(2);
        } catch {}
      } else {
        doc.roundedRect(36, imgY, W-72, imgH, 16).fill('#EDE9FE');
        doc.fontSize(56).text('📖', 0, 160, { width:W, align:'center' });
      }

      // ── PHONICS TILES TEXT AREA ──────────────────────────────
      const tileAreaY = imgY + imgH + 14;
      const tileAreaH = H - tileAreaY - 28;
      doc.roundedRect(36, tileAreaY, W-72, tileAreaH, 14).fill('#fff');
      doc.roundedRect(36, tileAreaY, W-72, tileAreaH, 14).stroke('#DDD6FE').lineWidth(1.5);

      // Draw phonics tiles for each word
      const tileH = 44;
      const afterTilesY = drawPhonicsTiles(doc, page.text||'', 52, tileAreaY + 14, W-104, tileH);

      // ── IPA PHONEME STRIP ──────────────────────────────────────
      // Shows the full sentence as continuous IPA notation:
      // /t//h//ɛ//f//æ//t//k//æ//t//s//æ//t//ɒ//n//t//h//ɛ//m//æ//t/
      const ipaStripY = afterTilesY + 6;
      if (ipaStripY + 32 < H - 28) {
        // Divider line
        doc.moveTo(52, ipaStripY).lineTo(W-52, ipaStripY)
           .stroke('#E0E7FF').lineWidth(0.7);
        drawIpaStrip(doc, page.text||'', 52, ipaStripY + 6, W-104);
      }
    });

    // ── BACK COVER with QR code ─────────────────────────────────
    doc.addPage();
    doc.rect(0,0,W,H).fill('#1E1B4B');
    doc.rect(0,0,W,60).fill('#7C3AED');
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#fff')
       .text('Properly — AI Phonics Tutor', 0, 20, { width:W, align:'center' });

    // Star emoji area
    doc.fontSize(70).text('🌟', 0, H*0.12, { width:W, align:'center' });
    doc.fontSize(30).font('Helvetica-Bold').fillColor('#FBBF24')
       .text(`Well done, ${childName}!`, 0, H*0.31, { width:W, align:'center' });
    doc.fontSize(16).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
       .text('You are a brilliant reader! Keep it up.', 0, H*0.31+46, { width:W, align:'center' });

    // QR Code
    if (qrBuf) {
      const qrSize = 160;
      const qrX = (W - qrSize) / 2;
      const qrY = H * 0.5;
      // White background for QR
      doc.roundedRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 70, 16).fill('#fff');
      try { doc.image(qrBuf, qrX, qrY, { width: qrSize }); } catch {}
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E1B4B')
         .text('Scan to read this story in the app!', qrX - 12, qrY + qrSize + 8, { width: qrSize + 24, align:'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
         .text(bookUrl || 'properly-web.onrender.com', qrX - 12, qrY + qrSize + 28, { width: qrSize + 24, align:'center' });
    }

    doc.fontSize(11).font('Helvetica').fillColor('rgba(255,255,255,0.35)')
       .text(`Created with Properly · Phonics Adventure for ${childName}`, 0, H-36, { width:W, align:'center' });

    doc.end();
  });
}

function buildHtml(story, childName, pageImages) {
  const toDataUrl = b => b ? `data:image/png;base64,${b.toString('base64')}` : null;
  const pages     = story.pages || [];
  const coverDu   = toDataUrl(pageImages[0]);

  const pagesHtml = pages.map((page, i) => {
    const du = toDataUrl(pageImages[i+1]);
    return `<div class="page">
      <div class="pnum">${i+1}</div>
      ${du ? `<img src="${du}" class="pimg">` : `<div class="pph">✨</div>`}
      <div class="ptxt">${page.text||''}</div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${story.title||childName+"'s Story"}</title>
<style>
@media print{.noprint{display:none}@page{margin:0}}
body{font-family:Arial,sans-serif;margin:0;background:#f5f3ff;}
.noprint{background:#7C3AED;color:#fff;padding:10px;text-align:center;position:sticky;top:0;z-index:9;font-weight:700;}
.noprint button{background:#FBBF24;color:#1E1B4B;border:none;border-radius:20px;padding:7px 20px;font-weight:800;cursor:pointer;margin-left:12px;}
.cover{background:linear-gradient(135deg,#1E1B4B,#7C3AED);color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;page-break-after:always;}
.cover img{max-width:90%;max-height:300px;border-radius:12px;margin-bottom:24px;}
.cover h1{font-size:2.2rem;margin:0 0 10px;color:#FBBF24;}
.cover p{color:rgba(255,255,255,0.7);}
.page{background:#fff;min-height:100vh;padding:40px;display:flex;flex-direction:column;align-items:center;page-break-after:always;position:relative;}
.pnum{position:absolute;top:20px;right:24px;background:#7C3AED;color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;}
.pimg{max-width:100%;max-height:50vh;object-fit:contain;border-radius:14px;margin:16px 0;box-shadow:0 8px 28px rgba(124,58,237,0.18);}
.pph{width:100%;height:260px;background:#EDE9FE;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:56px;margin:16px 0;}
.ptxt{font-size:1.4rem;font-weight:700;color:#1E1B4B;text-align:center;line-height:1.6;max-width:600px;background:#F5F3FF;border-radius:12px;padding:18px 24px;border:2px solid #DDD6FE;}
.back{background:#7C3AED;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;}
</style></head><body>
<div class="noprint">📖 "${story.title||childName+"'s Story"}" is ready!
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
</div>
<div class="cover">
  ${coverDu?`<img src="${coverDu}">`:'<div style="font-size:80px">📖</div>'}
  <h1>${story.title||childName+"'s Story"}</h1>
  <p>A personalised phonics story for ${childName}</p>
</div>
${pagesHtml}
<div class="back">
  <div style="font-size:64px">🌟</div>
  <h2 style="font-size:2rem;margin:16px 0">Well done, ${childName}!</h2>
  <p>You are a brilliant reader. Keep it up! 📚</p>
</div>
</body></html>`;
  return Buffer.from(html, 'utf8');
}

// ── MAIN ORCHESTRATOR ─────────────────────────────────────────
export async function generateBook(bookId) {
  const db     = getDb();
  const logger = makeLogger(db, bookId);

  try {
    db.prepare(`UPDATE story_books SET status='generating', generation_log='[]', generation_progress='starting', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(bookId);
    logger.log('start', 'ok', new Date().toISOString());

    const book  = db.prepare('SELECT * FROM story_books WHERE id=?').get(bookId);
    if (!book)  throw new Error('Book record not found in DB');

    const story = db.prepare('SELECT * FROM ai_stories WHERE id=?').get(book.ai_story_id);
    if (!story) throw new Error(`AI story not found: ${book.ai_story_id}`);

    const child = db.prepare('SELECT * FROM children WHERE id=?').get(book.child_id);
    const pages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id=? ORDER BY page_index').all(book.ai_story_id);

    if (pages.length === 0) throw new Error('Story has no pages — cannot generate book');

    logger.log('load_data', 'ok', `"${story.title}" | child: ${child?.name} | ${pages.length} pages`);

    story.pages    = pages;
    const childName = child?.name || 'Reader';
    const imgBufs   = [];

    // ── COVER IMAGE ─────────────────────────────────────────────
    const coverPrompt = `enchanted magical book cover for children, bright pastel colours, friendly, no text, adventure theme, for the story "${story.title || childName + "'s Story"}", kawaii illustration style`;
    logger.log('cover_start', 'ok', 'Generating cover illustration');

    const { buf: coverBuf, source: coverSrc } = await fetchImageWithFallback(
      coverPrompt, safeSeed(bookId, 0), 'cover', logger
    );
    const coverMime = coverSrc === 'svg_fallback' ? 'image/svg+xml' : 'image/png';
    const coverExt  = coverSrc === 'svg_fallback' ? 'svg' : 'png';

    if (r2Available()) {
      try {
        const key = `books/${bookId}/cover.${coverExt}`;
        await r2Put(key, coverBuf, coverMime);
        db.prepare(`UPDATE story_books SET cover_r2_key=? WHERE id=?`).run(key, bookId);
        logger.log('cover_r2', 'ok', `${(coverBuf.length/1024).toFixed(0)}KB → ${key} [${coverSrc}]`);
      } catch (e) { logger.log('cover_r2', 'warn', e.message); }
    } else {
      // Store SVG inline as a data URL if R2 not available
      if (coverSrc === 'svg_fallback') {
        const dataUrl = `data:image/svg+xml;base64,${coverBuf.toString('base64')}`;
        db.prepare(`UPDATE story_books SET cover_r2_key=? WHERE id=?`).run(dataUrl, bookId);
      }
      logger.log('cover_r2', 'warn', 'R2 not configured — image stored inline');
    }
    imgBufs.push(coverBuf);

    // ── STORY PAGE IMAGES ────────────────────────────────────────
    for (let i = 0; i < pages.length; i++) {
      const page   = pages[i];
      const seed   = safeSeed(bookId, i + 1);
      const prompt = buildImagePrompt(page.text, childName);

      logger.log(`p${i+1}_start`, 'ok', `Illustrating page ${i+1}/${pages.length}`);

      const { buf, source: imgSrc } = await fetchImageWithFallback(prompt, seed, `p${i+1}`, logger);
      const imgMime = imgSrc === 'svg_fallback' ? 'image/svg+xml' : 'image/png';
      const imgExt  = imgSrc === 'svg_fallback' ? 'svg' : 'png';

      if (r2Available()) {
        try {
          const key = `books/${bookId}/page_${i+1}.${imgExt}`;
          await r2Put(key, buf, imgMime);
          db.prepare(`UPDATE story_book_pages SET image_r2_key=? WHERE book_id=? AND page_num=?`)
            .run(key, bookId, page.page_index);
          logger.log(`p${i+1}_r2`, 'ok', `${(buf.length/1024).toFixed(0)}KB → ${key} [${imgSrc}]`);
        } catch (e) {
          logger.log(`p${i+1}_r2`, 'warn', e.message);
          // Store inline as fallback
          const dataUrl = `data:${imgMime};base64,${buf.toString('base64')}`;
          db.prepare(`UPDATE story_book_pages SET image_url=? WHERE book_id=? AND page_num=?`)
            .run(dataUrl.slice(0, 2000), bookId, page.page_index);
        }
      } else {
        // No R2 — store as data URL (SVG is compact, PNG too large for DB so just store empty)
        if (imgSrc === 'svg_fallback') {
          const dataUrl = `data:image/svg+xml;base64,${buf.toString('base64')}`;
          db.prepare(`UPDATE story_book_pages SET image_url=? WHERE book_id=? AND page_num=?`)
            .run(dataUrl, bookId, page.page_index);
        }
        logger.log(`p${i+1}_r2`, 'warn', 'R2 not configured');
      }
      imgBufs.push(buf);
    }

    // Document
    logger.log('doc_start', 'ok', 'Building PDF/HTML document');
    const storyTheme = story.theme || 'adventure';
    const bookUrl    = `${(process.env.FRONTEND_URL || 'https://properly-web.onrender.com').replace(/\/+$/,'')}/read/${story.id}?ai=1`;
    let docBuf = null, docExt = 'pdf', docMime = 'application/pdf';
    try {
      docBuf = await generatePdf(story, childName, imgBufs, logger, bookUrl);
      if (docBuf?.slice(0,15).toString().includes('<!DOCTYPE')) {
        docExt = 'html'; docMime = 'text/html';
        logger.log('doc_type', 'warn', 'HTML fallback used (PDFKit not installed on server)');
      } else {
        logger.log('doc_build', 'ok', `${docBuf?.length} bytes`);
      }
    } catch (e) {
      logger.log('doc_build', 'warn', `Failed: ${e.message}`);
    }

    let pdfKey = null;
    if (docBuf && r2Available()) {
      try {
        pdfKey = `books/${bookId}/book.${docExt}`;
        await r2Put(pdfKey, docBuf, docMime);
        logger.log('doc_r2', 'ok', pdfKey);
      } catch (e) { logger.log('doc_r2', 'warn', e.message); pdfKey = null; }
    } else if (!r2Available()) {
      logger.log('doc_r2', 'warn', 'R2 not configured — book ready without downloadable PDF');
    }

    db.prepare(`UPDATE story_books SET status='ready', pdf_r2_key=?, page_count=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(pdfKey, pages.length, bookId);

    logger.log('complete', 'ok', `✅ Book ready | pages: ${pages.length} | doc: ${pdfKey||'none'}`);

  } catch (err) {
    logger.log('fatal', 'error', err.message);
    db.prepare(`UPDATE story_books SET status='error', error_msg=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(err.message, bookId);

    // Auto-create content_report so admin sees it in the reports queue
    try {
      const book = db.prepare('SELECT sb.*, c.user_id FROM story_books sb JOIN children c ON c.id=sb.child_id WHERE sb.id=?').get(bookId);
      if (book) {
        db.prepare(`INSERT OR IGNORE INTO content_reports (id,user_id,child_id,content_type,content_id,content_title,reason,detail,status)
                    VALUES (lower(hex(randomblob(16))),?,?,'story_book',?,?,'generation_failed',?,'pending')`)
          .run(book.user_id, book.child_id, bookId, book.title||'Untitled', `Auto-reported: ${err.message}`);
      }
    } catch {}
  }
}
