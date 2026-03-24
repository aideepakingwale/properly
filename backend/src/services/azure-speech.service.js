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
 *   - Proper nouns (names like "Devansh") are replaced with "yes" before sending to Azure
 *     because Azure's en-GB model does not have phoneme models for Indian/uncommon names.
 *     Those positions receive a fixed score of 85 so children are never penalised for
 *     correctly saying their own name. All other words receive real Azure phoneme scores.
 *   - EnableProsodyAssessment is NOT sent for en-GB — it only works with en-US and
 *     actively degrades word-level accuracy scores when used with other locales.
 *   - Word alignment uses simple index mapping after stripping Insertion words (extra
 *     words the child said beyond the reference text). Azure's Words array, with
 *     EnableMiscue=true, is already ordered to match the reference text.
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

  // ── Step 1: Pre-process reference text ──────────────────────
  // Replace proper nouns with "yes" before sending to Azure.
  // Azure's en-GB model lacks phoneme models for names like "Devansh" and produces
  // garbage recognition (D, De, Dev...) that breaks alignment for all subsequent words.
  // We score proper noun positions separately with a lenient fixed score.
  const refWords = referenceText.trim().split(/\s+/);
  const properNounMap = {};  // index → original word
  const sanitisedWords = refWords.map((w, i) => {
    if (isProperNoun(w)) {
      properNounMap[i] = w;
      return 'yes';  // Azure knows "yes" reliably
    }
    return w;
  });
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
    properNounsReplaced: Object.values(properNounMap),
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

  // Strip Insertion words — child said extra words not in reference.
  // These consume array slots and break index alignment if kept.
  const aligned = allWords.filter(w =>
    (w.PronunciationAssessment?.ErrorType || 'None') !== 'Insertion'
  );

  // Map sanitised reference words → Azure scores by index (1:1 after insertions removed)
  const wordScores = original.map((origWord, i) => {

    // Proper noun slot — Azure assessed "yes" here, ignore that score.
    // Give a lenient fixed score so child isn't penalised for their name.
    if (properNounMap[i]) {
      return {
        word:        origWord,
        score:       85,
        rawScore:    85,
        errorType:   'None',
        isProperNoun: true,
        note:        'Proper noun — scored leniently (Azure cannot assess names)',
        phonemes:    [],
      };
    }

    const az = aligned[i];
    if (!az) {
      // No Azure word at this position — child omitted it
      return { word: origWord, score: 0, rawScore: 0, errorType: 'Omission', phonemes: [] };
    }

    const rawScore  = Math.round(az.PronunciationAssessment?.AccuracyScore ?? 0);
    const errorType = az.PronunciationAssessment?.ErrorType || 'None';

    return {
      word:      origWord,          // always show original reference word in UI
      score:     rawScore,
      rawScore,
      errorType,
      phonemes: (az.Phonemes || []).map(p => ({
        phoneme: p.Phoneme,
        score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
      })),
    };
  });

  // Overall scores — exclude proper noun positions from accuracy calculation
  // so names don't inflate/deflate the real phonics score
  const scorableWords = wordScores.filter(w => !w.isProperNoun);
  const overallAccuracy = scorableWords.length
    ? Math.round(scorableWords.reduce((s, w) => s + w.score, 0) / scorableWords.length)
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
