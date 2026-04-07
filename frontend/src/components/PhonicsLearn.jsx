/**
 * @file        PhonicsLearn.jsx
 * @description Interactive phonics tutor — white card interiors, real Azure phoneme
 *              sounds, step-by-step blending demos, mic practice with scoring.
 */
import { useState, useRef } from 'react';
import { usePhonemePlayer } from '../hooks/usePhonemePlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAzureTTS } from '../hooks/useAzureTTS';
import { speechAPI } from '../services/api';

// ── DATA ──────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id:'alphabet',     emoji:'🔤', title:'Alphabet Sounds',           subtitle:'Hear every letter phoneme · Tap to listen · 🎤 practise & score', color:'#7C3AED' },
  { id:'essentials',   emoji:'💡', title:'Essential Phonics Terms',   subtitle:'Phoneme · Grapheme · Blending · Segmenting · Decoding · Encoding',  color:'#2563EB' },
  { id:'letter-sound', emoji:'🔡', title:'Letter-Sound Relationships', subtitle:'Digraphs · Trigraphs · Split Digraphs · Consonant Blends',          color:'#059669' },
  { id:'word-types',   emoji:'📝', title:'Word Structure & Types',    subtitle:'CVC · CCVC · CVCC · Tricky Words — tap any word to hear it',         color:'#D97706' },
  { id:'methods',      emoji:'🎓', title:'Phonics Teaching Methods',  subtitle:'Synthetic Phonics · Analytic Phonics — how phonics is taught',        color:'#DB2777' },
];

const PHASES = [
  { n:2, color:'#10B981', label:'Simple CVC',    eg:'sat, pin' },
  { n:3, color:'#3B82F6', label:'Digraphs',       eg:'chat, rain' },
  { n:4, color:'#8B5CF6', label:'Blends',         eg:'flat, step' },
  { n:5, color:'#F59E0B', label:'Split Digraphs', eg:'cake, home' },
  { n:6, color:'#EF4444', label:'Morphemes',      eg:'unhappy' },
];

const ALPHABET = [
  {l:'a',ipa:'/æ/',eg:'apple'},{l:'b',ipa:'/b/',eg:'bat'},{l:'c',ipa:'/k/',eg:'cat'},
  {l:'d',ipa:'/d/',eg:'dog'},{l:'e',ipa:'/ɛ/',eg:'egg'},{l:'f',ipa:'/f/',eg:'fan'},
  {l:'g',ipa:'/ɡ/',eg:'got'},{l:'h',ipa:'/h/',eg:'hat'},{l:'i',ipa:'/ɪ/',eg:'sit'},
  {l:'j',ipa:'/dʒ/',eg:'jam'},{l:'k',ipa:'/k/',eg:'kit'},{l:'l',ipa:'/l/',eg:'lip'},
  {l:'m',ipa:'/m/',eg:'map'},{l:'n',ipa:'/n/',eg:'net'},{l:'o',ipa:'/ɒ/',eg:'hot'},
  {l:'p',ipa:'/p/',eg:'pin'},{l:'q',ipa:'/kw/',eg:'quiz'},{l:'r',ipa:'/r/',eg:'red'},
  {l:'s',ipa:'/s/',eg:'sun'},{l:'t',ipa:'/t/',eg:'tap'},{l:'u',ipa:'/ʌ/',eg:'cup'},
  {l:'v',ipa:'/v/',eg:'van'},{l:'w',ipa:'/w/',eg:'wet'},{l:'x',ipa:'/ks/',eg:'fox'},
  {l:'y',ipa:'/j/',eg:'yes'},{l:'z',ipa:'/z/',eg:'zip'},
];

// ── PHONICS TERM BREAKDOWNS ──────────────────────────────────────────────────
// Every phonics keyword broken into grapheme chunks with playable cache keys.
// g = what to display, key = what to pass to playGrapheme(), ipa = what to show
const TERM_BREAKDOWNS = {
  // ── ph-o-n-eme: /f/-/əʊ/-/n/-/iːm/ ──────────────────────────
  'Phoneme': [
    { g:'ph',  key:'ph',  ipa:'f',  color:'#7C3AED' },
    { g:'o',   key:'oa',  ipa:'əʊ', color:'#EF4444' },
    { g:'n',   key:'n',   ipa:'n',  color:'#7C3AED' },
    { g:'eme', key:'eme', ipa:'iːm',color:'#EF4444' },
  ],
  // ── gr-a-ph-eme: /ɡr/-/æ/-/f/-/iːm/ ─────────────────────────
  'Grapheme': [
    { g:'gr',  key:'gr',  ipa:'ɡr', color:'#7C3AED' },
    { g:'a',   key:'a',   ipa:'æ',  color:'#EF4444' },
    { g:'ph',  key:'ph',  ipa:'f',  color:'#7C3AED' },
    { g:'eme', key:'eme', ipa:'iːm',color:'#EF4444' },
  ],
  // ── bl-e-nd-ing: /bl/-/ɛ/-/nd/-/ɪŋ/ ─────────────────────────
  'Blending': [
    { g:'bl',  key:'bl',  ipa:'bl', color:'#7C3AED' },
    { g:'e',   key:'e',   ipa:'ɛ',  color:'#EF4444' },
    { g:'nd',  key:'nd',  ipa:'nd', color:'#7C3AED' },
    { g:'ing', key:'ing', ipa:'ɪŋ', color:'#7C3AED' },
  ],
  // ── s-e-g-m-e-nt-ing: /s/-/ɛ/-/ɡ/-/m/-/ɛ/-/nt/-/ɪŋ/ ────────
  'Segmenting': [
    { g:'s',   key:'s',   ipa:'s',  color:'#7C3AED' },
    { g:'e',   key:'e',   ipa:'ɛ',  color:'#EF4444' },
    { g:'g',   key:'g',   ipa:'ɡ',  color:'#7C3AED' },
    { g:'m',   key:'m',   ipa:'m',  color:'#7C3AED' },
    { g:'e',   key:'e',   ipa:'ɛ',  color:'#EF4444' },
    { g:'nt',  key:'nt',  ipa:'nt', color:'#7C3AED' },
    { g:'ing', key:'ing', ipa:'ɪŋ', color:'#7C3AED' },
  ],
  // ── d-ee-c-o-d-ing: /d/-/iː/-/k/-/əʊ/-/d/-/ɪŋ/ ─────────────
  'Decoding': [
    { g:'d',   key:'d',   ipa:'d',  color:'#7C3AED' },
    { g:'ee',  key:'ee',  ipa:'iː', color:'#EF4444' },
    { g:'c',   key:'c',   ipa:'k',  color:'#7C3AED' },
    { g:'o',   key:'oa',  ipa:'əʊ', color:'#EF4444' },
    { g:'d',   key:'d',   ipa:'d',  color:'#7C3AED' },
    { g:'ing', key:'ing', ipa:'ɪŋ', color:'#7C3AED' },
  ],
  // ── e-n-c-o-d-ing: /ɪ/-/n/-/k/-/əʊ/-/d/-/ɪŋ/ ───────────────
  'Encoding': [
    { g:'e',   key:'e',   ipa:'ɪ',  color:'#EF4444' },
    { g:'n',   key:'n',   ipa:'n',  color:'#7C3AED' },
    { g:'c',   key:'c',   ipa:'k',  color:'#7C3AED' },
    { g:'o',   key:'oa',  ipa:'əʊ', color:'#EF4444' },
    { g:'d',   key:'d',   ipa:'d',  color:'#7C3AED' },
    { g:'ing', key:'ing', ipa:'ɪŋ', color:'#7C3AED' },
  ],
  // ── d-i-gr-a-ph: /d/-/ɪ/-/ɡr/-/æ/-/f/ ────────────────────────
  'Digraph': [
    { g:'d',   key:'d',   ipa:'d',  color:'#7C3AED' },
    { g:'i',   key:'i',   ipa:'ɪ',  color:'#EF4444' },
    { g:'gr',  key:'gr',  ipa:'ɡr', color:'#7C3AED' },
    { g:'a',   key:'a',   ipa:'æ',  color:'#EF4444' },
    { g:'ph',  key:'ph',  ipa:'f',  color:'#7C3AED' },
  ],
  // ── tr-i-gr-a-ph: /tr/-/ɪ/-/ɡr/-/æ/-/f/ ─────────────────────
  'Trigraph': [
    { g:'tr',  key:'tr',  ipa:'tr', color:'#7C3AED' },
    { g:'i',   key:'i',   ipa:'ɪ',  color:'#EF4444' },
    { g:'gr',  key:'gr',  ipa:'ɡr', color:'#7C3AED' },
    { g:'a',   key:'a',   ipa:'æ',  color:'#EF4444' },
    { g:'ph',  key:'ph',  ipa:'f',  color:'#7C3AED' },
  ],
  // ── bl-e-nd: /bl/-/ɛ/-/nd/ ────────────────────────────────────
  'Blend': [
    { g:'bl',  key:'bl',  ipa:'bl', color:'#7C3AED' },
    { g:'e',   key:'e',   ipa:'ɛ',  color:'#EF4444' },
    { g:'nd',  key:'nd',  ipa:'nd', color:'#7C3AED' },
  ],
};

// ── TERM PHONICS BREAKDOWN WIDGET ─────────────────────────────────────────────
// Shows a phonics term decoded into its grapheme/phoneme tiles.
// Tap any tile = hear that phoneme. Tap "Hear it phonics way" = all sounds + word.
function TermPhonicsBreakdown({ term, accentColor }) {
  const breakdown = TERM_BREAKDOWNS[term];
  if (!breakdown) return null;

  const { playGrapheme, playWord } = usePhonemePlayer();
  const { sayText } = useAzureTTS();
  const [activeTile, setActiveTile] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const playTile = async (idx) => {
    const chunk = breakdown[idx];
    setActiveTile(idx);
    await playGrapheme(chunk.key, chunk.g);
    setTimeout(() => setActiveTile(-1), 350);
  };

  const playPhonicsWay = async () => {
    if (playing) return;
    setPlaying(true);
    // 1. Play each phoneme in sequence with a gap
    for (let i = 0; i < breakdown.length; i++) {
      setActiveTile(i);
      await playGrapheme(breakdown[i].key, breakdown[i].g);
      await new Promise(r => setTimeout(r, 320));
    }
    setActiveTile(-1);
    await new Promise(r => setTimeout(r, 450));
    // 2. Play the whole word naturally via Azure TTS
    await sayText(term);
    setPlaying(false);
  };

  const vowelCount = breakdown.filter(b => b.color === '#EF4444').length;

  return (
    <div style={{
      background: '#FAFAF9',
      border: `2px solid ${accentColor}20`,
      borderRadius: 16,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.6px' }}>
          📖 Phonics breakdown of
        </span>
        <span style={{ fontSize:13, fontWeight:900, color:accentColor }}>{term}</span>
      </div>

      {/* Grapheme tiles row */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:5, marginBottom:12, flexWrap:'wrap' }}>
        {breakdown.map((chunk, i) => {
          const isVowel = chunk.color === '#EF4444';
          const isActive = activeTile === i;
          return (
            <button key={i} onClick={() => playTile(i)}
              title={`Tap to hear /${chunk.ipa}/`}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                padding:'8px 10px', borderRadius:12, cursor:'pointer', minWidth:40,
                border: `2px solid ${isActive ? chunk.color : chunk.color + '35'}`,
                background: isActive ? chunk.color : isVowel ? '#FEF2F2' : '#F5F3FF',
                transform: isActive ? 'scale(1.15) translateY(-4px)' : 'scale(1)',
                boxShadow: isActive ? `0 6px 18px ${chunk.color}45` : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
              }}>
              {/* Grapheme letter(s) */}
              <span style={{
                fontSize: chunk.g.length > 2 ? 14 : 18,
                fontWeight: 900,
                color: isActive ? '#fff' : chunk.color,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.01em',
              }}>{chunk.g}</span>
              {/* IPA below */}
              <span style={{
                fontSize: 9,
                color: isActive ? 'rgba(255,255,255,0.85)' : '#9CA3AF',
                fontFamily: 'var(--font-mono)',
              }}>/{chunk.ipa}/</span>
              <span style={{ fontSize:9, color: isActive?'rgba(255,255,255,0.6)':'#D1D5DB' }}>🔊</span>
            </button>
          );
        })}

        {/* Arrow + whole word */}
        <span style={{ fontSize:16, color:'#D1D5DB', fontWeight:700, alignSelf:'center', paddingBottom:14 }}>→</span>
        <button onClick={() => sayText(term)}
          title={`Hear "${term}" spoken naturally`}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'8px 14px', borderRadius:12, cursor:'pointer',
            border:`2px solid ${accentColor}30`,
            background: `${accentColor}08`,
            transition:'all 0.15s',
            alignSelf:'flex-end', marginBottom:0 }}>
          <span style={{ fontSize:15, fontWeight:900, color:accentColor }}>{term}</span>
          <span style={{ fontSize:9, color:'#9CA3AF' }}>whole word 🔊</span>
        </button>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:14, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:12, height:12, borderRadius:3, background:'#F5F3FF', border:'1.5px solid #7C3AED50' }}/>
          <span style={{ fontSize:11, color:'#6B7280' }}>Consonant sound</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:12, height:12, borderRadius:3, background:'#FEF2F2', border:'1.5px solid #EF444450' }}/>
          <span style={{ fontSize:11, color:'#6B7280' }}>Vowel sound</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:11, color:'#6B7280' }}>
            {breakdown.length} grapheme{breakdown.length!==1?'s':''} · {breakdown.length} sound{breakdown.length!==1?'s':''}
          </span>
        </div>
      </div>

      {/* Play phonics way button */}
      <button onClick={playPhonicsWay} disabled={playing}
        style={{ display:'inline-flex', alignItems:'center', gap:8,
          padding:'9px 18px', borderRadius:50,
          border:`1.5px solid ${accentColor}40`, background:`${accentColor}10`,
          color:accentColor, cursor:'pointer', fontSize:12, fontWeight:800,
          opacity:playing?0.6:1, transition:'all 0.15s',
          boxShadow:`0 2px 8px ${accentColor}20` }}>
        {playing
          ? <><span>▶</span> Sounding out…</>
          : <><span>🔊</span> Hear it the phonics way — sound by sound</>}
      </button>
    </div>
  );
}

// Each concept: definition, detail, demo (step-by-step), soundTiles, practiceWords
const CONCEPT_DATA = {
  essentials: [
    { term:'Phoneme', emoji:'🔊', color:'#7C3AED',
      definition:'The smallest unit of sound in a word.',
      detail:'English has 44 phonemes. A phoneme is a SOUND, not a letter — "sh" is one phoneme even though it uses two letters. Tap each sound tile to hear the real phoneme.',
      tip:'🦉 Think of phonemes as the "sound atoms" of language. Every word is built from them.',
      demo:{ word:'ship', label:'The word "ship" has 3 phonemes', sounds:['sh','i','p'], ipas:['ʃ','ɪ','p'] },
      moreDemos:[
        { word:'chat', sounds:['ch','a','t'], ipas:['tʃ','æ','t'] },
        { word:'rain', sounds:['r','ai','n'], ipas:['r','eɪ','n'] },
        { word:'night',sounds:['n','igh','t'],ipas:['n','aɪ','t'] },
      ],
      practiceWords:[
        { word:'ship', sounds:['sh','i','p'],   spoken:'sh  i  p' },
        { word:'chat', sounds:['ch','a','t'],   spoken:'ch  a  t' },
        { word:'rain', sounds:['r','ai','n'],   spoken:'r  ay  n' },
      ]},
    { term:'Grapheme', emoji:'✍️', color:'#2563EB',
      definition:'The letter(s) that represent a phoneme on the page.',
      detail:'One phoneme can be spelled many ways. The /f/ sound can be "f" (fan), "ff" (off), or "ph" (phone). Each spelling is a different grapheme for the same phoneme.',
      tip:'🦉 Graphemes are what you SEE. Phonemes are what you HEAR.',
      demo:{ word:'night', label:'The /aɪ/ phoneme is spelled "igh" in "night"', sounds:['n','igh','t'], ipas:['n','aɪ','t'], highlight:[1] },
      moreDemos:[
        { word:'phone', sounds:['ph','o','n','e'], ipas:['f','ɒ','n',''], highlight:[0], note:'"ph" makes the /f/ sound' },
        { word:'off',   sounds:['o','ff'],         ipas:['ɒ','f'],        highlight:[1], note:'"ff" makes the /f/ sound' },
      ],
      practiceWords:[
        { word:'night', sounds:['n','igh','t'],    spoken:'n  ie  t' },
        { word:'phone', sounds:['ph','o','n','e'], spoken:'f  oh  n' },
      ]},
    { term:'Blending', emoji:'🧩', color:'#059669',
      definition:'Merging individual sounds together to read a whole word.',
      detail:'Say each phoneme in order, then push them together smoothly. This is how children decode (read) new words. Tap "Blend it!" to hear the full sequence.',
      tip:'🦉 Blending is sounding out then "crashing" the sounds together into one word.',
      demo:{ word:'cat', label:'Blend /k/ + /æ/ + /t/ to read "cat"', sounds:['c','a','t'], ipas:['k','æ','t'], blending:true },
      moreDemos:[
        { word:'ship',  sounds:['sh','i','p'],  ipas:['ʃ','ɪ','p'],  blending:true },
        { word:'night', sounds:['n','igh','t'], ipas:['n','aɪ','t'], blending:true },
        { word:'flat',  sounds:['fl','a','t'],  ipas:['fl','æ','t'], blending:true },
      ],
      practiceWords:[
        { word:'cat',  sounds:['c','a','t'],   spoken:'k  a  t' },
        { word:'ship', sounds:['sh','i','p'],  spoken:'sh  i  p' },
        { word:'flat', sounds:['fl','a','t'],  spoken:'fl  a  t' },
      ]},
    { term:'Segmenting', emoji:'✂️', color:'#D97706',
      definition:'Breaking a spoken word into its individual sounds to spell it.',
      detail:'The opposite of blending. A child hears "dog" and segments it: /d/ - /o/ - /g/ — three phonemes. Segmenting is how children learn to spell.',
      tip:'🦉 Blending reads words. Segmenting spells them. You need both!',
      demo:{ word:'fish', label:'"fish" segments into 3 sounds', sounds:['f','i','sh'], ipas:['f','ɪ','ʃ'], segmenting:true },
      moreDemos:[
        { word:'rain',  sounds:['r','ai','n'], ipas:['r','eɪ','n'], segmenting:true },
        { word:'jump',  sounds:['j','u','m','p'], ipas:['dʒ','ʌ','m','p'], segmenting:true },
      ],
      practiceWords:[
        { word:'fish', sounds:['f','i','sh'],    spoken:'f  i  sh' },
        { word:'rain', sounds:['r','ai','n'],    spoken:'r  ai  n' },
        { word:'jump', sounds:['j','u','m','p'], spoken:'j  u  m  p' },
      ]},
    { term:'Decoding', emoji:'🔓', color:'#DB2777',
      definition:'Sounding out an unfamiliar written word using letter-sound knowledge.',
      detail:'When a child sees an unknown word, they use phonics to convert graphemes into phonemes, then blend them. Decoding IS reading.',
      tip:'🦉 A strong decoder can read any new word — even ones they have never seen before.',
      demo:{ word:'blend', label:'Decode "blend" using phonics', sounds:['bl','e','nd'], ipas:['bl','ɛ','nd'], blending:true },
      moreDemos:[
        { word:'stump', sounds:['st','u','mp'], ipas:['st','ʌ','mp'], blending:true },
        { word:'crisp', sounds:['cr','i','sp'], ipas:['kr','ɪ','sp'], blending:true },
      ],
      practiceWords:[
        { word:'blend', sounds:['bl','e','nd'], spoken:'bl  e  nd' },
        { word:'stump', sounds:['st','u','mp'], spoken:'st  u  mp' },
      ]},
    { term:'Encoding', emoji:'📝', color:'#0891B2',
      definition:'Converting spoken sounds into written letters — spelling.',
      detail:'The reverse of decoding. The child hears /r/-/eɪ/-/n/ and writes "rain". Encoding is phonics-based spelling.',
      tip:'🦉 Good decoders usually become good encoders — the skills reinforce each other.',
      demo:{ word:'rain', label:'Encode "rain" from its sounds', sounds:['/r/','/eɪ/','/n/'], ipas:['r','eɪ','n'], encoding:true },
      moreDemos:[
        { word:'boat', sounds:['/b/','/əʊ/','/t/'], ipas:['b','əʊ','t'], encoding:true },
      ],
      practiceWords:[
        { word:'rain', sounds:['r','ai','n'], spoken:'r  ay  n' },
        { word:'boat', sounds:['b','oa','t'], spoken:'b  oh  t' },
      ]},
  ],
  'letter-sound': [
    { term:'Digraph', emoji:'✌️', color:'#059669',
      definition:'Two letters that combine to make one single sound.',
      detail:'Written as two letters — spoken as ONE phoneme. You cannot hear the individual letters separately. Tap each tile to hear the real phoneme sound.',
      tip:'🦉 Phase 3 introduces digraphs. One of the biggest phonics milestones for 4-5 year olds.',
      demo:{ word:'shop', label:'"sh" is a digraph — two letters, one sound /ʃ/', sounds:['sh','o','p'], ipas:['ʃ','ɒ','p'], highlight:[0] },
      soundTiles:[
        {g:'sh',ipa:'ʃ',  eg:'ship'},{g:'ch',ipa:'tʃ',eg:'chip'},{g:'th',ipa:'ð',  eg:'the'},
        {g:'ng',ipa:'ŋ',  eg:'ring'},{g:'oa',ipa:'əʊ',eg:'boat'},{g:'ai',ipa:'eɪ', eg:'rain'},
        {g:'ee',ipa:'iː', eg:'feet'},{g:'oo',ipa:'uː',eg:'moon'},{g:'ar',ipa:'ɑː', eg:'car'},
        {g:'or',ipa:'ɔː', eg:'fork'},{g:'ur',ipa:'ɜː',eg:'turn'},{g:'ow',ipa:'aʊ', eg:'cow'},
        {g:'oi',ipa:'ɔɪ', eg:'coin'},
      ],
      practiceWords:[
        { word:'shop',  sounds:['sh','o','p'],   spoken:'sh  o  p' },
        { word:'chain', sounds:['ch','ai','n'],  spoken:'ch  ay  n' },
        { word:'moon',  sounds:['m','oo','n'],   spoken:'m  oo  n' },
        { word:'rain',  sounds:['r','ai','n'],   spoken:'r  ay  n' },
      ]},
    { term:'Trigraph', emoji:'3️⃣', color:'#2563EB',
      definition:'Three letters that combine to make one single sound.',
      detail:'Like a digraph but with three letters forming ONE phoneme. "igh" in "night" is one sound /aɪ/, not three.',
      tip:'🦉 Trigraphs often trip children up — three letters but only ONE sound to say.',
      demo:{ word:'night', label:'"igh" is a trigraph — three letters, one sound /aɪ/', sounds:['n','igh','t'], ipas:['n','aɪ','t'], highlight:[1] },
      soundTiles:[
        {g:'igh',ipa:'aɪ',eg:'night'},{g:'ear',ipa:'ɪə',eg:'hear'},
        {g:'air',ipa:'eə',eg:'chair'},{g:'ure',ipa:'ʊə',eg:'pure'},
      ],
      practiceWords:[
        { word:'night', sounds:['n','igh','t'],  spoken:'n  ie  t' },
        { word:'light', sounds:['l','igh','t'],  spoken:'l  ie  t' },
        { word:'chair', sounds:['ch','air'],     spoken:'ch  air' },
      ]},
    { term:'Split Digraph', emoji:'🪄', color:'#DB2777',
      definition:'Two letters making one sound, separated by another letter — formerly "magic e".',
      detail:'The "e" at the end is silent but changes the vowel in the middle. Remove the "e" and the whole word changes: cake → cak, bike → bik, home → hom.',
      tip:'🦉 The silent "e" is powerful — it makes the vowel say its own name.',
      demo:{ word:'cake', label:'"a_e" split digraph — the "e" makes "a" say its name /eɪ/', sounds:['c','a','k','e'], ipas:['k','eɪ','k',''], highlight:[1,3], splitDigraph:true },
      soundTiles:[
        {g:'a_e',ipa:'eɪ',eg:'cake'},{g:'i_e',ipa:'aɪ',eg:'bike'},
        {g:'o_e',ipa:'əʊ',eg:'home'},{g:'u_e',ipa:'juː',eg:'tune'},
      ],
      practiceWords:[
        { word:'cake', sounds:['c','a_e','k'], spoken:'k  ay  k' },
        { word:'bike', sounds:['b','i_e','k'], spoken:'b  ie  k' },
        { word:'home', sounds:['h','o_e','m'], spoken:'h  oh  m' },
      ]},
    { term:'Consonant Blend', emoji:'🔀', color:'#7C3AED',
      definition:'Two or more consonants together where EACH individual sound can still be heard.',
      detail:'Unlike digraphs, blends keep their individual sounds. In "sl-ip" you CAN still hear /s/ AND /l/ — they are just spoken quickly together.',
      tip:'🦉 "ship" = digraph (cannot split sh). "slip" = blend (can hear s + l separately).',
      demo:{ word:'flat', label:'"fl" is a blend — you can still hear /f/ AND /l/', sounds:['fl','a','t'], ipas:['fl','æ','t'], highlight:[0] },
      soundTiles:[
        {g:'bl',ipa:null,eg:'black'},{g:'br',ipa:null,eg:'bring'},{g:'cl',ipa:null,eg:'clap'},
        {g:'cr',ipa:null,eg:'crab'}, {g:'fl',ipa:null,eg:'flag'}, {g:'fr',ipa:null,eg:'frog'},
        {g:'gr',ipa:null,eg:'grab'}, {g:'pl',ipa:null,eg:'play'}, {g:'st',ipa:null,eg:'step'},
        {g:'str',ipa:null,eg:'strap'},{g:'spr',ipa:null,eg:'spring'},
      ],
      practiceWords:[
        { word:'flat',  sounds:['fl','a','t'],   spoken:'fl  a  t' },
        { word:'step',  sounds:['st','e','p'],   spoken:'st  e  p' },
        { word:'strap', sounds:['str','a','p'],  spoken:'str  a  p' },
      ]},
  ],
  'word-types': [
    { term:'CVC Words', emoji:'🔢', color:'#D97706',
      definition:'Consonant-Vowel-Consonant — the simplest three-sound word pattern.',
      detail:'Every CVC word has exactly three phonemes: one consonant sound, one vowel sound, one consonant sound. Perfect for first reading practice. Tap any word to hear it.',
      tip:'🦉 Start here! CVC words are the foundation of all phonics reading.',
      demo:{ word:'cat', label:'"cat" is a CVC word: Consonant + Vowel + Consonant', sounds:['c','a','t'], ipas:['k','æ','t'], labels:['C','V','C'] },
      wordList:[
        {word:'cat', letters:['c','a','t'], pattern:['C','V','C']},
        {word:'pin', letters:['p','i','n'], pattern:['C','V','C']},
        {word:'hot', letters:['h','o','t'], pattern:['C','V','C']},
        {word:'sun', letters:['s','u','n'], pattern:['C','V','C']},
        {word:'bed', letters:['b','e','d'], pattern:['C','V','C']},
        {word:'mug', letters:['m','u','g'], pattern:['C','V','C']},
        {word:'lip', letters:['l','i','p'], pattern:['C','V','C']},
        {word:'fox', letters:['f','o','x'], pattern:['C','V','C']},
      ],
      practiceWords:[
        { word:'cat', sounds:['c','a','t'], spoken:'k  a  t' },
        { word:'pin', sounds:['p','i','n'], spoken:'p  i  n' },
        { word:'hot', sounds:['h','o','t'], spoken:'h  o  t' },
      ]},
    { term:'VC, CCVC and CVCC', emoji:'📐', color:'#0891B2',
      definition:'Variations on CVC showing increasing word complexity.',
      detail:'As children progress, words gain extra consonants. CCVC adds a consonant blend before the vowel. CVCC adds consonants after. Each step makes reading harder.',
      tip:'🦉 The pattern tells you how many consonant clusters surround the vowel.',
      wordList:[
        {word:'at',   letters:['a','t'],     pattern:['V','C'],     label:'VC'},
        {word:'up',   letters:['u','p'],     pattern:['V','C'],     label:'VC'},
        {word:'trap', letters:['tr','a','p'],pattern:['CC','V','C'],label:'CCVC'},
        {word:'clap', letters:['cl','a','p'],pattern:['CC','V','C'],label:'CCVC'},
        {word:'fast', letters:['f','a','st'],pattern:['C','V','CC'],label:'CVCC'},
        {word:'lamp', letters:['l','a','mp'],pattern:['C','V','CC'],label:'CVCC'},
      ],
      practiceWords:[
        { word:'trap', sounds:['tr','a','p'], spoken:'tr  a  p' },
        { word:'fast', sounds:['f','a','st'], spoken:'f  a  st' },
      ]},
    { term:'Tricky Words', emoji:'⚠️', color:'#EF4444',
      definition:'Irregular words that cannot be fully decoded using phonics rules.',
      detail:'Some of the most common English words are spelled in non-phonetic ways — "said" sounds like "sed", "the" has a schwa vowel. Children learn these by sight (memorisation), not by blending.',
      tip:'🦉 Tricky words are not phonics failures — English just has irregular history. Tap any word to hear it.',
      trickyWords:['the','said','was','have','they','come','some','do','to','you','are','were','where','there','here','love','give','live','water','what','who','could','would','should','one','once','any','many'],
      practiceWords:[
        { word:'said',  sounds:['s','ai','d'],  spoken:'said' },
        { word:'the',   sounds:['th','e'],       spoken:'the' },
        { word:'where', sounds:['wh','ere'],     spoken:'where' },
      ]},
  ],
  methods: [
    { term:'Synthetic Phonics', emoji:'🔬', color:'#2563EB',
      definition:'Teaching letter-sounds first, then blending them to build words.',
      detail:'The child first learns the 44 phonemes and their graphemes. Then they synthesise (build) words by blending phonemes together. This is the UK government approach used in all state schools — and what Properly uses.',
      tip:'🦉 Every Properly reading session practises blending real phonemes. That is synthetic phonics in action.',
      badge:'✅ Used by Properly',
      steps:[
        { n:'1', emoji:'👂', label:'Learn sounds',  eg:'/s/, /a/, /t/, /p/, /i/, /n/...' },
        { n:'2', emoji:'🧩', label:'Blend to read', eg:'/s/+/a/+/t/ → sat' },
        { n:'3', emoji:'📖', label:'More phonemes', eg:'/ch/, /sh/, /ai/, /ee/...' },
        { n:'4', emoji:'🌟', label:'More words',    eg:'chat, rain, night, cake...' },
      ],
      demoWords:['sat','pin','hot','chat','rain','night','cake','blend'],
      practiceWords:[
        { word:'sat',  sounds:['s','a','t'],  spoken:'s  a  t' },
        { word:'chat', sounds:['ch','a','t'], spoken:'ch  a  t' },
      ]},
    { term:'Analytic Phonics', emoji:'🔍', color:'#7C3AED',
      definition:'Teaching phonics by analysing patterns in familiar whole words.',
      detail:'Rather than starting with sounds, the child starts with known whole words and identifies letter patterns. Seeing "cat", "car", "cup" all start with "c" teaches that c = /k/.',
      tip:'🦉 Analytic phonics works alongside synthetic phonics. Parents use it naturally when pointing out word patterns.',
      badge:'📚 Complementary approach',
      steps:[
        { n:'1', emoji:'📝', label:'Start with whole words', eg:'cat, car, cup' },
        { n:'2', emoji:'🔍', label:'Spot the pattern',       eg:'all start with "c"' },
        { n:'3', emoji:'💡', label:'Learn the sound',        eg:'"c" → /k/' },
        { n:'4', emoji:'🌱', label:'Apply to new words',     eg:'cod, cut, cot' },
      ],
      demoWords:['cat','car','cup','cod','cut','cot'],
      practiceWords:[
        { word:'cat', sounds:['c','a','t'], spoken:'k  a  t' },
        { word:'cup', sounds:['c','u','p'], spoken:'k  u  p' },
      ]},
  ],
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? '#059669' : s >= 50 ? '#D97706' : '#EF4444';
const scoreEmoji = (s) => s >= 80 ? '⭐' : s >= 50 ? '👍' : '🔄';
const PATTERN_COLORS = { C:'#7C3AED', V:'#EF4444', CC:'#7C3AED' };

// ── SOUND TILE — light interior version ───────────────────────────────────────
function SoundTile({ g, ipa, eg, color, size = 'md' }) {
  const { playGrapheme } = usePhonemePlayer();
  const { playWord } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  const isLg = size === 'lg';

  const click = async () => {
    setActive(true);
    await playGrapheme(g);
    if (eg) { await new Promise(r => setTimeout(r, 280)); playWord(eg); }
    setTimeout(() => setActive(false), 500);
  };

  return (
    <button onClick={click} title={`Tap to hear /${g}/ — as in "${eg}"`}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3,
        padding: isLg ? '12px 14px' : '8px 10px',
        borderRadius:14, cursor:'pointer', minWidth: isLg ? 60 : 48,
        border:`2px solid ${active ? color : color+'30'}`,
        background: active ? color : `${color}08`,
        transform: active ? 'scale(1.1) translateY(-3px)' : 'scale(1)',
        boxShadow: active ? `0 6px 18px ${color}40` : '0 1px 4px rgba(0,0,0,0.06)',
        transition:'all 0.15s' }}>
      <span style={{ fontSize: isLg ? 20 : 16, fontWeight:900, color: active ? '#fff' : color, letterSpacing:'0.01em' }}>{g}</span>
      {ipa && <span style={{ fontSize:9, color: active ? 'rgba(255,255,255,0.8)' : `${color}90`, fontFamily:'var(--font-mono)' }}>/{ipa}/</span>}
      {eg  && <span style={{ fontSize: isLg ? 10 : 9, color: active ? 'rgba(255,255,255,0.75)' : '#9CA3AF', fontWeight:600 }}>{eg}</span>}
      <span style={{ fontSize:10, color: active ? 'rgba(255,255,255,0.6)' : '#D1D5DB' }}>🔊</span>
    </button>
  );
}

// ── WORD TILE — light interior ────────────────────────────────────────────────
function WordTile({ word, letters, pattern, label, color }) {
  const { playWord } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  const click = () => { setActive(true); playWord(word); setTimeout(() => setActive(false), 900); };
  return (
    <button onClick={click} title={`Tap to hear: ${word}`}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
        padding:'10px 14px', borderRadius:14, cursor:'pointer',
        border:`2px solid ${active ? color : color+'25'}`,
        background: active ? color : `${color}08`,
        transform: active ? 'scale(1.06) translateY(-3px)' : 'scale(1)',
        boxShadow: active ? `0 6px 18px ${color}40` : '0 1px 4px rgba(0,0,0,0.06)',
        transition:'all 0.15s' }}>
      {pattern && (
        <div style={{ display:'flex', gap:2 }}>
          {pattern.map((p,i) => (
            <span key={i} style={{ fontSize:8, fontWeight:700, padding:'1px 4px', borderRadius:3,
              background: active ? 'rgba(255,255,255,0.2)' : `${PATTERN_COLORS[p]||'#6B7280'}15`,
              color: active ? 'rgba(255,255,255,0.9)' : PATTERN_COLORS[p]||'#6B7280' }}>{p}</span>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:1 }}>
        {(letters||[word]).map((l,i) => (
          <span key={i} style={{ fontSize:17, fontWeight:900, color: active ? '#fff' : color }}>{l}</span>
        ))}
      </div>
      {label && <span style={{ fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:50,
        background: active ? 'rgba(255,255,255,0.2)' : `${color}15`, color: active ? '#fff' : color }}>{label}</span>}
      <span style={{ fontSize:9, color: active ? 'rgba(255,255,255,0.6)' : '#D1D5DB' }}>🔊</span>
    </button>
  );
}

function TrickyTile({ word }) {
  const { playWord } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => { setActive(true); playWord(word); setTimeout(() => setActive(false), 700); }}
      style={{ padding:'6px 13px', borderRadius:10, cursor:'pointer',
        border:`1.5px solid ${active ? '#EF4444' : '#FECACA'}`,
        background: active ? '#FEF2F2' : '#FFF5F5',
        color: active ? '#B91C1C' : '#EF4444',
        fontSize:13, fontWeight:700,
        transform: active ? 'scale(1.05)' : 'scale(1)',
        transition:'all 0.12s', boxShadow: active ? '0 4px 12px rgba(239,68,68,0.2)' : 'none' }}>
      {word} 🔊
    </button>
  );
}

// ── STEP-BY-STEP PHONEME DEMO ─────────────────────────────────────────────────
function PhonemeDemo({ demo, color }) {
  const { playGrapheme, playWordByPhonemes, playWord } = usePhonemePlayer();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);

  if (!demo) return null;

  const playAll = async () => {
    if (playing) return;
    setPlaying(true);
    if (demo.blending || demo.segmenting) {
      // Play each phoneme with gap then the whole word
      for (let i = 0; i < demo.sounds.length; i++) {
        setActiveIdx(i);
        await playGrapheme(demo.sounds[i]);
        await new Promise(r => setTimeout(r, 300));
      }
      setActiveIdx(-1);
      await new Promise(r => setTimeout(r, 400));
      if (demo.blending || demo.encoding) {
        playWord(demo.word);
      }
    } else {
      // Play each phoneme in turn
      for (let i = 0; i < demo.sounds.length; i++) {
        setActiveIdx(i);
        await playGrapheme(demo.sounds[i]);
        await new Promise(r => setTimeout(r, 350));
      }
      setActiveIdx(-1);
    }
    setPlaying(false);
  };

  const playOne = async (idx) => {
    setActiveIdx(idx);
    await playGrapheme(demo.sounds[idx]);
    setTimeout(() => setActiveIdx(-1), 400);
  };

  return (
    <div style={{ background:`${color}06`, border:`1.5px solid ${color}20`, borderRadius:16,
      padding:'14px 16px', marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:`${color}`, textTransform:'uppercase',
        letterSpacing:'0.5px', marginBottom:10 }}>
        🔬 {demo.label}
      </div>
      {/* Phoneme tiles row */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:10 }}>
        {demo.sounds.map((s, i) => {
          const isHL = demo.highlight && demo.highlight.includes(i);
          const isActive = activeIdx === i;
          const isSilent = demo.splitDigraph && i === demo.sounds.length - 1;
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <button onClick={() => playOne(i)}
                title={`Tap to hear /${s}/`}
                style={{ padding:'8px 14px', borderRadius:10, cursor:'pointer', minWidth:42,
                  border:`2px solid ${isActive ? color : isHL ? color : color+'30'}`,
                  background: isActive ? color : isHL ? `${color}20` : isSilent ? '#F9FAFB' : `${color}08`,
                  transform: isActive ? 'scale(1.12) translateY(-3px)' : 'scale(1)',
                  boxShadow: isActive ? `0 4px 14px ${color}40` : 'none',
                  transition:'all 0.15s', opacity: isSilent ? 0.4 : 1 }}>
                <span style={{ fontSize:18, fontWeight:900, color: isActive ? '#fff' : isHL ? color : '#374151',
                  fontFamily:'var(--font-display)' }}>{s}</span>
              </button>
              {demo.ipas && demo.ipas[i] && (
                <span style={{ fontSize:9, color:'#9CA3AF', fontFamily:'var(--font-mono)' }}>
                  /{demo.ipas[i]}/
                </span>
              )}
              {demo.labels && (
                <span style={{ fontSize:9, fontWeight:700, color: PATTERN_COLORS[demo.labels[i]] || '#9CA3AF' }}>
                  {demo.labels[i]}
                </span>
              )}
            </div>
          );
        })}
        {(demo.blending || demo.encoding) && (
          <>
            <span style={{ fontSize:18, color:'#9CA3AF', fontWeight:700 }}>→</span>
            <button onClick={() => { playWord(demo.word); }}
              title={`Tap to hear the whole word: ${demo.word}`}
              style={{ padding:'8px 16px', borderRadius:10, cursor:'pointer',
                border:`2px solid ${color}40`, background:`${color}12`,
                boxShadow:'0 2px 8px rgba(0,0,0,0.08)', transition:'all 0.15s' }}>
              <span style={{ fontSize:20, fontWeight:900, color }}>{demo.word}</span>
            </button>
          </>
        )}
        {demo.segmenting && (
          <>
            <span style={{ fontSize:18, color:'#9CA3AF', fontWeight:700, transform:'scaleX(-1)', display:'inline-block' }}>→</span>
            <span style={{ fontSize:20, fontWeight:900, color:'#374151' }}>{demo.word}</span>
          </>
        )}
      </div>
      {/* Play all button */}
      <button onClick={playAll} disabled={playing}
        style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 16px',
          borderRadius:50, border:`1.5px solid ${color}40`, background:`${color}10`,
          color, cursor:'pointer', fontSize:12, fontWeight:700,
          opacity: playing ? 0.6 : 1, transition:'all 0.15s' }}>
        {playing ? '▶ Playing…' : demo.blending ? '▶ Blend it!' : demo.segmenting ? '▶ Segment it!' : '▶ Play all phonemes'}
      </button>
    </div>
  );
}

// ── PRACTICE ROW — light interior ─────────────────────────────────────────────
function PracticeRow({ word, sounds, spoken, accentColor }) {
  const { playWord } = usePhonemePlayer();
  const { startRecording, stopRecording } = useAudioRecorder();
  const [phase, setPhase] = useState('idle');
  const [score, setScore] = useState(null);
  const timerRef = useRef(null);

  const hear = () => playWord(word);

  const practise = async () => {
    if (phase === 'listening') {
      clearTimeout(timerRef.current);
      const blob = await stopRecording();
      if (blob) await runScore(blob);
      return;
    }
    setScore(null); setPhase('listening');
    const ok = await startRecording();
    if (!ok) { setPhase('idle'); return; }
    timerRef.current = setTimeout(async () => {
      const blob = await stopRecording();
      if (blob) await runScore(blob);
    }, 3000);
  };

  const runScore = async (blob) => {
    setPhase('thinking');
    try {
      const res = await speechAPI.assess(blob, word);
      const s = res?.data?.accuracyScore ?? res?.data?.words?.[0]?.accuracyScore ?? null;
      setScore(s);
    } catch { setScore(null); }
    setPhase('result');
  };

  const sc = score;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      padding:'10px 14px', borderRadius:14,
      background: phase === 'result' && sc != null ? `${scoreColor(sc)}08` : '#F9FAFB',
      border:`1.5px solid ${phase === 'result' && sc != null ? scoreColor(sc)+'30' : '#E5E7EB'}`,
      transition:'all 0.3s' }}>
      {/* Grapheme breakdown tiles */}
      <div style={{ display:'flex', gap:4, alignItems:'center', flex:1, flexWrap:'wrap' }}>
        {sounds.map((s, i) => (
          <span key={i} style={{ padding:'4px 10px', borderRadius:8, fontSize:14, fontWeight:900,
            background:`${accentColor}12`, color:accentColor,
            border:`1.5px solid ${accentColor}25` }}>{s}</span>
        ))}
        <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:2 }}>
          = <strong style={{ color:'#374151', fontSize:15 }}>{word}</strong>
        </span>
      </div>
      {/* Controls */}
      <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
        <button onClick={hear}
          style={{ padding:'6px 14px', borderRadius:50,
            border:`1.5px solid ${accentColor}35`, background:`${accentColor}08`,
            color:accentColor, cursor:'pointer', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', gap:5 }}>
          🔊 Hear
        </button>
        <button onClick={practise}
          style={{ padding:'6px 14px', borderRadius:50,
            border:`1.5px solid ${phase==='listening'?'#EF4444':accentColor}50`,
            background: phase==='listening' ? '#FEF2F2' : `${accentColor}08`,
            color: phase==='listening' ? '#EF4444' : accentColor,
            cursor:'pointer', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', gap:5,
            animation: phase==='listening' ? 'pl-pulse 1s infinite' : 'none' }}>
          {phase==='idle'     && <><span>🎤</span> Try</>}
          {phase==='listening'&& <><span>⏹</span> Stop</>}
          {phase==='thinking' && <><span>⏳</span> Scoring…</>}
          {phase==='result'   && <><span>🎤</span> Again</>}
        </button>
        {phase === 'result' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ padding:'4px 10px', borderRadius:50, fontSize:12, fontWeight:800,
              background: sc!=null ? `${scoreColor(sc)}15` : '#F3F4F6',
              color: sc!=null ? scoreColor(sc) : '#6B7280',
              border:`1px solid ${sc!=null ? scoreColor(sc)+'30' : '#E5E7EB'}` }}>
              {sc!=null ? `${scoreEmoji(sc)} ${Math.round(sc)}%` : '✓ Done'}
            </span>
            {sc!=null && (
              <div style={{ width:60, height:4, borderRadius:2, background:'#F3F4F6', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${sc}%`, background:scoreColor(sc), borderRadius:2 }}/>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── METHOD STEPS ──────────────────────────────────────────────────────────────
function MethodSteps({ steps, color }) {
  if (!steps) return null;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
      {steps.map((st, i) => (
        <div key={i} style={{ padding:'12px 14px', borderRadius:14,
          background:`${color}08`, border:`1.5px solid ${color}20` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:22, height:22, borderRadius:'50%', background:color,
              color:'#fff', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {st.n}
            </span>
            <span style={{ fontSize:13, color }}>  {st.emoji}</span>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:3 }}>{st.label}</div>
          <div style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.4 }}>{st.eg}</div>
        </div>
      ))}
    </div>
  );
}

// ── CONCEPT DETAIL — light interior ──────────────────────────────────────────
function ConceptDetail({ concept, accentColor }) {
  const { sayText } = useAzureTTS();
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{ animation:'pl-fadeUp 0.18s ease' }}>
      {/* Phonics breakdown of the term itself — shown first */}
      <TermPhonicsBreakdown term={concept.term} accentColor={accentColor} />

      <p style={{ fontSize:13, color:'#4B5563', lineHeight:1.75, marginBottom:16 }}>
        {concept.detail}
      </p>

      {/* Primary phoneme demo */}
      <PhonemeDemo demo={concept.demo} color={accentColor} />

      {/* More demos */}
      {concept.moreDemos && concept.moreDemos.length > 0 && (
        <div style={{ marginBottom:16 }}>
          {!showMore ? (
            <button onClick={() => setShowMore(true)}
              style={{ fontSize:12, fontWeight:600, color:accentColor, background:'transparent',
                border:`1px solid ${accentColor}30`, borderRadius:8, padding:'5px 12px', cursor:'pointer' }}>
              + {concept.moreDemos.length} more examples
            </button>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {concept.moreDemos.map((d, i) => (
                <PhonemeDemo key={i} demo={d} color={accentColor} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sound tiles */}
      {concept.soundTiles && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:10 }}>🔊 Tap each sound tile to hear the real phoneme</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {concept.soundTiles.map(t => <SoundTile key={t.g} g={t.g} ipa={t.ipa} eg={t.eg} color={accentColor} size="lg" />)}
          </div>
        </div>
      )}

      {/* Word list */}
      {concept.wordList && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:10 }}>🔊 Tap any word to hear it pronounced</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {concept.wordList.map(w => <WordTile key={w.word} {...w} color={accentColor} />)}
          </div>
        </div>
      )}

      {/* Tricky words */}
      {concept.trickyWords && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:10 }}>🔊 Tap to hear — these must be memorised, not decoded!</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {concept.trickyWords.map(w => <TrickyTile key={w} word={w} />)}
          </div>
        </div>
      )}

      {/* Method steps */}
      <MethodSteps steps={concept.steps} color={accentColor} />

      {/* Demo words */}
      {concept.demoWords && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:10 }}>🔊 Example words — tap to hear</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {concept.demoWords.map(w => <WordTile key={w} word={w} color={accentColor} />)}
          </div>
        </div>
      )}

      {/* Practice rows */}
      {concept.practiceWords && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:10 }}>🎤 Hear it · Say it · Get a score</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {concept.practiceWords.map(pw => (
              <PracticeRow key={pw.word} word={pw.word} sounds={pw.sounds} spoken={pw.spoken} accentColor={accentColor} />
            ))}
          </div>
        </div>
      )}

      {/* Owl tip */}
      <div style={{ background:'#F5F3FF', borderRadius:12, padding:'12px 16px',
        border:'1.5px solid #DDD6FE', fontSize:12, color:'#5B21B6', lineHeight:1.7 }}>
        {concept.tip}
      </div>
    </div>
  );
}

// ── CONCEPT CARD ──────────────────────────────────────────────────────────────
function ConceptCard({ concept, accentColor, isOpen, onToggle, index }) {
  const { sayText } = useAzureTTS();
  return (
    <div className="animate-slide-up" style={{ animationDelay:`${index * 0.05}s`,
      background:'white', borderRadius:22, overflow:'hidden',
      boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.18)' : 'var(--shadow-lg)',
      border:`2px solid ${isOpen ? accentColor+'40' : 'transparent'}`,
      transition:'box-shadow 0.2s, border-color 0.2s' }}>

      <button onClick={onToggle}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:14,
          padding:'16px 18px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = `${accentColor}04`; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>

        <div style={{ width:52, height:52, borderRadius:16,
          background: isOpen ? `linear-gradient(135deg,${accentColor},${accentColor}CC)` : `${accentColor}12`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0,
          boxShadow: isOpen ? `0 4px 14px ${accentColor}45` : 'none', transition:'all 0.2s' }}>
          {concept.emoji}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontWeight:900, fontSize:15, color:'#111827' }}>{concept.term}</span>
            {concept.badge && (
              <span style={{ fontSize:10, fontWeight:700, background:`${accentColor}12`,
                color:accentColor, borderRadius:50, padding:'2px 8px', border:`1px solid ${accentColor}25` }}>
                {concept.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:'#6B7280', marginTop:2, lineHeight:1.4 }}>{concept.definition}</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <button onClick={e => { e.stopPropagation(); sayText(`${concept.term}. ${concept.definition}`); }}
            title="Hear definition"
            style={{ background:`${accentColor}10`, border:`1px solid ${accentColor}20`,
              borderRadius:50, width:28, height:28, cursor:'pointer', fontSize:13,
              display:'flex', alignItems:'center', justifyContent:'center', color:accentColor }}>
            🔊
          </button>
          <div style={{ width:32, height:32, borderRadius:'50%',
            background: isOpen ? accentColor : `${accentColor}10`,
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
            <span style={{ fontSize:14, color: isOpen?'white':accentColor,
              transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.2s', display:'block' }}>▾</span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding:'0 20px 20px', borderTop:`1px solid ${accentColor}15` }}>
          <ConceptDetail concept={concept} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
}

// ── ALPHABET CARD ─────────────────────────────────────────────────────────────
function AlphabetCard({ index }) {
  const { playGrapheme, playWord } = usePhonemePlayer();
  const { startRecording, stopRecording } = useAudioRecorder();
  const [isOpen, setIsOpen] = useState(false);
  const [activeL, setActiveL] = useState(null);
  const [states, setStates] = useState({});
  const timerRef = useRef(null);

  const hear = async (item) => {
    setActiveL(item.l);
    await playGrapheme(item.l);
    await new Promise(r => setTimeout(r, 250));
    playWord(item.eg);
    setTimeout(() => setActiveL(null), 1200);
  };

  const practise = async (item) => {
    if (states[item.l] === 'listening') {
      clearTimeout(timerRef.current);
      const blob = await stopRecording();
      if (blob) await doScore(blob, item);
      return;
    }
    setStates(p => ({...p, [item.l]:'listening'}));
    playWord(item.eg);
    setTimeout(async () => {
      const ok = await startRecording();
      if (!ok) { setStates(p => ({...p, [item.l]:'idle'})); return; }
      timerRef.current = setTimeout(async () => {
        const blob = await stopRecording();
        if (blob) await doScore(blob, item);
      }, 2500);
    }, 500);
  };

  const doScore = async (blob, item) => {
    setStates(p => ({...p, [item.l]:'thinking'}));
    try {
      const res = await speechAPI.assess(blob, item.eg);
      const sc = res?.data?.accuracyScore ?? res?.data?.words?.[0]?.accuracyScore ?? null;
      setStates(p => ({...p, [item.l]:{ score:sc }}));
    } catch { setStates(p => ({...p, [item.l]:{ score:null }})); }
  };

  return (
    <div className="animate-slide-up" style={{ animationDelay:`${index * 0.05}s`,
      background:'white', borderRadius:22, overflow:'hidden',
      boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.18)' : 'var(--shadow-lg)',
      border:`2px solid ${isOpen ? '#7C3AED40' : 'transparent'}`,
      transition:'all 0.2s' }}>

      <button onClick={() => setIsOpen(v => !v)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:14,
          padding:'16px 18px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ width:52, height:52, borderRadius:16,
          background: isOpen ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : '#7C3AED12',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0,
          boxShadow: isOpen ? '0 4px 14px rgba(124,58,237,0.4)' : 'none', transition:'all 0.2s' }}>
          🔤
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:15, color:'#111827' }}>Alphabet Sounds</div>
          <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
            Tap any letter to hear its real phoneme sound + example word · 🎤 record yourself & score
          </div>
        </div>
        <div style={{ width:32, height:32, borderRadius:'50%',
          background: isOpen ? '#7C3AED' : '#7C3AED10',
          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>
          <span style={{ fontSize:14, color:isOpen?'white':'#7C3AED',
            transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.2s', display:'block' }}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding:'0 18px 20px', borderTop:'1px solid rgba(124,58,237,0.1)' }}>
          <p style={{ fontSize:12, color:'#6B7280', marginBottom:14, lineHeight:1.5 }}>
            Tap a letter to hear its <strong style={{ color:'#374151' }}>phoneme sound</strong> (not the letter name) followed by an example word.
            Then tap <strong style={{ color:'#374151' }}>🎤</strong> to say the example word yourself and get a score!
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(88px,1fr))', gap:7 }}>
            {ALPHABET.map(item => {
              const st = states[item.l];
              const score = st && typeof st === 'object' ? st.score : null;
              const isL = st === 'listening', isT = st === 'thinking';
              const sc = scoreColor(score || 0);
              return (
                <div key={item.l}
                  style={{ borderRadius:14, border:`1.5px solid ${activeL===item.l?'#7C3AED':'#E5E7EB'}`,
                    background: activeL===item.l ? '#F5F3FF' : '#FAFAFA',
                    padding:'8px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                    transition:'all 0.15s', boxShadow: activeL===item.l ? '0 4px 12px rgba(124,58,237,0.15)' : 'none' }}>
                  <button onClick={() => hear(item)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <span style={{ fontSize:22, fontWeight:900, color:'#7C3AED', lineHeight:1 }}>{item.l.toUpperCase()}</span>
                    <span style={{ fontSize:9, color:'#9CA3AF', fontFamily:'var(--font-mono)' }}>{item.ipa}</span>
                    <span style={{ fontSize:10, color:'rgba(124,58,237,0.6)', fontWeight:600 }}>{item.eg}</span>
                  </button>
                  <button onClick={() => practise(item)}
                    style={{ width:'100%', padding:'4px 0', borderRadius:8,
                      border:`1px solid ${isL?'rgba(239,68,68,0.4)':'rgba(124,58,237,0.2)'}`,
                      background: isL ? 'rgba(239,68,68,0.08)' : 'transparent',
                      color: isL ? '#EF4444' : '#9CA3AF',
                      cursor:'pointer', fontSize:10, fontWeight:600,
                      animation: isL ? 'pl-pulse 1s infinite' : 'none' }}>
                    {isL ? '⏹' : isT ? '⏳' : score != null ? `${Math.round(score)}%` : '🎤 say it'}
                  </button>
                  {score != null && (
                    <div style={{ width:'100%', height:3, borderRadius:2, background:`${sc}20`, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${score}%`, background:sc, borderRadius:2 }}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SECTION CARD ──────────────────────────────────────────────────────────────
function SectionCard({ section, index }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openConcept, setOpenConcept] = useState(null);
  const concepts = CONCEPT_DATA[section.id] || [];
  const toggle = (term) => setOpenConcept(p => p === term ? null : term);

  return (
    <div className="animate-slide-up" style={{ animationDelay:`${index * 0.06}s` }}>
      {/* Section header card */}
      <div style={{ background:'white', borderRadius:22, overflow:'hidden',
        boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.18)' : 'var(--shadow-lg)',
        border:`2px solid ${isOpen ? section.color+'40' : 'transparent'}`,
        transition:'all 0.2s',
        transform: isOpen ? 'none' : undefined }}>

        <button onClick={() => setIsOpen(v => !v)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:14,
            padding:'16px 18px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
          onMouseEnter={e => { if (!isOpen) { e.currentTarget.parentElement.style.transform='translateY(-3px)'; e.currentTarget.parentElement.style.boxShadow='var(--shadow-xl)'; }}}
          onMouseLeave={e => { if (!isOpen) { e.currentTarget.parentElement.style.transform='none'; e.currentTarget.parentElement.style.boxShadow='var(--shadow-lg)'; }}}>

          <div style={{ width:56, height:56, borderRadius:16,
            background: isOpen ? `linear-gradient(135deg,${section.color},${section.color}CC)` : `${section.color}12`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0,
            boxShadow: isOpen ? `0 4px 14px ${section.color}50` : 'none', transition:'all 0.2s' }}>
            {section.emoji}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:16, color:'#111827',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {section.title}
            </div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{section.subtitle}</div>
            {isOpen && concepts.length > 0 && (
              <div style={{ display:'flex', gap:5, marginTop:7, flexWrap:'wrap' }}>
                {concepts.map(c => (
                  <span key={c.term} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:50,
                    background:`${section.color}10`, color:section.color, border:`1px solid ${section.color}20` }}>
                    {c.emoji} {c.term}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ flexShrink:0, background: isOpen ? section.color : `${section.color}10`,
            color: isOpen ? 'white' : section.color,
            borderRadius:50, padding:'8px 16px', fontSize:12, fontWeight:900,
            boxShadow: isOpen ? `0 4px 14px ${section.color}45` : 'none',
            whiteSpace:'nowrap', textAlign:'center', transition:'all 0.2s', minWidth:64 }}>
            {isOpen ? '▲ Close' : '▶ Start'}
          </div>
        </button>
      </div>

      {/* Concept cards expand below with indent */}
      {isOpen && (
        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:8,
          paddingLeft:14, borderLeft:`3px solid ${section.color}30` }}>
          {concepts.map((concept, ci) => (
            <ConceptCard key={concept.term} concept={concept} accentColor={section.color}
              isOpen={openConcept === concept.term}
              onToggle={() => toggle(concept.term)}
              index={ci} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function PhonicsLearn({ childPhase = 2 }) {
  return (
    <div>
      <p style={{ color:'var(--overlay-50)', fontSize:11, fontWeight:800, letterSpacing:'0.8px', marginBottom:12 }}>
        🔤 PHONICS BASICS
      </p>

      {/* Phase strip */}
      <div style={{ background:'white', borderRadius:18, padding:'14px 18px', marginBottom:12, boxShadow:'var(--shadow-lg)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
          Your Phonics Phase Journey
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {PHASES.map(p => (
            <div key={p.n} style={{ flex:'1 1 0', minWidth:68, padding:'8px 10px', borderRadius:12,
              background: childPhase===p.n ? p.color : `${p.color}10`,
              border:`2px solid ${childPhase===p.n ? p.color : p.color+'20'}`,
              transition:'all 0.2s' }}>
              <div style={{ fontSize:13, fontWeight:900, color:childPhase===p.n?'white':p.color, marginBottom:1 }}>P{p.n}</div>
              <div style={{ fontSize:9, fontWeight:700, color:childPhase===p.n?'rgba(255,255,255,0.85)':p.color }}>{p.label}</div>
              <div style={{ fontSize:8, color:childPhase===p.n?'rgba(255,255,255,0.65)':'#9CA3AF' }}>{p.eg}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Card list */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <AlphabetCard index={0} />
        {SECTIONS.filter(s => s.id !== 'alphabet').map((section, i) => (
          <SectionCard key={section.id} section={section} index={i + 1} />
        ))}
      </div>

      <style>{`
        @keyframes pl-fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pl-pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
