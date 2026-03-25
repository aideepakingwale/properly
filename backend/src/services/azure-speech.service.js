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
    console.log(`[Azure] ffmpeg: ${(inputBuffer.length/1024).toFixed(1)} KB ${ext} → ${(wav.length/1024).toFixed(1)} KB WAV PCM 16 kHz`);
    return { buffer: wav, converted: true };
  } catch (e) {
    console.error('[Azure] ffmpeg FAILED:', e.message);
    console.error('[Azure] Sending original audio — Azure may reject it');
    return { buffer: inputBuffer, converted: false };
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

  // Step 2 — convert audio to WAV PCM 16 kHz
  const isAlreadyWav = mimeType.includes('wav');
  const { buffer: audioToSend, converted } = isAlreadyWav
    ? { buffer: audioBuffer, converted: false }
    : await toWavPcm16k(audioBuffer, mimeType);

  // Step 3 — build Azure request
  const pronConfig = {
    ReferenceText:   sanitisedText,
    GradingSystem:   'HundredMark',
    Granularity:     'Phoneme',
    EnableMiscue:    true,
    PhonemeAlphabet: 'IPA',
    // Note: EnableProsodyAssessment omitted — only valid for en-US
  };
  const pronConfigB64 = Buffer.from(JSON.stringify(pronConfig)).toString('base64');
  const endpoint = `https://${AZURE_REGION}.stt.speech.microsoft.com` +
                   `/speech/recognition/conversation/cognitiveservices/v1`;
  const params   = new URLSearchParams({ language: 'en-GB', format: 'detailed' });

  // CRITICAL: Azure pronunciation assessment REST API requires this EXACT Content-Type
  // Plain "audio/wav" is rejected. Must specify codec and samplerate.
  const contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';

  console.log(`[Azure] Assess: "${sanitisedText.slice(0, 60)}" — audio ${(audioToSend.length/1024).toFixed(1)} KB`);

  const response = await fetch(`${endpoint}?${params}`, {
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

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    console.error(`[Azure] HTTP ${response.status}: ${errText.slice(0, 200)}`);
    throw new Error(`Azure STT ${response.status}: ${errText.slice(0, 120)}`);
  }

  const result = await response.json();

  // Log recognition status for debugging
  const recognitionStatus = result.RecognitionStatus;
  console.log(`[Azure] RecognitionStatus: ${recognitionStatus} — NBest words: ${result.NBest?.[0]?.Words?.length ?? 0}`);

  if (recognitionStatus === 'NoMatch' || recognitionStatus === 'InitialSilenceTimeout') {
    throw new Error(`Azure: ${recognitionStatus} — audio may be too quiet or too short`);
  }

  // Step 4 — parse + remap
  const parsed = parseAzureResult(result, sanitisedWords, refWords, properNounMap);
  parsed._debug = {
    endpoint: `${endpoint}?${params}`,
    audioKB:  (audioToSend.length / 1024).toFixed(1),
    mimeIn:   mimeType,
    converted,
    refText:  referenceText,
    sanitised: sanitisedText,
    properNouns: Object.values(properNounMap).map(v => `${v.original} → "${v.phonetic}"`),
    pronConfig,
    recognitionStatus,
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

  return {
    wordScores,
    overallAccuracy,
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
