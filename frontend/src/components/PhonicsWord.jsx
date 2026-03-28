/**
 * @file        PhonicsWord.jsx
 * @description Phonics-aware word display — shows a word split into its grapheme chunks,
 *              each chunk colour-coded by phase and pronunciation score.
 *
 *              BEFORE assessment: shows grapheme breakdown with phase colours
 *                                 (so child knows what sounds to make)
 *              AFTER assessment:  shows score per chunk (green/amber/red)
 *                                 with the weakest chunk pulsing for attention
 *
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { analyseWord, mergePhonemeScores, graphemeScoreColor } from '../utils/phonicsAnalyser';

/**
 * PhonicsWord — renders a single word as a row of grapheme tiles.
 *
 * @param {string}   word           - The word to display (may include punctuation)
 * @param {number}   phase          - Child's phase (2–6) — controls colour coding
 * @param {number}   score          - Overall word score (0–100) or null before assessment
 * @param {Array}    azurePhonemes  - Phoneme-level scores from Azure [{phoneme, score}]
 * @param {boolean}  isSpeaking     - True when TTS is reading this word aloud
 * @param {boolean}  isRevealed     - True after assessment scores are shown
 * @param {string}   dark           - Dark mode text colour override
 * @param {boolean}  compact        - Smaller tile size (for long sentences)
 */
export default function PhonicsWord({
  word,
  phase = 2,
  score = null,
  azurePhonemes = [],
  isSpeaking = false,
  isRevealed = false,
  dark = false,
  compact = false,
  speakingChunkKey = null,  // 'wordIdx-chunkIdx' — which grapheme is playing in phonics mode
  wordIdx = 0,
}) {
  const punctMatch = word.match(/([.,!?;:'"]+)$/);
  const punct      = punctMatch ? punctMatch[0] : '';
  const clean      = word.slice(0, word.length - punct.length);

  // Analyse into grapheme chunks
  let chunks = analyseWord(clean, phase);

  // Merge Azure phoneme scores if available
  if (isRevealed && azurePhonemes?.length > 0) {
    chunks = mergePhonemeScores(chunks, azurePhonemes);
  }

  // Find worst-scoring chunk for attention pulse
  // Determine which chunk (if any) is currently being spoken in phonics mode
  const isChunkSpeaking = (ci) => speakingChunkKey === `${wordIdx}-${ci}`;
  const scoredChunks   = chunks.filter(c => c.score !== null && !c.isSilent);
  const worstScore     = scoredChunks.length ? Math.min(...scoredChunks.map(c => c.score)) : null;
  const worstChunkIdx  = worstScore !== null && worstScore < 70
    ? chunks.findIndex(c => c.score === worstScore)
    : -1;

  const tileSize = compact ? 20 : 26;
  const fontSize = compact ? 18 : 'clamp(22px,5vw,30px)';

  return (
    <span style={{
      display:        'inline-flex',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            4,
      transition:     'transform 0.18s ease',
      transform:      isSpeaking ? 'scale(1.15) translateY(-4px)' : 'scale(1)',
    }}>
      {/* Overall score badge — shown above word */}
      {isRevealed && score !== null && (
        <span style={{
          fontSize:   11,
          fontWeight: 900,
          color:      score >= 80 ? 'var(--text-success)' : score >= 55 ? 'var(--color-accent-dark)' : 'var(--color-danger)',
          lineHeight: 1,
          animation:  'fadeInUp 0.25s ease',
        }}>
          {Math.round(score)}%
        </span>
      )}

      {/* ── GRAPHEME TILES ─────────────────────────────── */}
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1 }}>
        {/* Wrap in relative container so blend arcs can be positioned absolutely */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: compact ? 1 : 2 }}>
      {/* Blend group brackets — SVG arc drawn over the blend letters */}
      {blendGroups.map((bg, bgi) => {
        const tileW  = compact ? 26 : 32;
        const gapW   = compact ? 1 : 2;
        const totalW = bg.length * tileW + (bg.length - 1) * gapW;
        const leftOff = bg.startChunkIdx * (tileW + gapW);
        return (
          <svg key={bgi}
            style={{ position: 'absolute', top: -10, left: leftOff, pointerEvents: 'none', overflow: 'visible', zIndex: 2 }}
            width={totalW} height={10}>
            <path
              d={`M 2 9 Q ${totalW/2} 0 ${totalW - 2} 9`}
              fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="3 2"
            />
          </svg>
        );
      })}
      {chunks.map((chunk, ci) => {
          const isWorst    = ci === worstChunkIdx;
          const chunkColor = isRevealed && chunk.score !== null
            ? graphemeScoreColor(chunk.score)
            : null;

          // Pre-assessment: show phase colours as subtle underlines
          const phaseColor = chunk.color;
          const isTricky   = chunk.isNew;  // grapheme above child's phase

          return (
            <span
              key={ci}
              title={`${chunk.grapheme} = ${chunk.phoneme} (${chunk.label})`}
              style={{
                display:        'inline-flex',
                flexDirection:  'column',
                alignItems:     'center',
                position:       'relative',
              }}
            >
              {/* The grapheme letter(s) */}
              {/* Phoneme label above chunk when it's currently speaking in phonics mode */}
              {isChunkSpeaking(ci) && (
                <span style={{
                  position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--brand-accent)', color: '#fff',
                  borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 800,
                  whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(251,191,36,0.5)',
                  fontFamily: 'monospace', animation: 'fadeInUp 0.15s ease',
                  zIndex: 10,
                }}>
                  {chunk.phoneme}
                </span>
              )}
              <span style={{
                fontSize,
                fontWeight:     800,
                fontFamily:     'var(--font-display)',
                letterSpacing:  '0.01em',
                lineHeight:     1.3,
                color:          isChunkSpeaking(ci)
                  ? '#fff'
                  : isSpeaking
                  ? 'var(--color-info)'
                  : isRevealed && chunkColor
                    ? chunkColor.text
                    : dark ? 'rgba(255,255,255,0.9)' : 'var(--text)',
                background:     isChunkSpeaking(ci)
                  ? 'var(--brand-accent)'
                  : isSpeaking
                  ? 'var(--bg-info-light)'
                  : isRevealed && chunkColor
                    ? chunkColor.bg
                    : 'transparent',
                border: isChunkSpeaking(ci)
                  ? '2px solid var(--brand-accent)'
                  : isRevealed && chunkColor
                  ? `1.5px solid ${chunkColor.border}`
                  : isTricky && !isRevealed
                    ? `1.5px dashed ${phaseColor}60`
                    : 'none',
                borderRadius:   6,
                padding:        isChunkSpeaking(ci) || (isRevealed && chunkColor) || isSpeaking ? '1px 5px' : '1px 1px',
                transition:     'all 0.15s ease',
                opacity:        chunk.isSilent ? 0.35 : 1,
                boxShadow:      isChunkSpeaking(ci) ? '0 0 14px rgba(251,191,36,0.6)' : 'none',
                transform:      isChunkSpeaking(ci) ? 'scale(1.25) translateY(-2px)' : 'scale(1)',
                animation:      isWorst && !isChunkSpeaking(ci) ? 'pulse-chunk 1s ease-in-out 3' : 'none',
              }}>
                {chunk.grapheme}
              </span>

              {/* Phoneme label — shown when NOT revealed yet (teaching mode) */}
              {!isRevealed && !chunk.isSilent && (
                <span style={{
                  fontSize:   7,
                  fontWeight: 700,
                  color:      phaseColor,
                  lineHeight: 1,
                  opacity:    0.8,
                  fontFamily: 'monospace',
                  letterSpacing: '-0.5px',
                }}>
                  {chunk.phoneme}
                </span>
              )}

              {/* Score mini-bar under chunk — shown after reveal */}
              {isRevealed && chunk.score !== null && !chunk.isSilent && (
                <span style={{
                  width:        '100%',
                  minWidth:     tileSize,
                  height:       3,
                  borderRadius: 2,
                  background:   chunkColor?.border || 'var(--border)',
                  marginTop:    1,
                }} />
              )}

              {/* "tricky" star for above-phase graphemes */}
              {isTricky && !isRevealed && (
                <span style={{
                  position:   'absolute',
                  top:        -8,
                  right:      -4,
                  fontSize:   8,
                  lineHeight: 1,
                }}>⭐</span>
              )}
            </span>
          );
        })}

        {/* Punctuation stays plain */}
        {punct && (
          <span style={{
            fontSize,
            fontWeight: 800,
            color:      dark ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)',
          }}>
            {punct}
          </span>
        )}
      </span>

      {/* Worst chunk coaching hint — only shown post-reveal when score is bad */}
      {isRevealed && worstScore !== null && worstScore < 60 && chunks[worstChunkIdx] && (
        <span style={{
          fontSize:    9,
          fontWeight:  700,
          color:       'var(--color-danger)',
          background:  'var(--bg-danger-muted)',
          borderRadius: 8,
          padding:     '2px 6px',
          maxWidth:    90,
          textAlign:   'center',
          lineHeight:  1.3,
          animation:   'fadeInUp 0.3s ease 0.5s both',
        }}>
          Work on "{chunks[worstChunkIdx].grapheme}"!
        </span>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-chunk {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); filter: brightness(1.2); }
        }
      `}</style>
    </span>
  );
}
