/**
 * @file        PhonicsLearn.jsx
 * @description Interactive phonics concepts guide — teaches parents and children
 *              the foundational vocabulary and methods of phonics education.
 *              Covers DfE synthetic phonics curriculum terminology from Phase 2–6.
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState } from 'react';

// ── CONTENT ────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'essentials',
    icon: '🔤',
    title: 'Essential Phonics Terms',
    color: '#7C3AED',
    bg: 'var(--purple-10)',
    intro: 'Before starting phonics, it helps to know the key words teachers use. These six terms are the building blocks of all phonics teaching.',
    concepts: [
      {
        term: 'Phoneme',
        definition: 'The smallest unit of sound in a word.',
        detail: 'English has around 44 phonemes. A phoneme is a sound, not a letter — so "sh" is one phoneme even though it uses two letters.',
        examples: ['/f/', '/sh/', '/ai/'],
        demo: { word: 'ship', breakdown: ['/sh/', '/i/', '/p/'] },
        tip: '🦉 Think of phonemes as the "sound atoms" of language.',
        color: '#7C3AED',
      },
      {
        term: 'Grapheme',
        definition: 'The letter or letters that represent a phoneme on the page.',
        detail: 'A single phoneme can be spelled many ways. The sound /f/ can be spelled f (fan), ff (off), or ph (phone).',
        examples: ['t', 'sh', 'igh', 'ph'],
        demo: { word: 'night', breakdown: ['n', 'igh', 't'] },
        tip: '🦉 Graphemes are what you see; phonemes are what you hear.',
        color: '#2563EB',
      },
      {
        term: 'Blending',
        definition: 'Merging individual sounds together to read a whole word.',
        detail: 'The reader speaks each phoneme in order, then smoothly pushes them together. This is how children decode (read) new words.',
        examples: ['c-a-t → cat', 'sh-i-p → ship', 'n-igh-t → night'],
        demo: { word: 'cat', breakdown: ['/c/', '/a/', '/t/'], arrow: '→ cat' },
        tip: '🦉 Blending is sounding out then "crashing" the sounds together.',
        color: '#059669',
      },
      {
        term: 'Segmenting',
        definition: 'Breaking a spoken word into its individual sounds to spell it.',
        detail: 'The opposite of blending. A child hears "dog" and segments it into /d/-/o/-/g/ to write it. Essential for spelling.',
        examples: ['cat → c-a-t', 'fish → f-i-sh', 'rain → r-ai-n'],
        demo: { word: 'fish', breakdown: ['/f/', '/i/', '/sh/'] },
        tip: '🦉 Blending reads words; segmenting spells them.',
        color: '#D97706',
      },
      {
        term: 'Decoding',
        definition: 'Sounding out an unfamiliar written word using letter-sound knowledge.',
        detail: 'When a child sees an unknown word, they use their phonics knowledge to convert the graphemes into phonemes and blend them. Decoding is reading.',
        examples: ['"blend" → /bl/-/e/-/nd/'],
        demo: { word: 'blend', breakdown: ['/bl/', '/e/', '/nd/'] },
        tip: '🦉 A strong decoder can read any new word, even ones they have never seen.',
        color: '#DB2777',
      },
      {
        term: 'Encoding',
        definition: 'Converting spoken sounds into written letters (spelling).',
        detail: 'The reverse of decoding. The child hears /r/-/ai/-/n/ and writes "rain". Encoding is spelling using phonics knowledge.',
        examples: ['/r/-/ai/-/n/ → rain'],
        demo: { word: 'rain', breakdown: ['/r/', '/ai/', '/n/'] },
        tip: '🦉 Good decoders usually become good encoders — the skills reinforce each other.',
        color: '#0891B2',
      },
    ],
  },
  {
    id: 'letter-sound',
    icon: '🔡',
    title: 'Letter-Sound Relationships',
    color: '#059669',
    bg: 'var(--accent-10)',
    intro: 'English spelling isn\'t always one-letter-one-sound. These patterns explain how multiple letters can work together to make a single sound.',
    concepts: [
      {
        term: 'Digraph',
        definition: 'Two letters that combine to make one single sound.',
        detail: 'A digraph is written as two letters, but spoken as one phoneme. You cannot hear the individual letters — only the combined sound.',
        examples: ['sh → /sh/ (ship)', 'ch → /ch/ (chip)', 'oa → /oa/ (boat)', 'th → /th/ (the)'],
        demo: { word: 'shop', breakdown: ['sh', 'o', 'p'], highlight: [0] },
        tip: '🦉 Phase 3 introduces digraphs. They are one of the biggest phonics milestones.',
        color: '#059669',
      },
      {
        term: 'Trigraph',
        definition: 'Three letters that combine to make one single sound.',
        detail: 'Like a digraph, but with three letters. The "igh" in "night" and "ear" in "hear" are common English trigraphs.',
        examples: ['igh → /ie/ (night)', 'ear → /eer/ (hear)', 'air → /air/ (chair)'],
        demo: { word: 'night', breakdown: ['n', 'igh', 't'], highlight: [1] },
        tip: '🦉 Trigraphs often trip children up — seeing three letters but hearing one sound feels counterintuitive.',
        color: '#2563EB',
      },
      {
        term: 'Split Digraph',
        definition: 'Two letters making one sound, separated by another letter — formerly called "magic e".',
        detail: 'The final "e" has no sound of its own, but it changes the vowel sound earlier in the word. Take away the "e" and the word changes completely.',
        examples: ['a_e: cake (not cak)', 'i_e: bike (not bik)', 'o_e: home (not hom)', 'u_e: tune (not tun)'],
        demo: { word: 'cake', breakdown: ['c', 'a·e', 'k'], highlight: [1] },
        tip: '🦉 The "e" at the end is silent but powerful — it makes the vowel say its name.',
        color: '#DB2777',
      },
      {
        term: 'Consonant Blend',
        definition: 'Two or more consonants together where each individual sound can still be heard.',
        detail: 'Unlike digraphs, blends do NOT merge into a single sound. Both (or all three) consonant sounds remain audible — they are just spoken very quickly.',
        examples: ['bl: black /bl/', 'st: step /st/', 'str: strap /str/', 'cl: clap /kl/'],
        demo: { word: 'flat', breakdown: ['fl', 'a', 't'], highlight: [0] },
        tip: '🦉 Blends vs digraphs: in "ship" you cannot say /s/ and /h/ separately. In "slip" you CAN say /s/ and /l/ separately.',
        color: '#7C3AED',
      },
    ],
  },
  {
    id: 'word-types',
    icon: '📝',
    title: 'Word Structure & Types',
    color: '#D97706',
    bg: 'var(--amber-10)',
    intro: 'Phonics uses specific labels for word patterns. These help teachers sequence what children learn, starting from the simplest patterns and building complexity.',
    concepts: [
      {
        term: 'CVC Words',
        definition: 'Consonant–Vowel–Consonant: the simplest three-sound word pattern.',
        detail: 'CVC words are introduced in Phase 2. Every sound is a single grapheme, making them ideal for practising blending and segmenting for the first time.',
        examples: ['cat (c-a-t)', 'pin (p-i-n)', 'hot (h-o-t)', 'sun (s-u-n)', 'bed (b-e-d)'],
        demo: { word: 'cat', breakdown: ['C', 'V', 'C'], subtitle: ['c', 'a', 't'] },
        tip: '🦉 Start here! CVC words are the foundation of all phonics reading.',
        color: '#D97706',
      },
      {
        term: 'VC, CCVC & CVCC',
        definition: 'Variations on CVC showing different levels of word complexity.',
        detail: 'As children progress, words gain extra consonants at the start or end. CCVC adds a blend before the vowel; CVCC adds consonants after. This increases difficulty gradually.',
        examples: ['VC: "at", "up", "it"', 'CCVC: "trap", "clap", "frog"', 'CVCC: "fast", "belt", "lamp"'],
        demo: { word: 'trap', breakdown: ['CC', 'V', 'C'], subtitle: ['tr', 'a', 'p'] },
        tip: '🦉 The pattern (CVC, CCVC…) tells you how many consonant clusters surround the vowel.',
        color: '#0891B2',
      },
      {
        term: 'Tricky Words',
        definition: 'Irregular words that cannot be fully decoded using phonics rules.',
        detail: 'Some of the most common English words are spelled in non-phonetic ways. Children need to learn them by sight rather than blending. They are also called "red words" or "sight words".',
        examples: ['"the", "said", "was", "have", "they", "come", "some", "do", "to", "you"'],
        demo: { word: 'said', special: true, note: 'sounds like "sed" — you must just know it!' },
        tip: '🦉 Tricky words are not phonics failures — English just has irregular history. Memorise the most common 100 and reading becomes dramatically easier.',
        color: '#DC2626',
      },
    ],
  },
  {
    id: 'methods',
    icon: '🎓',
    title: 'Phonics Teaching Methods',
    color: '#2563EB',
    bg: 'var(--blue-10)',
    intro: 'There are two main approaches to teaching phonics. The UK National Curriculum mandates Synthetic Phonics, but understanding both helps you support your child better.',
    concepts: [
      {
        term: 'Synthetic Phonics',
        definition: 'Teaching letter-sounds first, then blending them to build words.',
        detail: 'The child learns the 44 phonemes and their graphemes, then synthesises (builds) words by blending phonemes together. This is the UK government-mandated approach for all state schools. Properly uses this method.',
        examples: [
          'Step 1: Learn /s/, /a/, /t/',
          'Step 2: Blend them → sat',
          'Step 3: Learn more phonemes → more words',
        ],
        tip: '🦉 Synthetic phonics is what Properly teaches. Every reading session practices blending real phonemes.',
        color: '#2563EB',
        badge: '✅ Used by Properly',
      },
      {
        term: 'Analytic Phonics',
        definition: 'Teaching phonics by analysing patterns in familiar whole words.',
        detail: 'Rather than starting with sounds, the child starts with known whole words and identifies the letter patterns within them. For example: "cat", "car", "cup" all start with "c" → c = /k/.',
        examples: [
          '"cat", "car", "cup" → c = /k/',
          '"the", "this", "that" → th = /th/',
          'Pattern recognition over blending',
        ],
        tip: '🦉 Analytic phonics works alongside synthetic phonics. Parents naturally use it when pointing out letter patterns in words their child already knows.',
        color: '#7C3AED',
        badge: '📚 Complementary approach',
      },
    ],
  },
];

// ── PHASE OVERVIEW ─────────────────────────────────────────────────────────
const PHASES = [
  { n: 2, color: '#10B981', label: 'Simple CVC',       words: 'sat, pin, hot',     sounds: 's, a, t, p, i, n, m, d, g, o, c, k, ck, e, u, r, h, b, f, l' },
  { n: 3, color: '#3B82F6', label: 'Digraphs',         words: 'chat, rain, feet',   sounds: 'ch, sh, th, ng, ai, ee, oo, ar, or, ur, ow, oi, ear, air, ure' },
  { n: 4, color: '#8B5CF6', label: 'Consonant Blends', words: 'flat, step, crisp',  sounds: 'bl, cl, fl, br, cr, dr, str, spr, scr, nd, mp, lt, sk' },
  { n: 5, color: '#F59E0B', label: 'Split Digraphs',   words: 'cake, slide, home',  sounds: 'a-e, i-e, o-e, u-e, ay, ea, ie, ue, ew, ph, wh' },
  { n: 6, color: '#EF4444', label: 'Morphemes',        words: 'unhappy, fearless',  sounds: '-tion, -ture, -ous, -ful, -less, un-, re-, dis-, -ness' },
];

// ── CONCEPT CARD ───────────────────────────────────────────────────────────
function ConceptCard({ concept, isOpen, onToggle }) {
  return (
    <div style={{
      border: `1.5px solid ${isOpen ? concept.color : 'var(--border)'}`,
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      background: 'var(--surface)',
      boxShadow: isOpen ? `0 4px 20px ${concept.color}20` : 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          background: isOpen ? `${concept.color}08` : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${concept.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: concept.color, fontFamily: 'var(--font-body)' }}>
            {concept.term[0]}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
              {concept.term}
            </span>
            {concept.badge && (
              <span style={{ fontSize: 10, fontWeight: 700, background: `${concept.color}15`, color: concept.color, borderRadius: 50, padding: '2px 8px' }}>
                {concept.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-body)' }}>
            {concept.definition}
          </div>
        </div>
        <span style={{ fontSize: 18, color: concept.color, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div style={{ padding: '0 18px 18px', animation: 'fadeInUp 0.2s ease' }}>

          {/* Detail paragraph */}
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14, fontFamily: 'var(--font-body)' }}>
            {concept.detail}
          </p>

          {/* Demo word (if present) */}
          {concept.demo && !concept.demo.special && (
            <div style={{
              background: `${concept.color}08`,
              border: `1px solid ${concept.color}25`,
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: concept.color, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 60 }}>
                Demo
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {concept.demo.breakdown.map((chunk, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 38,
                      padding: '5px 10px',
                      borderRadius: 8,
                      background: (concept.demo.highlight || []).includes(i)
                        ? concept.color
                        : `${concept.color}18`,
                      color: (concept.demo.highlight || []).includes(i)
                        ? '#fff'
                        : concept.color,
                      fontWeight: 800,
                      fontSize: 17,
                      textAlign: 'center',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.02em',
                    }}>
                      {chunk}
                    </span>
                    {concept.demo.subtitle && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{concept.demo.subtitle[i]}</span>
                    )}
                  </div>
                ))}
                {concept.demo.arrow && (
                  <span style={{ fontSize: 14, color: concept.color, fontWeight: 700 }}>{concept.demo.arrow}</span>
                )}
              </div>
            </div>
          )}

          {/* Special tricky word demo */}
          {concept.demo?.special && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#DC2626', fontFamily: 'var(--font-display)' }}>{concept.demo.word}</span>
              <span style={{ fontSize: 12, color: '#991B1B', fontFamily: 'var(--font-body)' }}>{concept.demo.note}</span>
            </div>
          )}

          {/* Examples */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>
              Examples
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {concept.examples.map((ex, i) => (
                <span key={i} style={{
                  background: `${concept.color}10`,
                  color: concept.color,
                  border: `1px solid ${concept.color}25`,
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                }}>
                  {ex}
                </span>
              ))}
            </div>
          </div>

          {/* Owl tip */}
          <div style={{
            background: 'var(--brand-primary-pale, #F5F3FF)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: '#4C1D95',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.6,
          }}>
            {concept.tip}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function PhonicsLearn({ childPhase = 2 }) {
  const [openSection, setOpenSection] = useState('essentials');
  const [openConcept, setOpenConcept] = useState(null);  // 'sectionId:termName'

  const toggleConcept = (sectionId, term) => {
    const key = `${sectionId}:${term}`;
    setOpenConcept(prev => prev === key ? null : key);
  };

  const activeSection = SECTIONS.find(s => s.id === openSection) || SECTIONS[0];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
          🦉 Mrs Owl's Phonics Guide
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-body)', marginBottom: 6 }}>
          Understanding Phonics
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
          Phonics is a method of teaching reading by training children to hear and connect the sounds of letters.
          Understanding these concepts helps you support {childPhase ? `your child at Phase ${childPhase}` : 'your child'} at home.
        </p>
      </div>

      {/* DfE Phase overview strip */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          DfE Phonics Phases — where your child is on the journey
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PHASES.map(p => (
            <div key={p.n} style={{
              flex: '1 1 0',
              minWidth: 90,
              padding: '8px 10px',
              borderRadius: 10,
              background: childPhase === p.n ? p.color : `${p.color}12`,
              border: `1.5px solid ${childPhase === p.n ? p.color : `${p.color}30`}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: childPhase === p.n ? '#fff' : p.color, marginBottom: 2 }}>
                Phase {p.n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: childPhase === p.n ? 'rgba(255,255,255,0.9)' : p.color, marginBottom: 3 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 9, color: childPhase === p.n ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                e.g. {p.words}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => { setOpenSection(sec.id); setOpenConcept(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              borderRadius: 50,
              border: `1.5px solid ${openSection === sec.id ? sec.color : 'var(--border)'}`,
              background: openSection === sec.id ? `${sec.color}12` : 'var(--surface)',
              color: openSection === sec.id ? sec.color : 'var(--text-muted)',
              fontWeight: openSection === sec.id ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
              boxShadow: openSection === sec.id ? `0 2px 8px ${sec.color}20` : 'none',
            }}
          >
            <span>{sec.icon}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{sec.title}</span>
          </button>
        ))}
      </div>

      {/* Section intro */}
      <div style={{
        background: `${activeSection.color}08`,
        border: `1px solid ${activeSection.color}20`,
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 14,
        fontSize: 13,
        color: 'var(--text-2)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.65,
      }}>
        {activeSection.icon}  {activeSection.intro}
      </div>

      {/* Concept cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeSection.concepts.map(concept => (
          <ConceptCard
            key={concept.term}
            concept={concept}
            isOpen={openConcept === `${activeSection.id}:${concept.term}`}
            onToggle={() => toggleConcept(activeSection.id, concept.term)}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 20,
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.6,
      }}>
        🏫 <strong>Based on</strong> the UK Department for Education (DfE) Letters and Sounds framework and the Year 1 Phonics Screening Check curriculum.
        Properly's AI stories are generated to match your child's current phase vocabulary precisely.
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
