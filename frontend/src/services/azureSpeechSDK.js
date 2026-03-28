/**
 * @file        azureSpeechSDK.js
 * @description Browser-side Azure Speech SDK pronunciation assessment.
 *              Uses WebSocket streaming (SDK) instead of REST API — far more reliable.
 *              The REST API intermittently ignores the Pronunciation-Assessment header.
 *              The SDK never has this problem because PA is configured on the recognizer.
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   Loads microsoft-cognitiveservices-speech-sdk from the Anthropic CDN.
 *   Requires a short-lived auth token from the backend (/api/speech/token).
 *   Token TTL is 10 minutes — cached here, refreshed automatically.
 */

// ── SDK LOADER ────────────────────────────────────────────────
// Loads the Azure Speech SDK from CDN only when first needed.
let _sdkPromise = null;

function loadSDK() {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise((resolve, reject) => {
    if (window.SpeechSDK) { resolve(window.SpeechSDK); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.36.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle.js';
    s.onload  = () => resolve(window.SpeechSDK);
    s.onerror = () => reject(new Error('Azure Speech SDK failed to load'));
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

// ── TOKEN CACHE ───────────────────────────────────────────────
let _tokenCache = null;   // { token, region, expiresAt }

async function getToken(apiToken) {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 30000) {
    return _tokenCache;
  }
  const rawBase   = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  const withProto = rawBase.startsWith('http') ? rawBase : 'https://' + rawBase;
  const apiBase   = withProto.replace(/\/$/, '').endsWith('/api')
    ? withProto.replace(/\/$/, '')
    : withProto.replace(/\/$/, '') + '/api';

  const res = await fetch(`${apiBase}/speech/token`, {
    headers: { ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) },
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.success || !data.data?.token) throw new Error('Azure not configured on backend');

  _tokenCache = {
    token:     data.data.token,
    region:    data.data.region || 'uksouth',
    expiresAt: now + (data.data.expiresInSeconds || 600) * 1000 - 60000,
  };
  return _tokenCache;
}

// ── MAIN ASSESSMENT FUNCTION ──────────────────────────────────
/**
 * Run Azure Pronunciation Assessment directly in the browser via the SDK.
 *
 * @param {Blob}   audioBlob       - The recorded WebM/WAV audio blob
 * @param {string} referenceText   - The sentence the child should have read
 * @param {string} apiToken        - JWT token for backend auth
 * @param {function} onLog         - Optional callback for debug log entries
 *
 * @returns {{ wordScores, overallAccuracy, overallFluency, overallCompleteness,
 *             overallProsody, displayText, source, azureAssessed, _debug }}
 */
export async function assessWithSDK(audioBlob, referenceText, apiToken, onLog) {
  const log = (msg) => { console.log('[AzureSDK]', msg); onLog?.(msg); };

  // 1. Load SDK
  log('Loading Speech SDK…');
  const SDK = await loadSDK();
  log('SDK loaded ✅');

  // 2. Get auth token
  log('Fetching auth token…');
  const { token, region } = await getToken(apiToken);
  log(`Token OK, region=${region}`);

  // 3. Convert Blob → ArrayBuffer → AudioConfig
  const arrayBuf = await audioBlob.arrayBuffer();
  const uint8    = new Uint8Array(arrayBuf);

  // Build a proper WAV buffer from the audio data
  // The SDK needs raw PCM WAV. We'll convert via AudioContext if available.
  let wavBuffer;
  try {
    const audioCtx  = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const decoded   = await audioCtx.decodeAudioData(arrayBuf);
    wavBuffer       = pcmToWav(decoded);
    await audioCtx.close();
    log(`Audio decoded: ${decoded.duration.toFixed(1)}s, ${decoded.numberOfChannels}ch → WAV PCM 16kHz`);
  } catch (e) {
    log(`AudioContext decode failed (${e.message}) — using raw blob`);
    wavBuffer = arrayBuf;
  }

  // 4. Create SDK objects
  const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = 'en-US';  // en-US required for PA

  const pushStream  = SDK.AudioInputStream.createPushStream(
    SDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
  );
  // Push audio in 4KB chunks
  const chunk = 4096;
  const view  = new Uint8Array(wavBuffer);
  for (let i = 0; i < view.length; i += chunk) {
    pushStream.write(view.subarray(i, i + chunk).buffer);
  }
  pushStream.close();

  const audioConfig = SDK.AudioConfig.fromStreamInput(pushStream);

  // 5. Configure Pronunciation Assessment
  const pronConfig = new SDK.PronunciationAssessmentConfig(
    referenceText,
    SDK.PronunciationAssessmentGradingSystem.HundredMark,
    SDK.PronunciationAssessmentGranularity.Phoneme,
    true   // enableMiscue
  );
  pronConfig.phonemeAlphabet = 'IPA';

  const recognizer = new SDK.SpeechRecognizer(speechConfig, audioConfig);
  pronConfig.applyTo(recognizer);

  // 6. Run assessment — returns a Promise
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      recognizer.close();
      reject(new Error('SDK assessment timed out after 30s'));
    }, 30000);

    recognizer.recognizeOnceAsync(
      (result) => {
        clearTimeout(timeout);
        recognizer.close();

        if (result.reason === SDK.ResultReason.NoMatch) {
          log('NoMatch — no speech detected');
          resolve(null);
          return;
        }
        if (result.reason !== SDK.ResultReason.RecognizedSpeech) {
          log(`Recognition failed: reason=${result.reason}`);
          resolve(null);
          return;
        }

        const pa    = SDK.PronunciationAssessmentResult.fromResult(result);
        const words = result.properties.getProperty(
          SDK.PropertyId.SpeechServiceResponse_JsonResult
        );
        let jsonResult = null;
        try { jsonResult = JSON.parse(words); } catch {}

        log(`PA result: accuracy=${pa.accuracyScore} fluency=${pa.fluencyScore} complete=${pa.completenessScore}`);

        // Map SDK result to our wordScores format
        const nBest    = jsonResult?.NBest?.[0];
        const rawWords = nBest?.Words || [];

        const refWords = referenceText.trim().split(/\s+/);
        const wordScores = refWords.map((refWord, i) => {
          const clean = refWord.replace(/[.,!?;:'"]/g, '').toLowerCase();
          // Find matching SDK word
          const sdkWord = rawWords.find(w =>
            w.Word?.toLowerCase().replace(/[.,!?;:'"]/g, '') === clean
          ) || rawWords[i];

          const wpa   = sdkWord?.PronunciationAssessment || {};
          const score = Math.round(wpa.AccuracyScore ?? 0);

          return {
            word:      refWord,
            score,
            rawScore:  score,
            errorType: wpa.ErrorType || (score >= 85 ? 'None' : 'Mispronunciation'),
            phonemes:  (sdkWord?.Phonemes || []).map(p => ({
              phoneme: p.Phoneme,
              score:   Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
            })),
          };
        });

        const overallAccuracy = pa.accuracyScore != null
          ? Math.round(pa.accuracyScore)
          : wordScores.length
            ? Math.round(wordScores.reduce((s, w) => s + w.score, 0) / wordScores.length)
            : 0;

        resolve({
          wordScores,
          overallAccuracy,
          overallFluency:      Math.round(pa.fluencyScore      ?? overallAccuracy),
          overallCompleteness: Math.round(pa.completenessScore ?? 100),
          overallProsody:      Math.round(pa.prosodyScore      ?? 0),
          displayText:         result.text,
          source:              'azure',
          azureAssessed:       true,
          _debug: {
            sdkUsed:          true,
            accuracyScore:    pa.accuracyScore,
            fluencyScore:     pa.fluencyScore,
            completenessScore:pa.completenessScore,
            prosodyScore:     pa.prosodyScore,
            displayText:      result.text,
            nBestPAPresent:   !!nBest?.PronunciationAssessment,
            region,
          },
        });
      },
      (err) => {
        clearTimeout(timeout);
        recognizer.close();
        log(`SDK error: ${err}`);
        reject(new Error(String(err)));
      }
    );
  });
}

// ── PCM WAV BUILDER ───────────────────────────────────────────
function pcmToWav(audioBuffer) {
  const numCh   = 1;  // mono
  const sr      = 16000;
  const pcm     = downsampleTo16k(audioBuffer);
  const dataLen = pcm.length * 2;  // 16-bit = 2 bytes per sample
  const buf     = new ArrayBuffer(44 + dataLen);
  const view    = new DataView(buf);

  const writeStr = (off, str) => { for (let i=0;i<str.length;i++) view.setUint8(off+i, str.charCodeAt(i)); };
  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + dataLen, true);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);       // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);

  let offset = 44;
  for (const s of pcm) {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
    offset += 2;
  }
  return buf;
}

function downsampleTo16k(audioBuffer) {
  const src      = audioBuffer.getChannelData(0);  // mono: use first channel
  const srcRate  = audioBuffer.sampleRate;
  if (srcRate === 16000) return src;
  const ratio    = srcRate / 16000;
  const outLen   = Math.floor(src.length / ratio);
  const out      = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = src[Math.floor(i * ratio)];
  }
  return out;
}

export function clearTokenCache() { _tokenCache = null; }
