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

const POLL_BASE = 'https://image.pollinations.ai/prompt';

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

function pollinationsUrl(prompt, seed) {
  return `${POLL_BASE}/${encodeURIComponent(prompt)}?width=800&height=600&seed=${seed}&model=flux&enhance=false`;
}

function buildImagePrompt(text, childName) {
  const clean = (text || '').replace(/['"]/g, '').trim().slice(0, 180);
  return `cute kawaii watercolour children book illustration, bright pastel colours, friendly characters, no text, ${clean}, child character named ${childName}`;
}

async function fetchImage(url, label) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(50000),
      headers: { Accept: 'image/png,image/jpeg,image/*' },
    });
    if (!res.ok) {
      console.warn(`[Book] ${label}: HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('image')) {
      console.warn(`[Book] ${label}: unexpected content-type: ${ct}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[Book] ${label}: ${buf.length} bytes OK`);
    return buf;
  } catch (e) {
    console.warn(`[Book] ${label}: ${e.message}`);
    return null;
  }
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

    // Cover
    const coverPrompt = `enchanted magical book cover for children, bright colours, friendly, no text, adventure, for the story "${story.title||childName+"'s Story"}"`;
    const coverUrl    = pollinationsUrl(coverPrompt, safeSeed(bookId, 0));
    db.prepare(`UPDATE story_books SET cover_r2_key=? WHERE id=?`).run(coverUrl, bookId);
    logger.log('cover_url', 'ok', coverUrl.slice(0, 90));

    const coverBuf = await fetchImage(coverUrl, 'cover');
    if (coverBuf && r2Available()) {
      try {
        const key = `books/${bookId}/cover.png`;
        await r2Put(key, coverBuf, 'image/png');
        db.prepare(`UPDATE story_books SET cover_r2_key=? WHERE id=?`).run(key, bookId);
        logger.log('cover_r2', 'ok', `${coverBuf.length}b → ${key}`);
      } catch (e) { logger.log('cover_r2', 'warn', e.message); }
    } else {
      logger.log('cover_fetch', coverBuf ? 'warn' : 'warn', coverBuf ? 'R2 unavailable' : 'Fetch returned null — URL fallback used');
    }
    imgBufs.push(coverBuf);

    // Story pages
    for (let i = 0; i < pages.length; i++) {
      const page   = pages[i];
      const seed   = safeSeed(bookId, i + 1);
      const prompt = buildImagePrompt(page.text, childName);
      const url    = pollinationsUrl(prompt, seed);

      db.prepare(`UPDATE story_book_pages SET image_url=? WHERE book_id=? AND page_num=?`)
        .run(url, bookId, page.page_index);
      logger.log(`p${i+1}_url`, 'ok', `page ${i+1}/${pages.length} URL stored`);

      const buf = await fetchImage(url, `page ${i+1}`);
      if (buf && r2Available()) {
        try {
          const key = `books/${bookId}/page_${i+1}.png`;
          await r2Put(key, buf, 'image/png');
          db.prepare(`UPDATE story_book_pages SET image_r2_key=? WHERE book_id=? AND page_num=?`)
            .run(key, bookId, page.page_index);
          logger.log(`p${i+1}_r2`, 'ok', `${buf.length}b → ${key}`);
        } catch (e) { logger.log(`p${i+1}_r2`, 'warn', e.message); }
      } else {
        logger.log(`p${i+1}_fetch`, 'warn', buf ? 'R2 unavailable' : 'Fetch null — URL fallback');
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
