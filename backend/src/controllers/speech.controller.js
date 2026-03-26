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
import { assessPronunciation, azureAvailable, getAzureSasToken, assessWithGroqWhisper, groqAvailable } from '../services/azure-speech.service.js';

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

      const debugInfo = (debugMode && result._debug) ? result._debug : undefined;
      const { _debug, ...pub } = result;

      return res.json({
        success: true,
        data: {
          ...pub,
          source:        'groq-whisper',
          azureAssessed: false,
          groqAssessed:  true,
          ...(debugInfo && { _debugInfo: debugInfo }),
        },
      });
    } catch (err) {
      console.error('[Speech] Groq Whisper failed:', err.message);
      // Fall through to text-comparison
    }
  }

  // ── 3. TEXT-COMPARISON FALLBACK ───────────────────────────────
  // Used when Azure not configured OR when Azure fails.
  // Requires browser Web Speech API transcript.
  if (transcript && transcript.trim()) {
    const wordScores = scoreWords(transcript, referenceText);
    const accuracy   = avg(wordScores.map(w => w.score));
    return res.json({
      success: true,
      data: {
        wordScores,
        overallAccuracy:     accuracy,
        overallFluency:      accuracy,
        overallCompleteness: transcript ? 95 : 0,
        overallProsody:      0,
        displayText:         transcript,
        source:              'text-comparison',
        azureAssessed:       false,
      },
    });
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
