/**
 * @file        speech.controller.js
 * @description Speech assessment controller — receives audio, converts to WAV via ffmpeg, submits to Azure Pronunciation Assessment
 * @module      Speech
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - ffmpeg converts any browser audio (WebM/Opus 48kHz) to WAV PCM 16kHz before Azure submission
 *   - Falls back to text-comparison scoring when Azure is unavailable
 *   - Multer stores audio in memory (not disk) — max 10MB per file
 */

import multer from 'multer';
import getDb from '../db/database.js';
import { assessPronunciation, azureAvailable, getAzureSasToken } from '../services/azure-speech.service.js';

// Multer: store audio in memory (max 10MB — a reading sentence is tiny)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept both bare and codec-qualified MIME types (browsers vary)
    const allowed = ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
                      'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm;codecs=pcm'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.match(/\.(wav|webm|ogg|mp3|m4a)$/i));
  },
});

export const uploadMiddleware = upload.single('audio');

/**
 * POST /api/speech/assess
 * Body (multipart/form-data):
 *   audio        : audio file (WAV / WebM / OGG)
 *   referenceText: the sentence the child should have read
 *
 * Returns word-level pronunciation scores.
 * Falls back to text-comparison scoring if Azure not configured.
 */
export const assessSpeech = async (req, res) => {
  const { referenceText, transcript } = req.body;

  if (!referenceText) {
    return res.status(400).json({ success: false, message: 'referenceText is required' });
  }

  // Check if debug mode is enabled in app settings
  let debugMode = false;
  try {
    const db = getDb();
    const setting = db.prepare("SELECT value FROM app_settings WHERE key='debug_mode'").get();
    debugMode = setting?.value === 'true';
  } catch {}

  // ── AZURE PRONUNCIATION ASSESSMENT ───────────────────────────
  if (azureAvailable() && req.file) {
    try {
      const result = await assessPronunciation(
        req.file.buffer,
        referenceText,
        req.file.mimetype || 'audio/wav'
      );

      // Extract debug info before stripping private fields
      const debugInfo = debugMode ? result._debug : undefined;

      // Strip internal fields before sending to client
      const { _debug, _azureRaw, ...publicResult } = result;

      return res.json({
        success: true,
        data: {
          ...publicResult,
          source: 'azure',
          azureAssessed: true,
          // Only include raw debug data when debug mode is on
          ...(debugInfo && { _debugInfo: debugInfo }),
        },
      });
    } catch (err) {
      console.error('Azure assessment failed, falling back to text scoring:', err.message);
      // Fall through to text-comparison fallback
    }
  }

  // ── FALLBACK: TEXT-COMPARISON SCORING ────────────────────────
  // Used when Azure is not configured or call failed.
  // Requires browser Web Speech transcript sent alongside the audio blob.
  // If no transcript available, scores all words as 75 (generous pass) so
  // children are not penalised when Azure is not set up.
  if (!transcript) {
    // No transcript — Azure not configured and no browser STT result
    // Give generous scores so the child can still progress
    const targetWords = referenceText.trim().split(/\s+/);
    const wordScores = targetWords.map(w => ({
      word: w, score: 75, errorType: 'None', phonemes: []
    }));
    return res.json({
      success: true,
      data: {
        wordScores,
        overallAccuracy:     75,
        overallFluency:      75,
        overallCompleteness: 75,
        overallProsody:      75,
        displayText:         '',
        source:              'no-transcript',
        azureAssessed:       false,
        message:             'Add AZURE_SPEECH_KEY or GEMINI_API_KEY for real scoring',
      },
    });
  }

  // Transcript available — do word-level text comparison
  const spokenText = transcript;
  const wordScores = scoreWords(spokenText, referenceText);
  const accuracy   = computeAccuracy(wordScores);

  return res.json({
    success: true,
    data: {
      wordScores,
      overallAccuracy:     accuracy,
      overallFluency:      accuracy,
      overallCompleteness: spokenText ? 100 : 0,
      displayText:         spokenText,
      source:              'text-comparison',
      azureAssessed:       false,
    },
  });
};

/**
 * GET /api/speech/token
 * Returns a 10-minute SAS token for direct Azure Speech streaming
 * (Token Vending Machine — NFR2.2 from SRS)
 */
export const getSpeechToken = async (req, res) => {
  if (!azureAvailable()) {
    return res.json({ success: true, data: { available: false, message: 'Azure Speech not configured — using browser fallback' } });
  }
  try {
    const tokenData = await getAzureSasToken();
    res.json({ success: true, data: { available: true, ...tokenData } });
  } catch (err) {
    console.error('Token vending failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not issue speech token' });
  }
};

/**
 * GET /api/speech/status
 * Returns which AI/speech providers are configured
 */
export const getSpeechStatus = (req, res) => {
  res.json({
    success: true,
    data: {
      azure: {
        available: azureAvailable(),
        region: process.env.AZURE_SPEECH_REGION || 'uksouth',
        features: azureAvailable() ? ['pronunciation-assessment', 'tts-neural', 'speech-to-text'] : [],
        freeTier: 'F0: 5 audio hours/month STT, 500K chars/month TTS',
      },
      groq: {
        available: Boolean(process.env.GROQ_API_KEY),
        model: 'claude-haiku-4-5-20251001',
        role: 'Mrs. Owl coaching tips',
        pricing: '~$0.25 per 1M input tokens',
      },
      gemini: {
        available: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here'),
        model: 'gemini-2.5-flash',
        role: 'Mrs. Owl coaching tips (free fallback)',
        freeTier: '15 req/min, 1,500 req/day — completely free',
      },
      fallback: {
        available: true,
        type: 'static-phoneme-cache + rule-based',
        phonemeTips: 30,
      },
    },
  });
};

// ── UTIL (shared with fallback scoring) ──────────────────────
function scoreWords(spoken, target) {
  const sp = spoken.toLowerCase().replace(/[.,!?;:'"]/g, '').trim().split(/\s+/);
  return target.trim().split(/\s+/).map((word, i) => {
    const clean = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
    const said  = (sp[i] || '').toLowerCase();
    if (!said)        return { word, score: 0, errorType: 'Omission', phonemes: [] };
    if (said === clean) return { word, score: 100, errorType: 'None', phonemes: [] };
    let match = 0;
    const len = Math.max(said.length, clean.length, 1);
    for (let j = 0; j < Math.min(said.length, clean.length); j++) {
      if (said[j] === clean[j]) match++;
    }
    if (clean.includes(said) || said.includes(clean)) {
      return { word, score: Math.round(65 + (match / len) * 35), errorType: 'Mispronunciation', phonemes: [] };
    }
    return { word, score: Math.round((match / len) * 100), errorType: 'Mispronunciation', phonemes: [] };
  });
}

function computeAccuracy(scores) {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
}
