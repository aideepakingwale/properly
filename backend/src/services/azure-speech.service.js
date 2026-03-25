/**
 * @file        azure-speech.service.js
 * @description Azure Cognitive Services wrapper — Pronunciation Assessment and Neural TTS
 * @module      Azure Speech
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   PROPER NOUN STRATEGY:
 *   Azure's en-GB STT model does not recognise uncommon/non-English names (e.g. "Devansh").
 *   It breaks them into junk fragments ("D", "De", "Dev") marked as Insertions, making all
 *   subsequent word scores wrong. Simply skipping names with a fixed score is not acceptable
 *   because children SHOULD be trained on pronouncing their own name correctly.
 *
 *   Solution — phonetic transcription:
 *   1. Detect proper nouns in the reference text (capital-letter, non-common words)
 *   2. Ask Gemini to provide a phonetic English spelling Azure en-GB can recognise
 *      (e.g. "Devansh" -> "deh-vaansh" -> simplified to "devaan sh" for Azure)
 *   3. Cache results in app_settings DB table (key: phonetic:WORD) to avoid repeated API calls
 *   4. Send phonetic version to Azure — Azure now hears real sounds and scores them
 *   5. Map Azure's phoneme scores back to the original word name in the response
 *   This way children receive real phonics feedback on their name, not a fake score.
 *
 *   EnableProsodyAssessment is NOT sent for en-GB — only works with en-US.
 *   Word alignment uses azPtr (sequential pointer) to stay in sync after Insertions.
 */

const AZURE_KEY    = (process.env.AZURE_SPEECH_KEY    || '').trim();
const AZURE_REGION = (process.env.AZURE_SPEECH_REGION || 'uksouth').trim();

// Words that start with a capital but are NOT proper nouns — common English words
const COMMON_CAPS = new Set([
  'the','a','an','i','it','is','in','on','at','to','of','and','or','but',
  'so','as','my','he','she','we','you','they','me','him','her','us','them',
  'his','its','our','your','their','this','that','these','those','what',
  'who','how','why','when','where','there','here','yes','no','not',
]);

/**
 * Returns true if a word is likely a proper noun (a name like "Devansh", "Emma", etc.)
 * Uses capital-letter detection and excludes common English words.
 * Excludes single-letter words and very short words that are likely initials.
 */
function isProperNoun(word) {
  const clean = word.replace(/[.,!?;:'"]/g, '');
  if (clean.length < 3) return false;
  if (!/^[A-Z]/.test(clean)) return false;
  return !COMMON_CAPS.has(clean.toLowerCase());
}

// ── PHONETIC SPELLING CACHE + LOOKUP ─────────────────────────
// In-memory cache (also persisted to DB) for phonetic spellings of proper nouns.
// Avoids calling Gemini on every assessment for the same name.
const _phoneticCache = {};   // word -> phonetic spelling

/**
 * Get a phonetic English spelling of a proper noun that Azure en-GB can recognise.
 * Example: "Devansh" -> "devaan sh", "Priya" -> "preeya", "Rohan" -> "rohan"
 *
 * Strategy:
 *   1. In-memory cache (instant)
 *   2. DB cache (app_settings key: phonetic:WORD) - persists across restarts
 *   3. Gemini API - generates phonetic spelling, result cached
 *   4. Fallback - lowercase the word (Azure may still manage basic sounds)
 *
 * @param {string} word - Proper noun to transcribe (no punctuation)
 * @returns {string} Phonetic spelling safe for Azure en-GB reference text
 */
async function getPhoneticSpelling(word) {
  const cacheKey = word.toLowerCase();

  // 1. In-memory cache
  if (_phoneticCache[cacheKey]) return _phoneticCache[cacheKey];

  // 2. DB cache
  try {
    const { getDb } = await import('../db/database.js');
    const db      = getDb();
    const row     = db.prepare("SELECT value FROM app_settings WHERE key=?")
                      .get(`phonetic:${cacheKey}`);
    if (row?.value) {
      _phoneticCache[cacheKey] = row.value;
      return row.value;
    }
  } catch {}

  // 3. Gemini — generate phonetic spelling
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey && geminiKey !== 'your-gemini-api-key-here') {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `Give ONLY a simple phonetic English spelling of the name "${word}" that a British English speech recogniser would understand. ` +
              `Write it as plain English syllables a child could read aloud (no IPA, no hyphens, no spaces between syllables, lowercase). ` +
              `Examples: "Priya" -> "preeya", "Devansh" -> "devaansh", "Rohan" -> "rohan", "Aisha" -> "aysha", "Mohammed" -> "mohammad". ` +
              `Reply with ONLY the phonetic spelling, nothing else.`
            }] }],
            generationConfig: { maxOutputTokens: 20, temperature: 0.1 },
          }),
        }
      );
      if (res.ok) {
        const data    = await res.json();
        const phonetic = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
          .trim().toLowerCase().replace(/[^a-z\s]/g, '').trim();
        if (phonetic && phonetic.length > 1) {
          // Cache in memory and DB
          _phoneticCache[cacheKey] = phonetic;
          try {
            const { getDb } = await import('../db/database.js');
            getDb().prepare(
              `INSERT INTO app_settings (key, value, updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
            ).run(`phonetic:${cacheKey}`, phonetic);
          } catch {}
          console.log(`[Azure] Phonetic: "${word}" -> "${phonetic}" (cached)`);
          return phonetic;
        }
      }
    } catch (e) {
      console.warn(`[Azure] Phonetic lookup failed for "${word}":`, e.message);
    }
  }

  // 4. Fallback — lowercase; Azure may handle simple cases
  const fallback = word.toLowerCase();
  _phoneticCache[cacheKey] = fallback;
  return fallback;
}

export function azureAvailable() {
  return Boolean(AZURE_KEY && AZURE_KEY !== 'your-azure-speech-key-here');
}

// ── AUDIO CONVERSION ──────────────────────────────────────────
async function toWavPcm16k(inputBuffer, inputMime) {
  const { execFileSync }                           = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync }= await import('fs');
  const { tmpdir }                                 = await import('os');
  const { join }                                   = await import('path');
  const { randomBytes }                            = await import('crypto');

  const id      = randomBytes(8).toString('hex');
  const ext     = inputMime?.includes('webm') ? 'webm'
                : inputMime?.includes('ogg')  ? 'ogg'
                : inputMime?.includes('mp4')  ? 'mp4' : 'wav';
  const inFile  = join(tmpdir(), `az_in_${id}.${ext}`);
  const outFile = join(tmpdir(), `az_out_${id}.wav`);

  try {
    writeFileSync(inFile, inputBuffer);
    execFileSync('ffmpeg', [
      '-y', '-i', inFile,
      '-ar', '16000', '-ac', '1',
      '-acodec', 'pcm_s16le', '-f', 'wav',
      outFile,
    ], { stdio: 'pipe', timeout: 15000 });
    return readFileSync(outFile);
  } catch (e) {
    console.warn('[Azure] ffmpeg conversion failed:', e.message, '— using original audio');
    return inputBuffer;
  } finally {
    try { unlinkSync(inFile);  } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

// ── PRONUNCIATION ASSESSMENT ──────────────────────────────────
export async function assessPronunciation(audioBuffer, referenceText, mimeType = 'audio/wav') {
  if (!azureAvailable()) throw new Error('Azure Speech not configured');

  // ── Step 1: Pre-process reference text — phonetic transcription ───
  // Azure en-GB cannot recognise uncommon names (e.g. "Devansh" → "D","De","Dev" garbage).
  // We replace each proper noun with a phonetic English approximation that Azure CAN recognise,
  // so it scores the real sounds. The original name is shown in the UI.
  // Phonetic spellings are cached in DB (key: phonetic:WORD) to avoid repeated Gemini calls.
  const refWords = referenceText.trim().split(/\s+/);
  const properNounMap = {};  // index → { original, phonetic }
  const sanitisedWords = await Promise.all(refWords.map(async (w, i) => {
    if (!isProperNoun(w)) return w;
    const clean    = w.replace(/[.,!?;:'"]/g, '');
    const phonetic = await getPhoneticSpelling(clean);
    properNounMap[i] = { original: w, phonetic };
    return phonetic;
  }));
  const sanitisedText = sanitisedWords.join(' ');

  // ── Step 2: Convert audio ────────────────────────────────────
  const audioToSend = (!mimeType.includes('wav') || !mimeType.includes('16000'))
    ? await toWavPcm16k(audioBuffer, mimeType)
    : audioBuffer;

  // ── Step 3: Build Azure config ───────────────────────────────
  // DO NOT include EnableProsodyAssessment — only works with en-US,
  // degrades accuracy scores with en-GB.
  const pronConfig = {
    ReferenceText:   sanitisedText,
    GradingSystem:   'HundredMark',
    Granularity:     'Phoneme',
    EnableMiscue:    true,
    PhonemeAlphabet: 'IPA',
  };
  const pronConfigB64 = Buffer.from(JSON.stringify(pronConfig)).toString('base64');
  const endpoint  = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
  const params    = new URLSearchParams({ language: 'en-GB', format: 'detailed' });

  const requestedAt = new Date().toISOString();
  const response = await fetch(`${endpoint}?${params}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type':              'audio/wav',
      'Pronunciation-Assessment':  pronConfigB64,
      'Accept':                    'application/json',
    },
    body: audioToSend,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure STT ${response.status}: ${errText}`);
  }

  const result = await response.json();

  // ── Step 4: Parse and re-map proper nouns ───────────────────
  const parsed = parseAzureResult(result, sanitisedWords, refWords, properNounMap);

  // Attach full debug payload (stripped in speech controller unless debug mode on)
  parsed._debug = {
    requestedAt,
    endpoint:           `${endpoint}?${params}`,
    audioSizeKb:        (audioToSend.length / 1024).toFixed(1),
    audioMime:          'audio/wav',
    originalRefText:    referenceText,
    sanitisedRefText:   sanitisedText,
    properNounsReplaced: Object.entries(properNounMap).map(([i,v]) => `${v.original} -> "${v.phonetic}"`),
    properNounMap,
    pronConfig,
    azureRawResponse:   result,
  };

  return parsed;
}

// ── RESULT PARSING ────────────────────────────────────────────
/**
 * Map Azure's Word array back onto the original reference words.
 *
 * Azure's Words array (with EnableMiscue=true) is ordered to match the sanitised
 * reference text — Insertion entries are words the child said that weren't in the
 * reference. Stripping those leaves a 1:1 mapping with sanitised reference words.
 *
 * Proper noun positions are filled back in with the original word and a fixed score
 * of 85 (lenient: child almost certainly said their name correctly).
 *
 * @param {object} result        - Raw Azure JSON response
 * @param {string[]} sanitised   - Reference words with proper nouns replaced by "yes"
 * @param {string[]} original    - Original reference words
 * @param {object}  properNounMap - { index: originalWord } for proper noun positions
 */
function parseAzureResult(result, sanitised, original, properNounMap) {
  const nBest = result?.NBest?.[0];
  if (!nBest) return buildFallback(original.join(' '), 0);

  const pa       = nBest.PronunciationAssessment || {};
  const allWords = nBest.Words || [];

  // Strip Insertion words (words child said that are not in the reference text).
  // Example: child says "Devansh" where we put "yes" -> Azure marks "Devansh" as Insertion.
  const aligned = allWords.filter(w =>
    (w.PronunciationAssessment?.ErrorType || 'None') !== 'Insertion'
  );

  // Sequential pointer into aligned[] - MUST advance for every reference word
  // including proper noun slots (which map to "yes" in the sanitised text).
  //
  // THE BUG THIS FIXES:
  // Using aligned[i] directly was wrong because:
  //   - We send "yes saves the town" but child says "Devansh saves the town"
  //   - Azure marks "Devansh" as Insertion (stripped from aligned)
  //   - aligned = [{yes:score}, {saves:score}, {the:score}, {town:score}]
  //   - proper noun at i=0 skips the i=0 check, so next word i=1 ("saves")
  //     reads aligned[1] = {saves} which HAPPENS to be correct here.
  //   - BUT if there is more than one proper noun, or proper noun is not at 0,
  //     the i and azPtr diverge and every word after gets the wrong score.
  //
  // CORRECT: azPtr advances for every reference word regardless of whether
  // it is a proper noun, because "yes" IS in aligned (Azure always returns
  // a result for every reference word, even if the child said something else).
  let azPtr = 0;

  const wordScores = original.map((origWord, i) => {

    if (properNounMap[i]) {
      // Proper noun: Azure scored the PHONETIC SPELLING at this slot.
      // Consume real Azure result so child gets genuine phonics feedback on their name.
      const az       = aligned[azPtr++];
      const rawScore = az ? Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0) : 0;
      const errType  = az ? (az.PronunciationAssessment?.ErrorType || 'None') : 'Omission';
      return {
        word:        origWord,
        score:       rawScore,
        rawScore,
        errorType:   errType,
        isProperNoun: true,
        phonetic:    properNounMap[i]?.phonetic,
        note:        `Assessed via phonetic spelling "${properNounMap[i]?.phonetic}"`,
        phonemes: (az?.Phonemes || []).map(p => ({
          phoneme: p.Phoneme,
          score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
        })),
      };
    }

    // Regular reference word - consume the next Azure result via azPtr
    const az = aligned[azPtr++];
    if (!az) {
      // Azure returned no word here - child omitted it
      return { word: origWord, score: 0, rawScore: 0, errorType: 'Omission', phonemes: [] };
    }

    const rawScore  = Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0);
    const errorType = az.PronunciationAssessment?.ErrorType || 'None';

    return {
      word:      origWord,
      score:     rawScore,
      rawScore,
      errorType,
      phonemes: (az.Phonemes || []).map(p => ({
        phoneme: p.Phoneme,
        score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
      })),
    };
  });
  // Overall accuracy — include ALL words (proper nouns now have real phonetic scores)
  const overallAccuracy = wordScores.length
    ? Math.round(wordScores.reduce((s, w) => s + w.score, 0) / wordScores.length)
    : Math.round(pa.AccuracyScore ?? 0);

  return {
    wordScores,
    overallAccuracy,
    overallFluency:      Math.round(pa.FluencyScore      ?? 0),
    overallCompleteness: Math.round(pa.CompletenessScore ?? 0),
    overallProsody:      0,   // not available for en-GB
    displayText:         nBest.Display || '',
  };
}

function buildFallback(referenceText, score) {
  return {
    wordScores: referenceText.trim().split(/\s+/).map(w => ({
      word: w, score, rawScore: score, errorType: 'None', phonemes: [],
    })),
    overallAccuracy: score, overallFluency: score,
    overallCompleteness: score, overallProsody: 0,
    displayText: '',
  };
}

// ── NEURAL TTS ────────────────────────────────────────────────
export async function synthesizeSpeech(text, voice = 'en-GB-SoniaNeural') {
  if (!azureAvailable()) throw new Error('Azure TTS not configured');

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
    <voice name="${voice}"><prosody rate="0.9" pitch="+5%">${escapeXml(text)}</prosody></voice>
  </speak>`.trim();

  const r = await fetch(
    `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type':              'application/ssml+xml',
        'X-Microsoft-OutputFormat':  'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );
  if (!r.ok) throw new Error(`Azure TTS error: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// ── SAS TOKEN ─────────────────────────────────────────────────
export async function getAzureSasToken() {
  if (!azureAvailable()) return null;
  const r = await fetch(
    `https://${AZURE_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY } }
  );
  if (!r.ok) return null;
  return { token: await r.text(), region: AZURE_REGION, expiresInSeconds: 600 };
}
