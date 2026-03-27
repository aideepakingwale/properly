/**
 * @file        azure-speech.service.js
 * @description Azure Cognitive Services — Pronunciation Assessment + Neural TTS
 * @module      Azure Speech
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * KEY DECISIONS:
 *   • WAV PCM 16 kHz mono is the only reliable format for Azure STT REST API.
 *   • ffmpeg converts any browser audio (WebM/OGG) → WAV. If ffmpeg is missing
 *     we log clearly and attempt to send the raw audio anyway (Azure accepts
 *     some WebM variants on en-GB).
 *   • Content-Type must be "audio/wav; codecs=audio/pcm; samplerate=16000"
 *     — plain "audio/wav" is rejected by Azure pronunciation assessment.
 *   • EnableProsodyAssessment NOT sent for en-GB (only works with en-US).
 *   • EnableMiscue=true lets Azure mark omitted/inserted words explicitly.
 *   • Proper nouns (Devansh, Priya…) are phoneticised so Azure hears real sounds.
 */

const AZURE_KEY    = (process.env.AZURE_SPEECH_KEY    || '').trim();
const AZURE_REGION = (process.env.AZURE_SPEECH_REGION || 'uksouth').trim();

// ── COMMON CAPITALISED WORDS (not proper nouns) ───────────────
const COMMON_CAPS = new Set([
  'the','a','an','i','it','is','in','on','at','to','of','and','or','but',
  'so','as','my','he','she','we','you','they','me','him','her','us','them',
  'his','its','our','your','their','this','that','these','those','what',
  'who','how','why','when','where','there','here','yes','no','not','one',
  'two','all','can','had','was','were','has','have','did','do','been',
]);

function isProperNoun(word) {
  const clean = word.replace(/[.,!?;:'"]/g, '');
  if (clean.length < 3) return false;
  if (!/^[A-Z]/.test(clean)) return false;
  return !COMMON_CAPS.has(clean.toLowerCase());
}

// ── PHONETIC CACHE ────────────────────────────────────────────
const _phoneticCache = {};

async function getPhoneticSpelling(word) {
  const key = word.toLowerCase();
  if (_phoneticCache[key]) return _phoneticCache[key];

  try {
    const { getDb } = await import('../db/database.js');
    const row = getDb()
      .prepare("SELECT value FROM app_settings WHERE key=?")
      .get(`phonetic:${key}`);
    if (row?.value) { _phoneticCache[key] = row.value; return row.value; }
  } catch {}

  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey && !geminiKey.includes('your-')) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `Give ONLY a simple phonetic English spelling of the name "${word}" for a British English speech recogniser. ` +
              `Plain lowercase English syllables only — no IPA, hyphens or spaces. ` +
              `Examples: Priya->preeya, Devansh->devaansh, Rohan->rohan, Aisha->aysha. ` +
              `Reply with ONLY the phonetic spelling.`
            }] }],
            generationConfig: { maxOutputTokens: 20, temperature: 0.1 },
          }),
        }
      );
      if (res.ok) {
        const data     = await res.json();
        const phonetic = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
          .trim().toLowerCase().replace(/[^a-z\s]/g, '').trim();
        if (phonetic?.length > 1) {
          _phoneticCache[key] = phonetic;
          try {
            const { getDb } = await import('../db/database.js');
            getDb().prepare(
              `INSERT INTO app_settings (key, value, updated_at)
               VALUES (?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
            ).run(`phonetic:${key}`, phonetic);
          } catch {}
          console.log(`[Azure] Phonetic: "${word}" → "${phonetic}" (cached)`);
          return phonetic;
        }
      }
    } catch (e) {
      console.warn(`[Azure] Phonetic lookup failed for "${word}":`, e.message);
    }
  }

  const fallback = word.toLowerCase();
  _phoneticCache[key] = fallback;
  return fallback;
}

export function azureAvailable() {
  return Boolean(AZURE_KEY && !AZURE_KEY.includes('your-'));
}

// ── AUDIO CONVERSION: any browser format → WAV PCM 16 kHz ────
export async function toWavPcm16k(inputBuffer, inputMime) {
  const { execFileSync }                            = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync } = await import('fs');
  const { tmpdir }                                  = await import('os');
  const { join }                                    = await import('path');
  const { randomBytes }                             = await import('crypto');

  // Detect file extension from MIME
  const ext = inputMime?.includes('webm') ? 'webm'
            : inputMime?.includes('ogg')  ? 'ogg'
            : inputMime?.includes('mp4')  ? 'mp4'
            : inputMime?.includes('mpeg') ? 'mp3' : 'wav';

  const id      = randomBytes(8).toString('hex');
  const inFile  = join(tmpdir(), `pa_in_${id}.${ext}`);
  const outFile = join(tmpdir(), `pa_out_${id}.wav`);

  try {
    writeFileSync(inFile, inputBuffer);
    execFileSync('ffmpeg', [
      '-y', '-i', inFile,
      '-ar', '16000',            // 16 kHz — Azure STT requirement
      '-ac', '1',               // mono
      '-acodec', 'pcm_s16le',   // PCM signed 16-bit little-endian
      '-f', 'wav',
      outFile,
    ], { stdio: 'pipe', timeout: 20000 });

    const wav = readFileSync(outFile);
    console.log(`[Azure] ffmpeg OK: ${(inputBuffer.length/1024).toFixed(1)} KB ${ext} → ${(wav.length/1024).toFixed(1)} KB WAV 16kHz`);
    return { buffer: wav, converted: true };
  } catch (e) {
    // IMPORTANT: return null so the caller knows conversion failed.
    // DO NOT return the original buffer — sending WebM to Azure with WAV Content-Type
    // will make Azure return 0% for every word (it can't decode the audio).
    console.error('[Azure] ffmpeg FAILED:', e.message);
    console.error('[Azure] Install ffmpeg: add "apt-get install -y ffmpeg" to Render build command');
    return { buffer: null, converted: false };
  } finally {
    try { unlinkSync(inFile);  } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

// ── PRONUNCIATION ASSESSMENT ──────────────────────────────────
export async function assessPronunciation(audioBuffer, referenceText, mimeType = 'audio/wav') {
  if (!azureAvailable()) throw new Error('AZURE_SPEECH_KEY not set');

  // Step 1 — phonetcise proper nouns
  const refWords       = referenceText.trim().split(/\s+/);
  const properNounMap  = {};
  const sanitisedWords = await Promise.all(refWords.map(async (w, i) => {
    if (!isProperNoun(w)) return w;
    const clean    = w.replace(/[.,!?;:'"]/g, '');
    const phonetic = await getPhoneticSpelling(clean);
    properNounMap[i] = { original: w, phonetic };
    return phonetic;
  }));
  const sanitisedText = sanitisedWords.join(' ');

  // Step 2 — ALWAYS convert to WAV PCM 16 kHz via ffmpeg.
  // Browsers often lie about mimeType (report 'audio/wav' but send WebM).
  // ffmpeg detects the real format from the file header regardless of extension.
  const { buffer: audioToSend, converted } = await toWavPcm16k(audioBuffer, mimeType);

  // Step 3 — abort if audio conversion failed (ffmpeg not available)
  // Sending unconverted WebM to Azure causes 0% on every word — better to fail clearly
  if (!audioToSend) {
    throw new Error('Audio conversion failed — ffmpeg not installed. Add "apt-get install -y ffmpeg" to Render build command');
  }

  // Step 4 — build Azure request
  const pronConfig = {
    ReferenceText:   sanitisedText,
    GradingSystem:   'HundredMark',
    Granularity:     'Phoneme',
    EnableMiscue:    true,
    PhonemeAlphabet: 'IPA',
    // EnableProsodyAssessment is NOT sent — Azure only supports it in en-US + eastus/westus2.
    // Sending it to uksouth silently drops the ENTIRE PronunciationAssessment block,
    // causing every word to score 0. We return overallProsody:0 explicitly instead.
  };
  // CRITICAL: base64 must be a single line — some Node builds wrap at 76 chars
  // which breaks the HTTP header. Replace all whitespace/newlines from base64.
  const pronConfigB64 = Buffer.from(JSON.stringify(pronConfig))
    .toString('base64')
    .replace(/[\r\n\s]/g, '');
  const endpoint = `https://${AZURE_REGION}.stt.speech.microsoft.com` +
                   `/speech/recognition/conversation/cognitiveservices/v1`;
  // format=detailed is REQUIRED to get NBest array with PronunciationAssessment
  // IMPORTANT: Pronunciation Assessment only supports specific locales.
  // en-GB is NOT in the supported list — Azure silently returns plain STT with no scores.
  // en-US IS supported and phonics phonemes (CVC, digraphs etc.) are the same.
  // TTS stays en-GB so the child hears British English for reading.
  const params   = new URLSearchParams({ language: 'en-US', format: 'detailed' });

  // CRITICAL: Azure pronunciation assessment REST API requires this EXACT Content-Type
  // Plain "audio/wav" is rejected. Must specify codec and samplerate.
  const contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';

  const fullUrl = `${endpoint}?${params}`;
  const requestHeaders = {
    'Ocp-Apim-Subscription-Key': AZURE_KEY.slice(0,4) + '****' + AZURE_KEY.slice(-4),
    'Content-Type':              contentType,
    'Pronunciation-Assessment':  pronConfigB64,
    'Accept':                    'application/json',
  };

  // ── FULL REQUEST LOG ─────────────────────────────────────────
  console.log('\n========== AZURE REQUEST ==========');
  console.log('URL:    ', fullUrl);
  console.log('METHOD:  POST');
  console.log('HEADERS:', JSON.stringify(requestHeaders, null, 2));
  console.log('BODY:    <WAV audio buffer>', (audioToSend.length/1024).toFixed(1), 'KB');
  console.log('PRON CONFIG (decoded):', JSON.stringify(pronConfig, null, 2));
  console.log('PRON CONFIG B64 length:', pronConfigB64.length);
  console.log('PRON CONFIG B64 (full):', pronConfigB64);
  console.log('====================================\n');

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type':              contentType,
      'Pronunciation-Assessment':  pronConfigB64,
      'Accept':                    'application/json',
    },
    body: audioToSend,
    signal: AbortSignal.timeout(30000),
  });

  // ── FULL RESPONSE LOG ────────────────────────────────────────
  const responseHeadersObj = {};
  response.headers.forEach((val, key) => { responseHeadersObj[key] = val; });
  console.log('\n========== AZURE RESPONSE ==========');
  console.log('STATUS: ', response.status, response.statusText);
  console.log('HEADERS:', JSON.stringify(responseHeadersObj, null, 2));

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    console.log('BODY (error):', errText);
    console.log('=====================================\n');
    throw new Error(`Azure STT ${response.status}: ${errText.slice(0, 200)}`);
  }

  const result = await response.json();
  console.log('BODY (JSON):');
  console.log(JSON.stringify(result, null, 2));
  console.log('=====================================\n');

  // Log recognition status for debugging
  const recognitionStatus = result.RecognitionStatus;
  const nBestPA = result.NBest?.[0]?.PronunciationAssessment;
  const w0PA = result.NBest?.[0]?.Words?.[0]?.PronunciationAssessment;
  console.log(`[Azure] RecognitionStatus: ${recognitionStatus} — NBest words: ${result.NBest?.[0]?.Words?.length ?? 0}`);
  console.log(`[Azure] NBest[0].PronunciationAssessment present: ${!!nBestPA} — AccuracyScore: ${nBestPA?.AccuracyScore}`);
  console.log(`[Azure] Words[0].PronunciationAssessment present: ${!!w0PA} — AccuracyScore: ${w0PA?.AccuracyScore}`);
  if (!nBestPA) {
    console.error('[Azure] ❌ PronunciationAssessment MISSING from NBest — header likely not applied!');
    console.error('[Azure] pronConfigB64 length:', pronConfigB64.length, 'hasNewline:', pronConfigB64.includes('\n'));
  }

  if (recognitionStatus === 'NoMatch' || recognitionStatus === 'InitialSilenceTimeout') {
    throw new Error(`Azure: ${recognitionStatus} — audio may be too quiet or too short`);
  }

  // Step 4 — parse + remap
  const parsed = parseAzureResult(result, sanitisedWords, refWords, properNounMap);
  parsed._debug = {
    // ── REQUEST ──
    requestUrl:     `${endpoint}?${params}`,
    requestHeaders: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY.slice(0,4) + '****' + AZURE_KEY.slice(-4),
      'Content-Type':              contentType,
      'Pronunciation-Assessment':  pronConfigB64,
      'Accept':                    'application/json',
    },
    requestBody:    `<WAV PCM 16kHz — ${(audioToSend.length/1024).toFixed(1)} KB>`,
    pronConfigDecoded: pronConfig,
    pronConfigB64Length: pronConfigB64.length,
    pronConfigB64HasNewline: pronConfigB64.includes('\n'),
    // ── AUDIO ──
    audioKB:    (audioToSend.length / 1024).toFixed(1),
    mimeIn:     mimeType,
    converted,
    // ── RESPONSE ──
    responseStatus:  response.status,
    responseHeaders: responseHeadersObj,
    responseBody:    result,
    // ── PARSED ──
    refText:  referenceText,
    sanitised: sanitisedText,
    properNouns: Object.values(properNounMap).map(v => `${v.original} → "${v.phonetic}"`),
    recognitionStatus,
    nBestPAPresent:  !!result.NBest?.[0]?.PronunciationAssessment,
    nBestAccuracy:   result.NBest?.[0]?.PronunciationAssessment?.AccuracyScore,
    word0PAPresent:  !!result.NBest?.[0]?.Words?.[0]?.PronunciationAssessment,
    word0Score:      result.NBest?.[0]?.Words?.[0]?.PronunciationAssessment?.AccuracyScore,
    azureRawResponse: result,
  };
  return parsed;
}

// ── RESULT PARSING ────────────────────────────────────────────
function parseAzureResult(result, sanitised, original, properNounMap) {
  const nBest = result?.NBest?.[0];
  if (!nBest) {
    console.warn('[Azure] No NBest in response — returning fallback scores');
    return buildFallback(original.join(' '), 0);
  }

  const pa       = nBest.PronunciationAssessment || {};
  const allWords = nBest.Words || [];

  // Strip Insertion words (extra words child said that weren't in the reference)
  const aligned = allWords.filter(w =>
    (w.PronunciationAssessment?.ErrorType || 'None') !== 'Insertion'
  );

  let azPtr = 0;

  const wordScores = original.map((origWord, i) => {
    const az = aligned[azPtr++];

    if (properNounMap[i]) {
      // Proper noun — Azure scored the phonetic replacement; real phonics feedback
      const rawScore = az ? Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0) : 0;
      return {
        word:         origWord,
        score:        rawScore,
        rawScore,
        errorType:    az ? (az.PronunciationAssessment?.ErrorType || 'None') : 'Omission',
        isProperNoun: true,
        phonetic:     properNounMap[i].phonetic,
        phonemes:     (az?.Phonemes || []).map(p => ({
          phoneme: p.Phoneme,
          score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
        })),
      };
    }

    if (!az) {
      return { word: origWord, score: 0, rawScore: 0, errorType: 'Omission', phonemes: [] };
    }

    return {
      word:      origWord,
      score:     Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0),
      rawScore:  Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: az.PronunciationAssessment?.ErrorType || 'None',
      phonemes:  (az.Phonemes || []).map(p => ({
        phoneme: p.Phoneme,
        score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
      })),
    };
  });

  const overallAccuracy = wordScores.length
    ? Math.round(wordScores.reduce((s, w) => s + w.score, 0) / wordScores.length)
    : Math.round(pa.AccuracyScore ?? 0);

  // If every single word is 0 and all are Omission — Azure heard nothing meaningful
  // This is almost always a technical issue (bad audio format) not a child reading badly
  const allOmitted = wordScores.every(w => w.score === 0 && w.errorType === 'Omission');
  if (allOmitted) {
    console.warn('[Azure] All words Omitted (score=0) — audio likely not recognised. Check ffmpeg conversion.');
  }

  return {
    wordScores,
    overallAccuracy,
    allOmitted,   // flag for controller to surface as technical failure
    overallFluency:      Math.round(pa.FluencyScore      ?? 0),
    overallCompleteness: Math.round(pa.CompletenessScore ?? 0),
    overallProsody:      0,
    displayText:         nBest.Display || nBest.Lexical || '',
  };
}

function buildFallback(referenceText, score) {
  return {
    wordScores: referenceText.trim().split(/\s+/).map(w => ({
      word: w, score, rawScore: score, errorType: score === 0 ? 'Omission' : 'None', phonemes: [],
    })),
    overallAccuracy: score, overallFluency: score,
    overallCompleteness: score, overallProsody: 0, displayText: '',
  };
}


// ── GROQ WHISPER PRONUNCIATION ASSESSMENT ────────────────────
// Strategy:
//   1. Send audio + reference text as `prompt` (guides Whisper to expect these words)
//   2. Request verbose_json with word-level timestamps + confidence
//   3. Align transcribed words against reference using DTW-style matching
//   4. Score each word: exact=100, similar=partial, missing=0
//   5. Use segment avg_logprob as a pronunciation confidence signal
//
// Why this works for kids:
//   • Accepts WebM/OGG/MP3 directly — no ffmpeg needed
//   • `prompt` biases Whisper to listen for the specific phonics words
//   • Word-level confidence captures whether the child's sounds were clear
//   • Works on iOS Safari, Firefox, all browsers (no Web Speech API needed)
//   • Already free on Groq's existing free tier

export function groqAvailable() {
  const key = (process.env.GROQ_API_KEY || '').trim();
  return Boolean(key && !key.includes('your-'));
}

export async function assessWithGroqWhisper(audioBuffer, referenceText, mimeType = 'audio/webm') {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) throw new Error('GROQ_API_KEY not set');

  // Build raw multipart/form-data body — Node 22 native fetch handles this natively
  const boundary = '----GroqBoundary' + Math.random().toString(36).slice(2);
  
  // Build multipart body manually for Node.js compatibility
  const CRLF = '\r\n';
  const refText = referenceText.trim();
  
  // Determine file extension from MIME
  const ext = mimeType.includes('webm') ? 'webm'
            : mimeType.includes('ogg')  ? 'ogg'
            : mimeType.includes('mp4')  ? 'mp4'
            : mimeType.includes('mpeg') ? 'mp3' : 'wav';

  // Build multipart manually
  const textPart = (name, value) =>
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;
  
  const filePart = Buffer.concat([
    Buffer.from(`--${boundary}${CRLF}`, 'utf8'),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.${ext}"${CRLF}`, 'utf8'),
    Buffer.from(`Content-Type: ${mimeType}${CRLF}${CRLF}`, 'utf8'),
    audioBuffer,
    Buffer.from(CRLF, 'utf8'),
  ]);

  const body = Buffer.concat([
    Buffer.from(textPart('model',                    'whisper-large-v3-turbo'),  'utf8'),
    Buffer.from(textPart('language',                 'en'),                      'utf8'),
    Buffer.from(textPart('response_format',          'verbose_json'),             'utf8'),
    Buffer.from(textPart('timestamp_granularities[]','word'),                     'utf8'),
    Buffer.from(textPart('temperature',              '0.0'),                     'utf8'),
    // prompt guides Whisper to expect these specific words — crucial for short phonics sentences
    Buffer.from(textPart('prompt', refText),                                     'utf8'),
    filePart,
    Buffer.from(`--${boundary}--${CRLF}`, 'utf8'),
  ]);

  console.log(`[Groq Whisper] Assess: "${refText.slice(0,50)}" — ${(audioBuffer.length/1024).toFixed(1)} KB ${ext}`);

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${key}`,
      'Content-Type':   `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Groq Whisper ${response.status}: ${err.slice(0, 150)}`);
  }

  const result = await response.json();
  console.log(`[Groq Whisper] Got: "${(result.text||'').slice(0,60)}" — ${result.words?.length ?? 0} words`);

  return parseGroqResult(result, refText);
}

function parseGroqResult(result, referenceText) {
  const refWords     = referenceText.trim().split(/\s+/);
  const spokenWords  = (result.words || []);
  const spokenText   = (result.text || '').trim();

  // Align spoken words to reference words using greedy string matching
  // This handles omissions, insertions and slight mispronunciations
  const spokenNorm = spokenWords.map(w => ({
    word:     w.word?.trim().toLowerCase().replace(/[^a-z]/g, '') || '',
    rawWord:  w.word || '',
    start:    w.start || 0,
    end:      w.end   || 0,
  }));

  // Get overall segment confidence from avg_logprob
  // avg_logprob: 0 = perfect, -0.5 = uncertain, < -1.0 = very unclear
  const segLogProb   = result.segments?.[0]?.avg_logprob ?? -0.3;
  // Convert log-prob to 0-100 confidence multiplier
  // -0.1 → 97, -0.3 → 86, -0.5 → 74, -1.0 → 50, -2.0 → 13
  const confMultiplier = Math.max(0.1, Math.min(1, Math.exp(segLogProb)));

  let spokenPtr = 0;
  const wordScores = refWords.map((refWord, i) => {
    const refClean = refWord.toLowerCase().replace(/[^a-z]/g, '');

    // Search ahead in spoken words for a match (allows for insertions)
    let bestMatch = null;
    let bestScore = -1;
    for (let j = spokenPtr; j < Math.min(spokenPtr + 3, spokenNorm.length); j++) {
      const s = stringSimilarity(spokenNorm[j].word, refClean);
      if (s > bestScore) { bestScore = s; bestMatch = { spoken: spokenNorm[j], idx: j }; }
    }

    if (!bestMatch || bestScore < 0.3) {
      // Word not found — child omitted it
      return { word: refWord, score: 0, rawScore: 0, errorType: 'Omission', phonemes: [],
               groqConfidence: Math.round(confMultiplier * 100) };
    }

    spokenPtr = bestMatch.idx + 1;

    // Base score from string similarity (did they say roughly the right word?)
    const similarityScore = bestScore * 100;
    // Modulate by Whisper's confidence in what it heard
    const adjustedScore = Math.round(similarityScore * confMultiplier);

    const errorType = adjustedScore >= 85 ? 'None'
                    : adjustedScore >= 50 ? 'Mispronunciation'
                    : 'Mispronunciation';

    return {
      word:            refWord,
      score:           adjustedScore,
      rawScore:        Math.round(similarityScore),
      errorType,
      groqTranscribed: bestMatch.spoken.rawWord,
      groqConfidence:  Math.round(confMultiplier * 100),
      phonemes:        [],   // Whisper doesn't provide phoneme-level data
    };
  });

  const overallAccuracy = wordScores.length
    ? Math.round(wordScores.reduce((s, w) => s + w.score, 0) / wordScores.length)
    : 0;

  return {
    wordScores,
    overallAccuracy,
    overallFluency:      Math.round(confMultiplier * 90),
    overallCompleteness: Math.round((wordScores.filter(w => w.score > 0).length / refWords.length) * 100),
    overallProsody:      0,
    displayText:         spokenText,
    _debug: {
      groqRaw:        result,
      refWords,
      spokenNorm,
      confMultiplier: confMultiplier.toFixed(3),
      segLogProb,
    },
  };
}

// Jaro-Winkler inspired string similarity 0..1
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.5) return 0;
  
  // Count matching characters within a window
  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end   = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (!bMatches[j] && a[i] === b[j]) { aMatches[i] = bMatches[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;
  
  let trans = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (aMatches[i]) {
      while (!bMatches[k]) k++;
      if (a[i] !== b[k]) trans++;
      k++;
    }
  }
  const jaro = (matches/a.length + matches/b.length + (matches - trans/2)/matches) / 3;
  
  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(a.length, b.length)); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ── NEURAL TTS ────────────────────────────────────────────────
export async function synthesizeSpeech(text, voice = 'en-GB-SoniaNeural') {
  if (!azureAvailable()) throw new Error('Azure not configured');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
    <voice name="${voice}"><prosody rate="0.88" pitch="+4%">${escapeXml(text)}</prosody></voice>
  </speak>`.trim();
  const r = await fetch(
    `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method:  'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type':              'application/ssml+xml',
        'X-Microsoft-OutputFormat':  'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );
  if (!r.ok) throw new Error(`Azure TTS ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

export async function getAzureSasToken() {
  if (!azureAvailable()) return null;
  const r = await fetch(
    `https://${AZURE_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY } }
  );
  if (!r.ok) return null;
  return { token: await r.text(), region: AZURE_REGION, expiresInSeconds: 600 };
}
