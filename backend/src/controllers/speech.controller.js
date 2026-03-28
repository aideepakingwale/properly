/**
 * @file        speech.controller.js
 * @description POST /api/speech/assess — receives child's audio, runs Azure Pronunciation Assessment,
 *              falls back to text-comparison if Azure unavailable.
 * @module      Speech
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import multer from 'multer';
import getDb from '../db/database.js';
import { assessPronunciation, azureAvailable, getAzureSasToken, assessWithGroqWhisper, groqAvailable, synthesisePhoneme } from '../services/azure-speech.service.js';

// Multer: store audio in memory (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('audio/') ||
               /\.(wav|webm|ogg|mp3|m4a)$/i.test(file.originalname);
    cb(null, ok);
  },
});
export const uploadMiddleware = upload.single('audio');

export const assessSpeech = async (req, res) => {
  const { referenceText, transcript } = req.body;
  // Log what we received so we can trace stale-reference bugs
  console.log(`\n[Speech] ===== NEW ASSESSMENT REQUEST =====`);
  console.log(`[Speech] referenceText: "${referenceText}"`);
  console.log(`[Speech] audio size: ${req.file?.buffer?.length} bytes`);
  console.log(`[Speech] mime: ${req.file?.mimetype}`);
  if (!referenceText) {
    return res.status(400).json({ success: false, message: 'referenceText required' });
  }

  // Debug mode check
  let debugMode = false;
  try {
    const db  = getDb();
    const row = db.prepare("SELECT value FROM app_settings WHERE key='debug_mode'").get();
    debugMode = row?.value === 'true';
  } catch {}

  // ── 1. AZURE PRONUNCIATION ASSESSMENT ────────────────────────
  let azureError = null;  // captured for debug panel if Azure fails
  if (azureAvailable() && req.file?.buffer) {
    const audioBytes = req.file.buffer.length;
    console.log(`[Speech] Azure assess: ${audioBytes} bytes ${req.file.mimetype} → "${referenceText.slice(0,40)}…"`);

    if (audioBytes < 500) {
      console.warn('[Speech] Audio too small — child may not have spoken');
      return res.json({
        success: true,
        data: {
          wordScores:          wordsAsFallback(referenceText, 0),
          overallAccuracy:     0,
          overallFluency:      0,
          overallCompleteness: 0,
          displayText:         '',
          source:              'too-short',
          azureAssessed:       false,
          message:             'Audio too short — ask the child to speak clearly into the microphone',
        },
      });
    }

    try {
      const result = await assessPronunciation(
        req.file.buffer,
        referenceText,
        req.file.mimetype || 'audio/webm',
      );

      const debugInfo = (debugMode && result._debug) ? result._debug : undefined;
      const { _debug, allOmitted, ...pub } = result;

      // If Azure ran but recognised nothing (all words Omitted/0%) — technical failure
      // Show "couldn't hear" rather than fake-passing with 0% scores
      if (allOmitted) {
        return res.json({
          success: true,
          data: {
            ...pub,
            source:        'azure',
            azureAssessed: false,
            noAssessment:  true,
            message:       'Could not hear your voice clearly — speak louder and closer to the microphone 🎙️',
            ...(debugInfo && { _debugInfo: debugInfo }),
          },
        });
      }

      return res.json({
        success: true,
        data: {
          ...pub,
          source:        'azure',
          azureAssessed: true,
          ...(debugInfo && { _debugInfo: debugInfo }),
        },
      });
    } catch (err) {
      console.error('[Speech] Azure pipeline failed:', err.message);

      // If ffmpeg missing — return specific guidance, don't silently score 0
      if (err.message?.includes('ffmpeg')) {
        return res.json({
          success: true,
          data: {
            wordScores:          wordsAsFallback(referenceText, 0),
            overallAccuracy:     0,
            overallFluency:      0,
            overallCompleteness: 0,
            displayText:         '',
            source:              'ffmpeg-missing',
            azureAssessed:       false,
            noAssessment:        true,
            message:             'Audio conversion failed — ffmpeg not installed. Add "apt-get install -y ffmpeg" to Render build command.',
          },
        });
      }
      // Other Azure errors — fall through to text-comparison
    }
  } else if (azureAvailable() && !req.file) {
    console.warn('[Speech] Azure configured but no audio file received');
  }

  // ── 2. GROQ WHISPER FALLBACK ──────────────────────────────────
  // Free, no ffmpeg, works on iOS/Android. Uses word-level timestamps + confidence.
  if (groqAvailable() && req.file?.buffer) {
    try {
      console.log('[Speech] Trying Groq Whisper fallback…');
      const result = await assessWithGroqWhisper(
        req.file.buffer,
        referenceText,
        req.file.mimetype || 'audio/webm'
      );

      const { _debug: groqDebug, ...pub } = result;
      const azureFailed = typeof azureError !== 'undefined' ? azureError : null;

      return res.json({
        success: true,
        data: {
          ...pub,
          source:        'groq-whisper',
          azureAssessed: false,
          groqAssessed:  true,
          _debugInfo:    {
            ...(groqDebug || {}),
            azureFailed,
            source:  'groq-whisper',
            blobKB:  (req.file.buffer.length / 1024).toFixed(1),
            mime:    req.file.mimetype,
          },
        },
      });
    } catch (err) {
      console.error('[Speech] Groq Whisper failed:', err.message);
      // Fall through to text-comparison
    }
  }

  // ── 3. TEXT-COMPARISON FALLBACK ───────────────────────────────
  if (transcript && transcript.trim()) {
    // Validate transcript is about the current reference (Jaccard similarity)
    const refTokens     = new Set(referenceText.toLowerCase().replace(/[.,!?;:'"]/g,'').split(/\s+/).filter(w=>w.length>2));
    const spokenTokens  = transcript.toLowerCase().replace(/[.,!?;:'"]/g,'').split(/\s+/).filter(w=>w.length>2);
    const overlapCount  = spokenTokens.filter(w=>refTokens.has(w)).length;
    const jaccard       = refTokens.size > 0 ? overlapCount / refTokens.size : 0;
    const staleTranscript = jaccard === 0 && refTokens.size > 2;

    if (staleTranscript) {
      console.warn(`[Speech] text-comparison: transcript appears stale (0% overlap). transcript="${transcript.slice(0,50)}" ref="${referenceText.slice(0,50)}"`);
      // Fall through to no-assessment rather than give misleading 100% scores
    } else {
      const wordScores = scoreWords(transcript, referenceText);
      const accuracy   = avg(wordScores.map(w => w.score));
      // Cap accuracy if sentence similarity is low
      const cappedAccuracy = jaccard < 0.25 ? Math.min(accuracy, 20) : accuracy;
      return res.json({
        success: true,
        data: {
          wordScores,
          overallAccuracy:     cappedAccuracy,
          overallFluency:      cappedAccuracy,
          overallCompleteness: jaccard > 0.3 ? 95 : Math.round(jaccard * 100),
          overallProsody:      0,
          displayText:         transcript,
          source:              'text-comparison',
          azureAssessed:       false,
          sentenceSimilarity:  Math.round(jaccard * 100),
          wrongSentence:       jaccard < 0.25,
        },
      });
    }
  }

  // ── 4. NO SCORING AVAILABLE ───────────────────────────────────
  // Azure not configured + no browser transcript (iOS Safari, Firefox, etc.)
  // Return honest 0 scores so the child knows they need to try again,
  // rather than fake 75% scores that suggest success.
  return res.json({
    success: true,
    data: {
      wordScores:          wordsAsFallback(referenceText, 0),
      overallAccuracy:     0,
      overallFluency:      0,
      overallCompleteness: 0,
      overallProsody:      0,
      displayText:         '',
      source:              'no-assessment',
      azureAssessed:       false,
      noAssessment:        true,
      message:             azureAvailable() || groqAvailable()
        ? 'Audio not received — check microphone permissions'
        : 'Add AZURE_SPEECH_KEY or GROQ_API_KEY in Render settings for real phonics scoring',
    },
  });
};

export const getSpeechToken = async (req, res) => {
  if (!azureAvailable()) {
    return res.json({ success: true, data: { available: false, message: 'Azure not configured' } });
  }
  try {
    const tok = await getAzureSasToken();
    res.json({ success: true, data: { available: true, ...tok } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getSpeechStatus = (_req, res) => {
  res.json({
    success: true,
    data: {
      azure: {
        available: azureAvailable(),
        region:    process.env.AZURE_SPEECH_REGION || 'uksouth',
        freeTier:  'F0: 5 audio hours/month STT + 500K chars/month TTS',
      },
      gemini: {
        available: Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your-')),
        role:      'Mrs. Owl coaching tips + phonetic name lookup',
      },
      groq: {
        available:    Boolean(process.env.GROQ_API_KEY),
        role:         'Mrs. Owl coaching tips + pronunciation assessment fallback (Whisper)',
        whisper:      groqAvailable() ? 'whisper-large-v3-turbo — free tier, word-level scoring' : 'not configured',
      },
    },
  });
};

// ── HELPERS ───────────────────────────────────────────────────
function wordsAsFallback(referenceText, score) {
  return referenceText.trim().split(/\s+/).map(w => ({
    word: w, score, rawScore: score, errorType: score === 0 ? 'Omission' : 'None', phonemes: [],
  }));
}

function scoreWords(spoken, target) {
  const sp = spoken.toLowerCase().replace(/[.,!?;:'"]/g, '').trim().split(/\s+/);
  return target.trim().split(/\s+/).map((word, i) => {
    const clean = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
    const said  = (sp[i] || '').toLowerCase();
    if (!said)          return { word, score: 0,   rawScore: 0,   errorType: 'Omission',        phonemes: [] };
    if (said === clean) return { word, score: 100, rawScore: 100, errorType: 'None',             phonemes: [] };
    const len   = Math.max(said.length, clean.length, 1);
    let match = 0;
    for (let j = 0; j < Math.min(said.length, clean.length); j++) {
      if (said[j] === clean[j]) match++;
    }
    const score = Math.round((match / len) * 100);
    return { word, score, rawScore: score, errorType: 'Mispronunciation', phonemes: [] };
  });
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

/**
 * POST /api/speech/test-azure
 * Sends a pre-recorded silent WAV to Azure to test connectivity.
 * Returns the raw Azure response so admin can see exactly what's happening.
 */
export const testAzureConnectivity = async (req, res) => {
  if (!azureAvailable()) {
    return res.json({ success: false, message: 'AZURE_SPEECH_KEY not configured' });
  }

  const key    = (process.env.AZURE_SPEECH_KEY || '').trim();
  const region = (process.env.AZURE_SPEECH_REGION || 'uksouth').trim();

  // Minimal valid WAV header: 44 bytes header + 3200 bytes of silence (0.1s @ 16kHz PCM16)
  const sampleRate = 16000, bitsPerSample = 16, numChannels = 1;
  const dataSize   = 3200;
  const header     = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  const silentWav = Buffer.concat([header, Buffer.alloc(dataSize)]);

  const pronConfig = {
    ReferenceText: 'the cat sat', GradingSystem: 'HundredMark',
    Granularity: 'Phoneme', EnableMiscue: true, PhonemeAlphabet: 'IPA',
  };

  try {
    const endpoint = `https://\${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    const params   = new URLSearchParams({ language: 'en-US', format: 'detailed' });
    const r = await fetch(`\${endpoint}?\${params}`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type':              'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment':  Buffer.from(JSON.stringify(pronConfig)).toString('base64'),
      },
      body: silentWav,
      signal: AbortSignal.timeout(15000),
    });

    const status = r.status;
    const body   = await r.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }

    res.json({
      success: true,
      data: {
        httpStatus:          status,
        keyPreview:          key.slice(0,4) + '****' + key.slice(-4),
        region,
        wavSentKB:           (silentWav.length / 1024).toFixed(1),
        contentType:         'audio/wav; codecs=audio/pcm; samplerate=16000',
        azureResponse:       parsed,
        interpretation:      status === 401 ? '❌ Invalid key' :
                             status === 403 ? '❌ Key forbidden — check region' :
                             status === 400 ? '⚠️ Bad request — check Content-Type' :
                             parsed.RecognitionStatus === 'InitialSilenceTimeout' ? '✅ Key works! (Silence = no speech detected — expected)' :
                             parsed.RecognitionStatus === 'NoMatch' ? '✅ Key works! (No match — expected for silence)' :
                             parsed.RecognitionStatus === 'Success' ? '✅ Success!' : `Status: \${parsed.RecognitionStatus}`,
      },
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
};

// ── PHONEME PRELOAD ───────────────────────────────────────────
const PHONEME_LIST = [
  { ipa: 'p', grapheme: 'p' }, { ipa: 'b', grapheme: 'b' },
  { ipa: 't', grapheme: 't' }, { ipa: 'd', grapheme: 'd' },
  { ipa: 'k', grapheme: 'c' }, { ipa: 'g', grapheme: 'g' },
  { ipa: 'f', grapheme: 'f' }, { ipa: 'v', grapheme: 'v' },
  { ipa: 's', grapheme: 's' }, { ipa: 'z', grapheme: 'z' },
  { ipa: 'ʃ', grapheme: 'sh'}, { ipa: 'h', grapheme: 'h' },
  { ipa: 'ð', grapheme: 'th'}, { ipa: 'θ', grapheme: 'th'},
  { ipa: 'tʃ', grapheme: 'ch'}, { ipa: 'dʒ', grapheme: 'j' },
  { ipa: 'm', grapheme: 'm' }, { ipa: 'n', grapheme: 'n' },
  { ipa: 'ŋ', grapheme: 'ng'}, { ipa: 'l', grapheme: 'l' },
  { ipa: 'r', grapheme: 'r' }, { ipa: 'w', grapheme: 'w' },
  { ipa: 'j', grapheme: 'y' }, { ipa: 'kw', grapheme: 'qu'},
  { ipa: 'ks', grapheme: 'x' },
  { ipa: 'æ', grapheme: 'a' }, { ipa: 'ɛ', grapheme: 'e' },
  { ipa: 'ɪ', grapheme: 'i' }, { ipa: 'ɒ', grapheme: 'o' },
  { ipa: 'ʌ', grapheme: 'u' }, { ipa: 'ʊ', grapheme: 'oo'},
  { ipa: 'ə', grapheme: 'a' },
  { ipa: 'eɪ', grapheme: 'ai' }, { ipa: 'iː', grapheme: 'ee' },
  { ipa: 'aɪ', grapheme: 'igh'}, { ipa: 'əʊ', grapheme: 'oa' },
  { ipa: 'uː', grapheme: 'oo' }, { ipa: 'aʊ', grapheme: 'ow' },
  { ipa: 'ɔɪ', grapheme: 'oi' }, { ipa: 'ɑː', grapheme: 'ar' },
  { ipa: 'ɔː', grapheme: 'or' }, { ipa: 'ɜː', grapheme: 'ur' },
  { ipa: 'juː', grapheme: 'ue'}, { ipa: 'ɪə', grapheme: 'ear'},
  { ipa: 'eə', grapheme: 'air'}, { ipa: 'ʊə', grapheme: 'ure'},
];

export const preloadPhonemes = async (req, res) => {
  if (!azureAvailable()) {
    return res.json({ success: false, message: 'Azure TTS not configured', data: { phonemes: {} } });
  }
  res.setTimeout(30000);
  const results = {};
  const errors  = [];
  const BATCH   = 6;
  for (let i = 0; i < PHONEME_LIST.length; i += BATCH) {
    await Promise.allSettled(
      PHONEME_LIST.slice(i, i + BATCH).map(async ({ ipa, grapheme }) => {
        try {
          const buf = await synthesisePhoneme(ipa, grapheme, 0.55);
          results[ipa] = buf.toString('base64');
        } catch (e) {
          errors.push({ ipa, error: e.message });
        }
      })
    );
  }
  console.log(`[Phoneme Preload] ${Object.keys(results).length}/${PHONEME_LIST.length} generated, ${errors.length} errors`);
  res.json({ success: true, data: { phonemes: results, count: Object.keys(results).length, errors, generatedAt: new Date().toISOString() } });
};

export const getPhoneme = async (req, res) => {
  const { ipa, grapheme, rate = 0.55 } = req.body;
  if (!ipa || !grapheme) return res.status(400).json({ success: false, message: 'ipa and grapheme required' });
  if (!azureAvailable()) return res.status(503).json({ success: false, message: 'Azure TTS not configured' });
  try {
    const buf = await synthesisePhoneme(ipa, grapheme, rate);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(buf);
  } catch (e) {
    console.error('[Phoneme TTS]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * GET /api/speech/test-pa
 * Tests Pronunciation Assessment with a programmatically generated WAV
 * (440Hz sine wave tone = clearly not speech → should return InitialSilenceTimeout or NoMatch)
 * vs real speech through Azure TTS.
 * This isolates whether PA works at all with our key/region.
 */
export const testPronunciationAssessment = async (req, res) => {
  if (!azureAvailable()) {
    return res.json({ success: false, message: 'AZURE_SPEECH_KEY not set' });
  }

  const key    = (process.env.AZURE_SPEECH_KEY    || '').trim();
  const region = (process.env.AZURE_SPEECH_REGION || 'uksouth').trim();

  // Build a real speech WAV using Azure TTS so we KNOW the audio is valid
  // This tests: can we synthesise speech AND assess it in one round-trip?
  try {
    // Step 1: Generate "the cat sat" via Azure TTS
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
      <voice name="en-GB-SoniaNeural"><prosody rate="0.85">the cat sat on the mat</prosody></voice>
    </speak>`.trim();

    const ttsRes = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      { method: 'POST', headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',  // WAV PCM directly!
      }, body: ssml }
    );

    if (!ttsRes.ok) {
      return res.json({ success: false, step: 'tts', status: ttsRes.status, error: await ttsRes.text().catch(()=>'') });
    }
    const wavBuf = Buffer.from(await ttsRes.arrayBuffer());

    // Step 2: Run PA on the TTS output
    const pronConfig = {
      ReferenceText:   'the cat sat on the mat',
      GradingSystem:   'HundredMark',
      Granularity:     'Phoneme',
      EnableMiscue:    true,
      PhonemeAlphabet: 'IPA',
    };
    const pronB64 = Buffer.from(JSON.stringify(pronConfig)).toString('base64').replace(/[\r\n\s=]/g, '');

    const paRes = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/interactive/cognitiveservices/v1?language=en-US&format=detailed`,
      { method: 'POST', headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type':              'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment':  pronB64,
        'Accept':                    'application/json',
      }, body: wavBuf, signal: AbortSignal.timeout(20000) }
    );

    const paStatus = paRes.status;
    const paBody   = await paRes.json().catch(async () => ({ raw: await paRes.text().catch(()=>'') }));
    const nb       = paBody?.NBest?.[0];
    const paResult = nb?.PronunciationAssessment;

    res.json({
      success: true,
      data: {
        wavKB:              (wavBuf.length / 1024).toFixed(1),
        paHttpStatus:       paStatus,
        recognitionStatus:  paBody.RecognitionStatus,
        displayText:        paBody.DisplayText,
        nBestCount:         paBody.NBest?.length ?? 0,
        paPresent:          !!paResult,
        accuracyScore:      paResult?.AccuracyScore,
        fluencyScore:       paResult?.FluencyScore,
        word0:              nb?.Words?.[0]?.Word,
        word0PA:            !!nb?.Words?.[0]?.PronunciationAssessment,
        word0Score:         nb?.Words?.[0]?.PronunciationAssessment?.AccuracyScore,
        pronConfigB64:      pronB64,
        pronConfigDecoded:  pronConfig,
        region,
        keyPreview:         key.slice(0,4) + '****' + key.slice(-4),
        interpretation:     paResult
          ? `✅ PA WORKS! Accuracy=${paResult.AccuracyScore} Fluency=${paResult.FluencyScore}`
          : paBody.RecognitionStatus === 'Success'
            ? '❌ PA MISSING — header ignored. Check region/tier support.'
            : `⚠️ ${paBody.RecognitionStatus}`,
      },
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
};
