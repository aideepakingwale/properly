/**
 * @file        azure-speech.service.js
 * @description Azure Cognitive Services wrapper — Pronunciation Assessment (STT) and Neural TTS (en-GB-SoniaNeural)
 * @module      Azure Speech
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - toWavPcm16k() uses ffmpeg to convert browser WebM/Opus → WAV PCM 16kHz 16-bit mono before Azure STT
 *   - Free F0 tier: 5 audio hours/month STT, 500K chars/month TTS
 *   - Azure REST endpoint used (not SDK) for minimal dependency footprint
 */

const AZURE_KEY    = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'uksouth';

/**
 * Convert any audio buffer to WAV PCM 16kHz 16-bit mono — what Azure requires.
 * Uses ffmpeg (available on Render.com and all Linux hosts).
 * Falls back to returning original buffer if ffmpeg unavailable.
 */
async function toWavPcm16k(inputBuffer, inputMime) {
  const { execFileSync } = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const { randomBytes } = await import('crypto');

  const id  = randomBytes(8).toString('hex');
  const ext = inputMime?.includes('webm') ? 'webm'
            : inputMime?.includes('ogg')  ? 'ogg'
            : inputMime?.includes('mp4')  ? 'mp4'
            : 'wav';
  const inFile  = join(tmpdir(), `az_in_${id}.${ext}`);
  const outFile = join(tmpdir(), `az_out_${id}.wav`);

  try {
    writeFileSync(inFile, inputBuffer);
    execFileSync('ffmpeg', [
      '-y',                          // overwrite output
      '-i', inFile,                  // input
      '-ar', '16000',                // resample to 16kHz
      '-ac', '1',                    // mono
      '-acodec', 'pcm_s16le',        // 16-bit signed PCM little-endian
      '-f', 'wav',                   // WAV container
      outFile,
    ], { stdio: 'pipe', timeout: 15000 });
    const wavBuffer = readFileSync(outFile);
    return wavBuffer;
  } catch (e) {
    console.warn('ffmpeg conversion failed, sending original audio:', e.message);
    return inputBuffer; // best-effort fallback
  } finally {
    try { unlinkSync(inFile);  } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

/** Returns true if Azure is configured */
export function azureAvailable() {
  return Boolean(AZURE_KEY && AZURE_KEY !== 'your-azure-speech-key-here');
}

/**
 * Pronunciation Assessment via Azure REST API
 * Accepts a WAV/OGG/WebM buffer, returns word-level accuracy scores.
 *
 * @param {Buffer} audioBuffer  - Raw audio bytes
 * @param {string} referenceText - The sentence the child should have read
 * @param {string} mimeType      - 'audio/wav' | 'audio/webm' | 'audio/ogg'
 * @returns {Promise<{wordScores, overallAccuracy, overallFluency, overallCompleteness, phonemeDetails}>}
 */
export async function assessPronunciation(audioBuffer, referenceText, mimeType = 'audio/wav') {
  if (!azureAvailable()) {
    throw new Error('Azure Speech not configured');
  }

  // Azure Pronunciation Assessment REST API
  // Docs: https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text
  const endpoint = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;

  // Convert audio to WAV PCM 16kHz mono — Azure REST API requires this format.
  // Avoids 500 errors caused by WebM/OGG at browser sample rates (48kHz).
  let audioToSend = audioBuffer;
  let mimeToSend  = 'audio/wav';
  if (!mimeType.includes('wav') || mimeType.includes('16000') === false) {
    audioToSend = await toWavPcm16k(audioBuffer, mimeType);
    mimeToSend  = 'audio/wav';
  }

  // Pronunciation Assessment configuration (JSON, base64-encoded)
  const pronConfig = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',        // word + phoneme level scores
    EnableMiscue: true,            // detect skipped/added words
    EnableProsodyAssessment: true, // rhythm and stress
  };
  const pronConfigB64 = Buffer.from(JSON.stringify(pronConfig)).toString('base64');

  const params = new URLSearchParams({
    language: 'en-GB',
    format: 'detailed',
  });

  const requestedAt = new Date().toISOString();
  const response = await fetch(`${endpoint}?${params}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'audio/wav',
      'Pronunciation-Assessment': pronConfigB64,
      'Accept': 'application/json',
    },
    body: audioToSend,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure STT error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const parsed = parseAzureResult(result, referenceText);

  // Attach debug info (stripped before sending to client unless debug mode on)
  parsed._debug = {
    requestedAt,
    endpoint:      `${endpoint}?${params}`,
    audioSizeKb:   (audioToSend.length / 1024).toFixed(1),
    audioMime:     mimeToSend,
    referenceText,
    pronConfig,
    azureRawResponse: result,
  };

  return parsed;
}

/**
 * Parse Azure Detailed Pronunciation Assessment response
 * into a standardised word-score format.
 *
 * KEY FIX: With EnableMiscue=true, Azure's Words array already aligns to
 * the reference text words. Insertion words (extra words the child said that
 * aren't in the reference) must be filtered BEFORE index-based alignment —
 * otherwise they consume array slots and shift all subsequent words out of
 * alignment (e.g. "Devansh" split into "D","De","Dev" shifts "saves","the","town").
 *
 * Alignment strategy:
 *   1. Strip Insertion words from Azure's array
 *   2. Remaining words align 1:1 with reference words in order
 *   3. Any reference word not covered → score 0 (Omission)
 */
function parseAzureResult(result, referenceText) {
  const nBest = result?.NBest?.[0];
  if (!nBest) {
    return buildFallback(referenceText, 0);
  }

  const pa    = nBest.PronunciationAssessment || {};
  const allWords = nBest.Words || [];

  // Step 1: Separate inserted words (not in reference) from reference-aligned words
  // Insertion = child said an extra word; all others map to reference text words
  const refAligned  = allWords.filter(w =>
    (w.PronunciationAssessment?.ErrorType || 'None') !== 'Insertion'
  );

  // Step 2: Map reference-aligned Azure words → our format
  const azureByRef = refAligned.map(w => ({
    word:         w.Word,
    score:        Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
    fluency:      Math.round(w.PronunciationAssessment?.FluencyScore ?? 0),
    completeness: Math.round(w.PronunciationAssessment?.CompletenessScore ?? 100),
    errorType:    w.PronunciationAssessment?.ErrorType || 'None',
    phonemes: (w.Phonemes || []).map(p => ({
      phoneme: p.Phoneme,
      score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
    })),
  }));

  // Step 3: Align to reference words 1:1 (now safe because Insertions are removed)
  const targetWords  = referenceText.trim().split(/\s+/);
  const wordScores   = targetWords.map((tw, i) => {
    const az = azureByRef[i];
    if (az) {
      // Use reference word text (not Azure's recognised text) so UI always shows
      // the correct word — Azure may recognise "Devansh" as "Devansh" or similar
      return { ...az, word: tw };
    }
    // Word not returned by Azure at all — child omitted it
    return { word: tw, score: 0, errorType: 'Omission', phonemes: [] };
  });

  return {
    wordScores,
    overallAccuracy:     Math.round(pa.AccuracyScore     ?? 0),
    overallFluency:      Math.round(pa.FluencyScore      ?? 0),
    overallCompleteness: Math.round(pa.CompletenessScore ?? 0),
    overallProsody:      Math.round(pa.ProsodyScore      ?? 0),
    displayText:         nBest.Display || '',
    // Raw Azure data passed through for debug mode
    _azureRaw: { nBest: nBest, allWords, refAligned },
  };
}

function buildFallback(referenceText, score) {
  return {
    wordScores: referenceText.trim().split(/\s+/).map(w => ({ word: w, score, errorType: 'None', phonemes: [] })),
    overallAccuracy: score, overallFluency: score, overallCompleteness: score, overallProsody: score,
    displayText: '',
  };
}

/**
 * Azure Neural TTS — returns audio buffer (MP3)
 * Free tier: 500,000 characters/month (Neural voices)
 * UK voice: en-GB-SoniaNeural (warm, friendly)
 */
export async function synthesizeSpeech(text, voice = 'en-GB-SoniaNeural') {
  if (!azureAvailable()) throw new Error('Azure TTS not configured');

  const endpoint = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
      <voice name="${voice}">
        <prosody rate="0.9" pitch="+5%">${escapeXml(text)}</prosody>
      </voice>
    </speak>`.trim();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS error: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

/**
 * Get a short-lived Azure SAS token for direct browser streaming
 * (Token Vending Machine pattern from SRS NFR2.2)
 * Token is valid for 10 minutes — browser can use it directly
 */
export async function getAzureSasToken() {
  if (!azureAvailable()) return null;
  const endpoint = `https://${AZURE_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
  });
  if (!response.ok) return null;
  const token = await response.text();
  return { token, region: AZURE_REGION, expiresInSeconds: 600 };
}
