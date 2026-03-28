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

// ── POLLINATIONS CONFIGURATION ───────────────────────────────
// Pollinations.ai free tier: no API key needed, just hit the URL directly.
// The bare prompt URL (no model param) uses their default free model.
// model=flux requires POLLINATIONS_TOKEN (paid/partner tier).
const POLL_TOKEN = (process.env.POLLINATIONS_TOKEN || '').trim();

const POLL_ENDPOINTS = [
  // Strategy 1: bare URL, no model param — uses free default, most compatible
  (prompt, seed) => ({
    url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
         `?width=800&height=600&seed=${seed}&nologo=true&nofeed=true`,
    headers: {
      'Accept':     'image/jpeg,image/png,image/*,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; ProperlyApp/1.0)',
      ...(POLL_TOKEN ? { 'Authorization': `Bearer ${POLL_TOKEN}` } : {}),
    },
  }),
  // Strategy 2: shorter prompt (Pollinations can 400 on very long encoded URLs)
  (prompt, seed) => ({
    url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 100))}` +
         `?width=512&height=384&seed=${seed}&nologo=true`,
    headers: {
      'Accept':     'image/*,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; ProperlyApp/1.0)',
    },
  }),
  // Strategy 3: absolute minimum — just prompt and seed
  (prompt, seed) => ({
    url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 80))}?seed=${seed}`,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProperlyApp/1.0)' },
  }),
];

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
  const clean = (text || '').replace(/['"]/g, '').trim().slice(0, 180);
  return `cute kawaii watercolour children book illustration, bright pastel colours, friendly characters, no text, ${clean}, child character named ${childName}`;
}

// ── FETCH IMAGE WITH MULTI-STRATEGY + SVG FALLBACK ───────────
async function fetchImageWithFallback(prompt, seed, label, logger) {
  // Try each Pollinations strategy
  for (let si = 0; si < POLL_ENDPOINTS.length; si++) {
    const { url, headers } = POLL_ENDPOINTS[si](prompt, seed);
    try {
      console.log(`[Book] ${label} strategy ${si+1}: ${url.slice(0,80)}`);
      const res = await fetch(url, {
        signal:  AbortSignal.timeout(45000),
        headers,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[Book] ${label} strategy ${si+1}: HTTP ${res.status} — ${body.slice(0,120)}`);
        logger?.log?.(`img_${label}_s${si+1}`, 'warn', `HTTP ${res.status}: ${body.slice(0,80)}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('image')) {
        console.warn(`[Book] ${label} strategy ${si+1}: non-image content-type ${ct}`);
        logger?.log?.(`img_${label}_s${si+1}`, 'warn', `non-image: ${ct}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) {
        console.warn(`[Book] ${label} strategy ${si+1}: suspiciously small (${buf.length}b)`);
        continue;
      }
      console.log(`[Book] ${label} strategy ${si+1}: ✅ ${buf.length} bytes`);
      logger?.log?.(`img_${label}`, 'ok', `strategy ${si+1}: ${(buf.length/1024).toFixed(0)}KB`);
      return { buf, source: `pollinations_s${si+1}` };
    } catch (e) {
      console.warn(`[Book] ${label} strategy ${si+1}: ${e.message}`);
      logger?.log?.(`img_${label}_s${si+1}`, 'warn', e.message.slice(0,80));
    }
  }

  // All strategies failed — generate a beautiful SVG illustration instead
  console.warn(`[Book] ${label}: all image strategies failed — generating SVG fallback`);
  logger?.log?.(`img_${label}`, 'warn', 'Pollinations unavailable — SVG fallback used');
  const svgBuf = buildSvgPage(prompt, seed);
  return { buf: svgBuf, source: 'svg_fallback' };
}

// ── SVG PAGE ILLUSTRATION FALLBACK ───────────────────────────
// Generates a beautiful, colourful SVG page for children's books.
// Used when Pollinations.ai is unavailable. Includes randomised shapes,
// theme-appropriate colours, and decorative elements.
function buildSvgPage(text, seed) {
  const n   = typeof seed === 'number' ? seed : 42;
  const rng = (lo, hi) => lo + ((n * 1103515245 + 12345) & 0x7fffffff) % (hi - lo + 1);

  const PALETTES = [
    ['#FFD166','#EF476F','#06D6A0','#118AB2','#073B4C'],  // vibrant
    ['#F9C74F','#F8961E','#F3722C','#90BE6D','#43AA8B'],  // warm sunset
    ['#9B5DE5','#F15BB5','#FEE440','#00BBF9','#00F5D4'],  // pastel candy
    ['#264653','#2A9D8F','#E9C46A','#F4A261','#E76F51'],  // earth tones
  ];
  const palette = PALETTES[Math.abs(n) % PALETTES.length];
  const bg      = palette[0];
  const acc1    = palette[1];
  const acc2    = palette[2];
  const acc3    = palette[3];

  // Extract a short excerpt for display (no more than 6 words)
  const snippet = (text || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${palette[4] || '#fff'}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${bg}"/>
    </radialGradient>
    <filter id="soft">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="${bg}" opacity="0.6"/>

  <!-- Decorative blobs -->
  <ellipse cx="${150 + rng(0,50)}" cy="${80 + rng(0,40)}"  rx="${80+rng(0,40)}" ry="${60+rng(0,30)}" fill="${acc1}" opacity="0.35" filter="url(#soft)"/>
  <ellipse cx="${620 + rng(0,60)}" cy="${120 + rng(0,50)}" rx="${90+rng(0,50)}" ry="${70+rng(0,30)}" fill="${acc2}" opacity="0.3"  filter="url(#soft)"/>
  <ellipse cx="${400}"             cy="${520}"               rx="${200}"          ry="${80}"           fill="${acc3}" opacity="0.25" filter="url(#soft)"/>

  <!-- Central illustration area -->
  <circle cx="400" cy="280" r="160" fill="white" opacity="0.18"/>
  <circle cx="400" cy="280" r="140" fill="${acc1}" opacity="0.22"/>

  <!-- Character silhouette — simplified child figure -->
  <ellipse cx="400" cy="220" rx="38" ry="42" fill="white" opacity="0.85"/>
  <rect x="364" y="258" width="72" height="80" rx="18" fill="white" opacity="0.85"/>
  <rect x="342" y="266" width="28" height="55" rx="12" fill="white" opacity="0.75"/>
  <rect x="430" y="266" width="28" height="55" rx="12" fill="white" opacity="0.75"/>
  <rect x="372" y="334" width="26" height="52" rx="12" fill="white" opacity="0.75"/>
  <rect x="402" y="334" width="26" height="52" rx="12" fill="white" opacity="0.75"/>

  <!-- Stars and sparkles -->
  <text x="180" y="160" font-size="28" opacity="0.7" fill="${acc2}">⭐</text>
  <text x="580" y="180" font-size="22" opacity="0.6" fill="${acc3}">✨</text>
  <text x="120" y="420" font-size="20" opacity="0.5" fill="white">🌟</text>
  <text x="650" y="400" font-size="24" opacity="0.55" fill="${acc1}">💫</text>

  <!-- Decorative dots -->
  ${[...Array(12)].map((_, i) => { const cx = 80+(i*60); const cy = 550+(i%3)*12; return '<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="white" opacity="'+(0.3+(i%3)*0.2).toFixed(1)+'"/>'; }).join(' ')}

  <!-- Page text area -->
  <rect x="60" y="420" width="680" height="90" rx="18" fill="white" opacity="0.82"/>
  <text x="400" y="448" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#374151" font-style="italic" opacity="0.6">Illustrated Story Page</text>
  <text x="400" y="472" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#1F2937" font-weight="bold">${snippet}</text>

  <!-- Frame border -->
  <rect x="12" y="12" width="776" height="576" rx="28" fill="none" stroke="white" stroke-width="3" stroke-dasharray="8 5" opacity="0.4"/>
</svg>`;

  return Buffer.from(svg, 'utf8');
}

// ── PDF GENERATION ────────────────────────────────────────────
async function generatePdf(story, childName, pageImages, logger) {
  try {
    const { default: PDFDocument } = await import('pdfkit');
    logger.log('pdf_engine', 'ok', 'PDFKit available');
    return await buildPdf(PDFDocument, story, childName, pageImages);
  } catch (e) {
    logger.log('pdf_engine', 'warn', `PDFKit not available (${e.message}) — using HTML fallback`);
    return buildHtml(story, childName, pageImages);
  }
}

async function buildPdf(PDFDocument, story, childName, pageImages) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89;
    const pages = story.pages || [];
    const bgs   = ['#F5F3FF','#FFF9F0','#F0F4FF','#FFF0F9','#FFFBEB','#F0FDF4'];

    // Cover
    doc.addPage();
    doc.rect(0,0,W,H).fill('#1E1B4B');
    if (pageImages[0]) { try { doc.image(pageImages[0], 60, 60, { width: W-120, height: 340, fit:[W-120,340], align:'center' }); } catch {} }
    doc.fontSize(34).font('Helvetica-Bold').fillColor('#FBBF24')
       .text(story.title || `${childName}'s Story`, 40, 430, { width:W-80, align:'center' });
    doc.fontSize(15).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
       .text(`A personalised phonics story for ${childName}`, 40, 478, { width:W-80, align:'center' });
    doc.rect(0, H-64, W, 64).fill('#7C3AED');
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#fff')
       .text('Properly — AI Phonics Tutor', 0, H-42, { width:W, align:'center' });

    // Story pages
    pages.forEach((page, idx) => {
      doc.addPage();
      doc.rect(0,0,W,H).fill(bgs[idx % bgs.length]);
      doc.circle(W-40,40,18).fill('#7C3AED');
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#fff').text(String(idx+1), W-55, 33, { width:36, align:'center' });
      const imgBuf = pageImages[idx+1];
      if (imgBuf) { try { doc.image(imgBuf, 40, 28, { width:W-80, height:400, fit:[W-80,400], align:'center', valign:'center' }); } catch {} }
      else { doc.roundedRect(40,28,W-80,400,10).fill('#EDE9FE'); doc.fontSize(48).text('✨', 0, 200, { width:W, align:'center' }); }
      const ty = 450;
      doc.roundedRect(40, ty, W-80, H-ty-36, 10).fill('#fff');
      doc.roundedRect(40, ty, W-80, H-ty-36, 10).stroke('#DDD6FE').lineWidth(1.5);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1E1B4B')
         .text(page.text||'', 58, ty+16, { width:W-116, align:'center', lineGap:5 });
    });

    // Back cover
    doc.addPage();
    doc.rect(0,0,W,H).fill('#7C3AED');
    doc.fontSize(72).text('🌟', 0, H*0.28, { width:W, align:'center' });
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#fff')
       .text(`Well done, ${childName}!`, 0, H*0.52, { width:W, align:'center' });
    doc.fontSize(16).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
       .text('You are a brilliant reader! 📚', 0, H*0.52+50, { width:W, align:'center' });
    doc.fontSize(12).fillColor('rgba(255,255,255,0.4)')
       .text('Created with Properly — AI Phonics Tutor', 0, H-72, { width:W, align:'center' });

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
    let docBuf = null, docExt = 'pdf', docMime = 'application/pdf';
    try {
      docBuf = await generatePdf(story, childName, imgBufs, logger);
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
