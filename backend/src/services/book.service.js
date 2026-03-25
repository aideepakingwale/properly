/**
 * @file        book.service.js
 * @description Story book generation service — AI image generation (Pollinations.ai) and
 *              PDF book creation (PDFKit). Stores assets in Cloudflare R2.
 * @module      Book Service
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Images generated via Pollinations.ai (free, no API key, kid-safe)
 *   - PDF generated with PDFKit in Node.js — embedded images, colourful layout
 *   - Book generation runs async (status: pending -> generating -> ready/error)
 *   - 1 free book credit per user on registration; additional credits purchasable
 *   - Print ordering records shipping details; fulfilment via Gelato/Prodigi (future)
 */

import { getDb }                        from '../db/database.js';
import { r2Put, r2Url, r2Available } from './r2.service.js';
import { randomBytes }                  from 'crypto';

// Pollinations.ai — completely free, no API key required, no account needed.
// Docs: https://pollinations.ai
// model=flux     uses the best free model for illustrations (no account needed)
// enhance=false  disable auto prompt enhancement (faster, more predictable)
// NOTE: nologo=true and safe=true require a Pollinations account — not used here
const POLL_BASE = 'https://image.pollinations.ai/prompt';

// ── IMAGE GENERATION (Pollinations.ai) ───────────────────────
/**
 * Generate a kid-friendly illustration for a story page.
 * Uses Pollinations.ai — completely free, no API key required.
 *
 * @param {string} prompt     - Scene description from story page
 * @param {string} childName  - Child's name to personalise the scene
 * @param {number} seed       - Deterministic seed so same page always renders same image
 * @returns {Promise<Buffer>} PNG image bytes
 */
export async function generatePageImage(prompt, childName, seed = 42) {
  const stylePrefix = 'cute kawaii watercolour children book illustration, bright pastel colours, friendly characters, no text, safe for kids,';
  const fullPrompt  = `${stylePrefix} ${prompt}, featuring a child named ${childName}`;
  const encoded     = encodeURIComponent(fullPrompt);
  const url = `${POLL_BASE}/${encoded}?width=800&height=600&seed=${seed}&model=flux&enhance=false`;
  console.log(`[Book] Pollinations request: ${url.slice(0, 100)}…`);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(45000),   // 45s — Pollinations can be slow on first request
    headers: { 'Accept': 'image/png,image/jpeg,image/*' },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Pollinations HTTP ${res.status}: ${errText}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('image')) {
    throw new Error(`Pollinations returned non-image: ${contentType}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ── PDF BOOK GENERATION ───────────────────────────────────────
/**
 * Generate a full PDF storybook from an AI story.
 * Each page has a full-bleed illustration + the story sentence.
 *
 * @param {object} book      - story_books row
 * @param {object} story     - ai_stories row with pages[]
 * @param {string} childName - For personalisation
 * @returns {Promise<Buffer>} PDF bytes
 */
export async function generateBookPdf(book, story, childName, pageImages) {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;   // A4 width  (pt)
    const H = 841.89;   // A4 height (pt)

    // ── COVER PAGE ─────────────────────────────────────────
    doc.addPage();

    // Background gradient — amber sky
    doc.rect(0, 0, W, H).fill('#FFF8E7');

    // Stars decoration
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.4;
      doc.circle(x, y, 1.5).fill('#F59E0B');
    }

    // Cover image (first page image)
    if (pageImages[0]) {
      try {
        doc.image(pageImages[0], 60, 80, { width: W - 120, height: 320, fit: [W - 120, 320], align: 'center' });
      } catch {}
    }

    // Title
    doc.fontSize(36).font('Helvetica-Bold')
       .fillColor('#1E3A5F')
       .text(story.title || `${childName}'s Story`, 40, 430, { width: W - 80, align: 'center' });

    // Subtitle
    doc.fontSize(18).font('Helvetica')
       .fillColor('#4A7C59')
       .text(`A story for ${childName}`, 40, 490, { width: W - 80, align: 'center' });

    // Decorative footer
    doc.rect(0, H - 80, W, 80).fill('#2D6A4F');
    doc.fontSize(14).font('Helvetica-Bold')
       .fillColor('#FFFFFF')
       .text('Properly — AI Phonics Tutor', 0, H - 50, { width: W, align: 'center' });

    // ── STORY PAGES ────────────────────────────────────────
    const pages = story.pages || [];
    pages.forEach((page, idx) => {
      doc.addPage();

      // Page background — alternating pastel
      const bgColours = ['#F0FFF4', '#FFF9F0', '#F0F4FF', '#FFF0F9'];
      doc.rect(0, 0, W, H).fill(bgColours[idx % bgColours.length]);

      // Page number badge
      doc.circle(W - 40, 40, 18).fill('#2D6A4F');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
         .text(String(idx + 1), W - 55, 33, { width: 36, align: 'center' });

      // Story illustration (top 60% of page)
      const imgY  = 30;
      const imgH  = 420;
      const imgW  = W - 80;

      if (pageImages[idx + 1]) {
        try {
          doc.image(pageImages[idx + 1], 40, imgY, {
            width: imgW, height: imgH, fit: [imgW, imgH], align: 'center', valign: 'center',
          });
          // Rounded border overlay
          doc.roundedRect(40, imgY, imgW, imgH, 12).stroke('#E2E8F0').lineWidth(2);
        } catch {}
      } else {
        // Placeholder box
        doc.roundedRect(40, imgY, imgW, imgH, 12).fill('#E2E8F0');
        doc.fontSize(16).fillColor('#94A3B8').text('✨', W / 2 - 10, imgY + imgH / 2 - 10);
      }

      // Text panel (bottom 35%)
      const textY = imgY + imgH + 20;
      const textH = H - textY - 40;

      doc.roundedRect(40, textY, imgW, textH, 10).fill('#FFFFFF');
      doc.roundedRect(40, textY, imgW, textH, 10).stroke('#D1FAE5').lineWidth(1.5);

      // Story sentence in large, readable font
      doc.fontSize(22).font('Helvetica-Bold')
         .fillColor('#1E3A5F')
         .text(page.text || '', 60, textY + 20, {
           width: imgW - 40,
           align: 'center',
           lineGap: 6,
         });
    });

    // ── BACK COVER ─────────────────────────────────────────
    doc.addPage();
    doc.rect(0, 0, W, H).fill('#2D6A4F');

    // Big owl emoji area
    doc.fontSize(80).text('🦉', 0, H * 0.25, { width: W, align: 'center' });

    doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('Well done, ' + childName + '!', 0, H * 0.5, { width: W, align: 'center' });
    doc.fontSize(18).font('Helvetica').fillColor('#A7F3D0')
       .text('You are a brilliant reader! 🌟', 0, H * 0.5 + 50, { width: W, align: 'center' });

    doc.fontSize(14).fillColor('#6EE7B7')
       .text('Created with Properly — AI Phonics Tutor', 0, H - 80, { width: W, align: 'center' });

    doc.end();
  });
}

// ── MAIN ORCHESTRATOR ─────────────────────────────────────────
/**
 * Full book generation pipeline:
 *  1. For each story page: generate AI illustration → upload to R2
 *  2. Generate cover image
 *  3. Compile PDF (cover + story pages + back cover)
 *  4. Upload PDF to R2
 *  5. Update story_books status to 'ready'
 *
 * Runs asynchronously — controller starts it and returns immediately.
 * Frontend polls GET /books/:bookId for status updates.
 *
 * @param {string} bookId
 */
export async function generateBook(bookId) {
  const db = getDb();

  try {
    // Mark as generating
    db.prepare(`UPDATE story_books SET status='generating', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(bookId);

    const book  = db.prepare('SELECT * FROM story_books WHERE id=?').get(bookId);
    if (!book)  throw new Error(`Book ${bookId} not found`);

    const story = db.prepare('SELECT * FROM ai_stories WHERE id=?').get(book.ai_story_id);
    if (!story) throw new Error(`AI story ${book.ai_story_id} not found`);

    const child = db.prepare('SELECT * FROM children WHERE id=?').get(book.child_id);
    const pages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id=? ORDER BY page_index').all(book.ai_story_id);

    story.pages = pages;
    const childName = child?.name || 'Reader';
    const imageBuffers = [];  // [coverImg, page1Img, page2Img, ...]

    // ── Generate cover image ─────────────────────────────
    const coverPrompt = `enchanted forest book cover, title "${story.title || childName + "'s Story"}", magical adventure, children book art`;
    console.log(`[Book] Generating cover image for book ${bookId}…`);

    let coverBuf = null;
    try {
      coverBuf = await generatePageImage(coverPrompt, childName, 1);
      if (r2Available()) {
        const coverKey = `books/${bookId}/cover.png`;
        await r2Put(coverKey, coverBuf, 'image/png');
        db.prepare(`UPDATE story_books SET cover_r2_key=? WHERE id=?`).run(coverKey, bookId);
      }
    } catch (e) {
      console.warn(`[Book] Cover image failed:`, e.message);
    }
    imageBuffers.push(coverBuf);   // index 0 = cover

    // ── Generate one image per story page ────────────────
    for (let i = 0; i < pages.length; i++) {
      const page     = pages[i];
      const prompt   = buildImagePrompt(page.text, childName, story.title);
      const seed     = parseInt(bookId.slice(0, 8), 16) + i;   // deterministic per book+page

      console.log(`[Book] Generating image for page ${i + 1}/${pages.length}…`);
      let imgBuf = null;
      try {
        imgBuf = await generatePageImage(prompt, childName, seed);

        // Upload image to R2
        if (r2Available()) {
          const imgKey = `books/${bookId}/page_${i + 1}.png`;
          await r2Put(imgKey, imgBuf, 'image/png');
          db.prepare(`UPDATE story_book_pages SET image_r2_key=? WHERE book_id=? AND page_num=?`)
            .run(imgKey, bookId, page.page_index);
        }

        // Also store the Pollinations URL as fallback
        const imgUrl = `${POLL_BASE}/${encodeURIComponent(buildImagePrompt(page.text, childName, story.title))}?width=800&height=600&seed=${seed}&model=flux&enhance=false`;
        db.prepare(`UPDATE story_book_pages SET image_url=? WHERE book_id=? AND page_num=?`)
          .run(imgUrl, bookId, page.page_index);

      } catch (e) {
        console.warn(`[Book] Page ${i + 1} image failed:`, e.message);
      }

      imageBuffers.push(imgBuf);   // index i+1 = page i
    }

    // ── Generate PDF ─────────────────────────────────────
    console.log(`[Book] Generating PDF…`);
    const pdfBuf = await generateBookPdf(book, story, childName, imageBuffers);

    // Upload PDF to R2
    const pdfKey = `books/${bookId}/book.pdf`;
    if (r2Available()) {
      await r2Put(pdfKey, pdfBuf, 'application/pdf');
    }

    // Mark book as ready
    db.prepare(`
      UPDATE story_books
      SET status='ready', pdf_r2_key=?, page_count=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(pdfKey, pages.length, bookId);

    console.log(`[Book] Book ${bookId} generation complete ✅`);

  } catch (err) {
    console.error(`[Book] Generation failed for ${bookId}:`, err.message);
    db.prepare(`UPDATE story_books SET status='error', error_msg=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(err.message, bookId);
  }
}

// ── HELPERS ───────────────────────────────────────────────────
/**
 * Build a descriptive image prompt from a story sentence.
 * Keeps descriptions vivid and safe for Pollinations.ai.
 */
function buildImagePrompt(text, childName, storyTitle) {
  const cleaned = (text || '').replace(/['"]/g, '').trim();
  return `children story scene: ${cleaned}, featuring a child character named ${childName}, colourful friendly illustration, safe for kids`;
}
