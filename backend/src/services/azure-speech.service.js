/**
 * Azure Cognitive Services — Speech
 * Free F0 Tier:
 *   - Speech-to-Text:          5 audio hours / month
 *   - Pronunciation Assessment: included in STT free tier
 *   - Neural TTS:              500,000 characters / month
 *
 * Get a free key: https://portal.azure.com → Create resource → Speech
 * Region recommendations for UK: uksouth or westeurope
 */


const AZURE_KEY    = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'uksouth';

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

  // Determine Content-Type for Azure
  const contentType = mimeType.includes('wav') ? 'audio/wav; codecs=audio/pcm; samplerate=16000'
    : mimeType.includes('webm') ? 'audio/webm; codecs=opus'
    : mimeType.includes('ogg')  ? 'audio/ogg; codecs=opus'
    : 'audio/wav';

  const response = await fetch(`${endpoint}?${params}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': contentType,
      'Pronunciation-Assessment': pronConfigB64,
      'Accept': 'application/json',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure STT error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  return parseAzureResult(result, referenceText);
}

/**
 * Parse Azure Detailed Pronunciation Assessment response
 * into a standardised word-score format
 */
function parseAzureResult(result, referenceText) {
  const nBest = result?.NBest?.[0];
  if (!nBest) {
    // Fallback: Azure returned no result (silence, noise)
    return buildFallback(referenceText, 0);
  }

  const pa = nBest.PronunciationAssessment || {};
  const words = nBest.Words || [];

  // Map Azure words → our format
  const wordScores = words.map(w => ({
    word:       w.Word,
    score:      Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
    fluency:    Math.round(w.PronunciationAssessment?.FluencyScore ?? 0),
    completeness: Math.round(w.PronunciationAssessment?.CompletenessScore ?? 100),
    errorType:  w.PronunciationAssessment?.ErrorType || 'None',  // None | Omission | Insertion | Mispronunciation
    phonemes: (w.Phonemes || []).map(p => ({
      phoneme: p.Phoneme,
      score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
    })),
  }));

  // Fill in any target words not returned by Azure (omissions)
  const targetWords = referenceText.trim().split(/\s+/);
  const paddedScores = targetWords.map((tw, i) => {
    const match = wordScores[i];
    if (match) return match;
    return { word: tw, score: 0, errorType: 'Omission', phonemes: [] };
  });

  return {
    wordScores:           paddedScores,
    overallAccuracy:      Math.round(pa.AccuracyScore    ?? 0),
    overallFluency:       Math.round(pa.FluencyScore     ?? 0),
    overallCompleteness:  Math.round(pa.CompletenessScore?? 0),
    overallProsody:       Math.round(pa.ProsodyScore     ?? 0),
    displayText:          nBest.Display || '',
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
