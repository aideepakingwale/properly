/**
 * @file        PhonicsLearn.jsx
 * @description Interactive phonics tutor — TTS pronunciation + mic practice with Azure PA scoring.
 */
import { useState, useRef } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { usePhonemePlayer } from '../hooks/usePhonemePlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { speechAPI } from '../services/api';

// ── ALPHABET DATA ─────────────────────────────────────────────────────────
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

// ── SECTIONS ──────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id:'essentials', icon:'🔤', title:'Essential Phonics Terms', color:'#7C3AED',
    intro:'The six building blocks of phonics. Tap 🔊 to hear each term defined, then practise the example words with your microphone!',
    concepts:[
      { term:'Phoneme', definition:'The smallest unit of sound in a word.',
        detail:'English has around 44 phonemes. A phoneme is a sound, not a letter — "sh" is one phoneme even though it uses two letters.',
        tip:'🦉 Think of phonemes as the "sound atoms" of language.',
        practiceWords:[{word:'ship',sounds:['sh','i','p'],spoken:'sh  i  p'},{word:'chat',sounds:['ch','a','t'],spoken:'ch  a  t'},{word:'rain',sounds:['r','ai','n'],spoken:'r  ay  n'}]},
      { term:'Grapheme', definition:'The letter(s) that represent a phoneme on the page.',
        detail:'A single phoneme can be spelled many ways. The /f/ sound can be written as f (fan), ff (off), or ph (phone).',
        tip:'🦉 Graphemes are what you see; phonemes are what you hear.',
        practiceWords:[{word:'night',sounds:['n','igh','t'],spoken:'n  ie  t'},{word:'phone',sounds:['ph','o','n','e'],spoken:'f  oh  n'},{word:'off',sounds:['o','ff'],spoken:'o  f'}]},
      { term:'Blending', definition:'Merging individual sounds together to read a whole word.',
        detail:'Say each phoneme in order, then push them together smoothly. This is how children decode new words.',
        tip:'🦉 Blending is sounding out then "crashing" the sounds together.',
        practiceWords:[{word:'cat',sounds:['/k/','/æ/','/t/'],spoken:'k  a  t'},{word:'ship',sounds:['/ʃ/','/ɪ/','/p/'],spoken:'sh  i  p'},{word:'night',sounds:['/n/','/aɪ/','/t/'],spoken:'n  ie  t'}]},
      { term:'Segmenting', definition:'Breaking a spoken word into its individual sounds to spell it.',
        detail:'The opposite of blending. A child hears "dog" and segments it into /d/-/o/-/g/ to write it.',
        tip:'🦉 Blending reads words; segmenting spells them.',
        practiceWords:[{word:'fish',sounds:['f','i','sh'],spoken:'f  i  sh'},{word:'rain',sounds:['r','ai','n'],spoken:'r  ai  n'},{word:'jump',sounds:['j','u','m','p'],spoken:'j  u  m  p'}]},
      { term:'Decoding', definition:'Sounding out an unfamiliar written word using letter-sound knowledge.',
        detail:'When a child sees an unknown word, they use phonics to convert graphemes into phonemes and blend them.',
        tip:'🦉 A strong decoder can read any new word, even ones they have never seen.',
        practiceWords:[{word:'blend',sounds:['bl','e','nd'],spoken:'bl  e  nd'},{word:'stump',sounds:['st','u','mp'],spoken:'st  u  mp'}]},
      { term:'Encoding', definition:'Converting spoken sounds into written letters (spelling).',
        detail:'The reverse of decoding. The child hears /r/-/ai/-/n/ and writes "rain". Encoding is spelling using phonics.',
        tip:'🦉 Good decoders usually become good encoders — the skills reinforce each other.',
        practiceWords:[{word:'rain',sounds:['/r/','/eɪ/','/n/'],spoken:'r  ay  n'},{word:'boat',sounds:['/b/','/əʊ/','/t/'],spoken:'b  oh  t'}]},
    ],
  },
  {
    id:'letter-sound', icon:'🔡', title:'Letter-Sound Relationships', color:'#059669',
    intro:'Tap each sound tile to hear it pronounced out loud. Then record yourself saying the practice words!',
    concepts:[
      { term:'Digraph', definition:'Two letters that combine to make one single sound.',
        detail:'A digraph is written as two letters, but spoken as one phoneme. You cannot hear the individual letters — only the combined sound.',
        tip:'🦉 Phase 3 introduces digraphs. They are one of the biggest phonics milestones.',
        soundTiles:[
          {g:'sh',spoken:'sh as in ship',ipa:'/ʃ/'},{g:'ch',spoken:'ch as in chip',ipa:'/tʃ/'},
          {g:'th',spoken:'th as in the',ipa:'/ð/'},{g:'ng',spoken:'ng as in ring',ipa:'/ŋ/'},
          {g:'oa',spoken:'oa as in boat',ipa:'/əʊ/'},{g:'ai',spoken:'ai as in rain',ipa:'/eɪ/'},
          {g:'ee',spoken:'ee as in feet',ipa:'/iː/'},{g:'oo',spoken:'oo as in moon',ipa:'/uː/'},
          {g:'ar',spoken:'ar as in car',ipa:'/ɑː/'},{g:'or',spoken:'or as in fork',ipa:'/ɔː/'},
          {g:'ur',spoken:'ur as in turn',ipa:'/ɜː/'},{g:'ow',spoken:'ow as in cow',ipa:'/aʊ/'},
          {g:'oi',spoken:'oi as in coin',ipa:'/ɔɪ/'},
        ],
        practiceWords:[{word:'shop',sounds:['sh','o','p'],spoken:'sh  o  p'},{word:'chain',sounds:['ch','ai','n'],spoken:'ch  ay  n'},{word:'moon',sounds:['m','oo','n'],spoken:'m  oo  n'}]},
      { term:'Trigraph', definition:'Three letters that combine to make one single sound.',
        detail:'Like a digraph, but with three letters. The "igh" in "night" and "ear" in "hear" are common English trigraphs.',
        tip:'🦉 Trigraphs often trip children up — seeing three letters but hearing one sound feels counterintuitive.',
        soundTiles:[
          {g:'igh',spoken:'igh as in night',ipa:'/aɪ/'},{g:'ear',spoken:'ear as in hear',ipa:'/ɪə/'},
          {g:'air',spoken:'air as in chair',ipa:'/ɛː/'},{g:'ure',spoken:'ure as in pure',ipa:'/jʊə/'},
        ],
        practiceWords:[{word:'night',sounds:['n','igh','t'],spoken:'n  ie  t'},{word:'light',sounds:['l','igh','t'],spoken:'l  ie  t'},{word:'chair',sounds:['ch','air'],spoken:'ch  air'}]},
      { term:'Split Digraph', definition:'Two letters making one sound, separated by another letter — formerly "magic e".',
        detail:'The final "e" is silent but changes the vowel sound earlier in the word. Remove the "e" and the word completely changes.',
        tip:'🦉 The "e" at the end is silent but powerful — it makes the vowel say its name.',
        soundTiles:[
          {g:'a_e',spoken:'a magic e as in cake',ipa:'/eɪ/'},{g:'i_e',spoken:'i magic e as in bike',ipa:'/aɪ/'},
          {g:'o_e',spoken:'o magic e as in home',ipa:'/əʊ/'},{g:'u_e',spoken:'u magic e as in tune',ipa:'/juː/'},
        ],
        practiceWords:[{word:'cake',sounds:['c','a_e','k'],spoken:'k  ay  k'},{word:'bike',sounds:['b','i_e','k'],spoken:'b  ie  k'},{word:'home',sounds:['h','o_e','m'],spoken:'h  oh  m'}]},
      { term:'Consonant Blend', definition:'Two or more consonants together where each sound can still be heard.',
        detail:'Unlike digraphs, blends do NOT merge into one sound. Both consonant sounds remain audible — just spoken quickly together.',
        tip:'🦉 "ship": you CANNOT say /s/ and /h/ separately. "slip": you CAN say /s/ and /l/ separately. That is the difference.',
        soundTiles:[
          {g:'bl',spoken:'bl as in black',ipa:'/bl/'},{g:'br',spoken:'br as in bring',ipa:'/br/'},
          {g:'cl',spoken:'cl as in clap',ipa:'/kl/'},{g:'cr',spoken:'cr as in crab',ipa:'/kr/'},
          {g:'fl',spoken:'fl as in flag',ipa:'/fl/'},{g:'fr',spoken:'fr as in frog',ipa:'/fr/'},
          {g:'gr',spoken:'gr as in grab',ipa:'/ɡr/'},{g:'pl',spoken:'pl as in play',ipa:'/pl/'},
          {g:'st',spoken:'st as in step',ipa:'/st/'},{g:'str',spoken:'str as in strap',ipa:'/str/'},
          {g:'spr',spoken:'spr as in spring',ipa:'/spr/'},
        ],
        practiceWords:[{word:'flat',sounds:['fl','a','t'],spoken:'fl  a  t'},{word:'step',sounds:['st','e','p'],spoken:'st  e  p'},{word:'strap',sounds:['str','a','p'],spoken:'str  a  p'}]},
    ],
  },
  {
    id:'word-types', icon:'📝', title:'Word Structure and Types', color:'#D97706',
    intro:'Learn word patterns from simple to complex. Tap any word tile to hear it. Try recording yourself saying each one!',
    concepts:[
      { term:'CVC Words', definition:'Consonant-Vowel-Consonant: the simplest three-sound word pattern.',
        detail:'CVC words are introduced in Phase 2. Every sound is a single grapheme — ideal for first blending and segmenting practice.',
        tip:'🦉 Start here! CVC words are the foundation of all phonics reading.',
        wordList:[
          {word:'cat',pattern:['C','V','C'],letters:['c','a','t']},
          {word:'pin',pattern:['C','V','C'],letters:['p','i','n']},
          {word:'hot',pattern:['C','V','C'],letters:['h','o','t']},
          {word:'sun',pattern:['C','V','C'],letters:['s','u','n']},
          {word:'bed',pattern:['C','V','C'],letters:['b','e','d']},
          {word:'mug',pattern:['C','V','C'],letters:['m','u','g']},
        ]},
      { term:'VC, CCVC and CVCC', definition:'Variations on CVC showing increasing word complexity.',
        detail:'As children progress, words gain extra consonants at the start or end. CCVC adds a blend before the vowel; CVCC adds consonants after.',
        tip:'🦉 The pattern tells you how many consonant clusters surround the vowel.',
        wordList:[
          {word:'at',  pattern:['V','C'],     letters:['a','t'],     label:'VC'},
          {word:'up',  pattern:['V','C'],     letters:['u','p'],     label:'VC'},
          {word:'trap',pattern:['CC','V','C'],letters:['tr','a','p'],label:'CCVC'},
          {word:'clap',pattern:['CC','V','C'],letters:['cl','a','p'],label:'CCVC'},
          {word:'fast',pattern:['C','V','CC'],letters:['f','a','st'],label:'CVCC'},
          {word:'lamp',pattern:['C','V','CC'],letters:['l','a','mp'],label:'CVCC'},
        ]},
      { term:'Tricky Words', definition:'Irregular words that cannot be fully decoded using phonics rules.',
        detail:'Some of the most common English words are spelled in non-phonetic ways. Children need to learn them by sight rather than blending.',
        tip:'🦉 Tricky words are not phonics failures — English just has irregular history. Learn the top 100 and reading becomes dramatically easier.',
        trickyWords:['the','said','was','have','they','come','some','do','to','you','are','were','where','there','here','love','give','live','water','what','who','could','would','should','one','once']},
    ],
  },
  {
    id:'methods', icon:'🎓', title:'Phonics Teaching Methods', color:'#2563EB',
    intro:'Two main approaches to teaching phonics. Tap the example words to hear them, and practise your own pronunciation!',
    concepts:[
      { term:'Synthetic Phonics', definition:'Teaching letter-sounds first, then blending them to build words.',
        detail:'The child learns the 44 phonemes and their graphemes, then synthesises (builds) words by blending phonemes together. UK government-mandated for all state schools.',
        tip:'🦉 Synthetic phonics is what Properly teaches. Every reading session practises blending real phonemes.',
        badge:'✅ Used by Properly',
        demoWords:['sat','pin','hot','chat','rain','night','cake','blend']},
      { term:'Analytic Phonics', definition:'Teaching phonics by analysing patterns in familiar whole words.',
        detail:'Rather than starting with sounds, the child starts with known whole words and identifies the letter patterns within them.',
        tip:'🦉 Analytic phonics works alongside synthetic phonics. Parents naturally use it when pointing out letter patterns in words their child already knows.',
        badge:'📚 Complementary approach',
        demoWords:['cat','car','cup','cod','cut','cot']},
    ],
  },
];

const PHASES = [
  {n:2,color:'#10B981',label:'Simple CVC',     eg:'sat, pin'},
  {n:3,color:'#3B82F6',label:'Digraphs',        eg:'chat, rain'},
  {n:4,color:'#8B5CF6',label:'Blends',          eg:'flat, step'},
  {n:5,color:'#F59E0B',label:'Split Digraphs',  eg:'cake, home'},
  {n:6,color:'#EF4444',label:'Morphemes',       eg:'unhappy'},
];

// ── PRACTICE BUTTON ───────────────────────────────────────────────────────
function PracticeButton({ targetWord, targetText, color }) {
  const { startRecording, stopRecording } = useAudioRecorder();
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);

  const { playGrapheme, playWordByPhonemes, playWord } = usePhonemePlayer();
  // Remove inner useSpeech since we use usePhonemePlayer instead
  const hearFn = async () => {
    // Play word naturally, giving child the full sound to imitate
    playWord(targetWord);
  };

  const practise = async () => {
    if (phase === 'listening') {
      clearTimeout(timerRef.current);
      const blob = await stopRecording();
      if (!blob) { setPhase('idle'); return; }
      await score(blob);
      return;
    }
    setResult(null); setPhase('listening');
    const ok = await startRecording();
    if (!ok) { setPhase('idle'); return; }
    timerRef.current = setTimeout(async () => {
      const blob = await stopRecording();
      if (!blob) { setPhase('idle'); return; }
      await score(blob);
    }, 3000);
  };

  const score = async (blob) => {
    setPhase('thinking');
    try {
      const res = await speechAPI.assess(blob, targetWord);
      const s = res?.data?.accuracyScore ?? res?.data?.words?.[0]?.accuracyScore ?? null;
      setResult({ score: s });
    } catch { setResult({ score: null }); }
    setPhase('result');
  };

  const sc = result?.score;
  const scColor = sc >= 80 ? '#059669' : sc >= 50 ? '#D97706' : '#EF4444';
  const scEmoji = sc >= 80 ? '⭐' : sc >= 50 ? '👍' : '🔄';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
      <button onClick={hearFn}
        style={{ padding:'5px 12px', borderRadius:50, border:`1.5px solid ${color}40`,
          background:`${color}10`, color, cursor:'pointer', fontSize:12, fontWeight:700 }}>
        🔊 Hear it
      </button>
      <button onClick={practise}
        style={{ padding:'5px 12px', borderRadius:50,
          border:`1.5px solid ${phase==='listening'?'#EF4444':color}60`,
          background:phase==='listening'?'#FEF2F2':`${color}10`,
          color:phase==='listening'?'#EF4444':color,
          cursor:'pointer', fontSize:12, fontWeight:700,
          animation:phase==='listening'?'pl-pulse 1s infinite':'none' }}>
        {phase==='idle'     && '🎤 Try it'}
        {phase==='listening'&& '⏹ Stop'}
        {phase==='thinking' && '⏳ Checking…'}
        {phase==='result'   && '🎤 Again'}
      </button>
      {phase==='result' && result && (
        <span style={{ padding:'4px 10px', borderRadius:50, fontSize:12, fontWeight:800,
          background: sc!=null?`${scColor}15`:'#F3F4F6',
          color:sc!=null?scColor:'#6B7280',
          border:`1px solid ${sc!=null?scColor+'40':'#E5E7EB'}` }}>
          {sc!=null ? `${scEmoji} ${Math.round(sc)}%` : '✓ Done'}
        </span>
      )}
    </div>
  );
}

// ── SOUND TILE ────────────────────────────────────────────────────────────
function SoundTile({ g, spoken, ipa, color }) {
  const { playGrapheme } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  const click = async () => {
    setActive(true);
    // Play the real cached Azure phoneme sound — not the letter name
    await playGrapheme(g, spoken);
    setTimeout(() => setActive(false), 200);
  };
  return (
    <button onClick={click} title={`Hear: ${spoken}`}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2,
        padding:'10px 12px', borderRadius:12, cursor:'pointer', minWidth:50,
        border:`2px solid ${active?color:color+'35'}`,
        background:active?color:`${color}10`,
        transform:active?'scale(1.1)':'scale(1)', transition:'all 0.15s' }}>
      <span style={{ fontSize:17, fontWeight:900, color:active?'#fff':color }}>{g}</span>
      <span style={{ fontSize:9, color:active?'rgba(255,255,255,0.8)':'#9CA3AF', fontFamily:'var(--font-mono)' }}>{ipa}</span>
      <span style={{ fontSize:9, color:active?'rgba(255,255,255,0.65)':'#9CA3AF' }}>🔊</span>
    </button>
  );
}

// ── WORD TILE ─────────────────────────────────────────────────────────────
function WordTile({ word, pattern, letters, label, color }) {
  const { playWord } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  const PC = { C:'#7C3AED', V:'#EF4444', CC:'#7C3AED' };
  const click = () => { setActive(true); playWord(word); setTimeout(()=>setActive(false),900); };
  return (
    <button onClick={click} title={`Hear: ${word}`}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
        padding:'10px 14px', borderRadius:14, cursor:'pointer',
        border:`2px solid ${active?color:color+'30'}`,
        background:active?color:`${color}08`,
        transform:active?'scale(1.06)':'scale(1)', transition:'all 0.15s' }}>
      {pattern && (
        <div style={{ display:'flex', gap:2 }}>
          {pattern.map((p,i) => (
            <span key={i} style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4,
              background:`${PC[p]||'#6B7280'}20`, color:PC[p]||'#6B7280' }}>{p}</span>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:1 }}>
        {(letters||[word]).map((l,i) => (
          <span key={i} style={{ fontSize:17, fontWeight:900, color:active?'#fff':color }}>{l}</span>
        ))}
      </div>
      {label && <span style={{ fontSize:8, fontWeight:700, color:active?'rgba(255,255,255,0.7)':color+'80' }}>{label}</span>}
      <span style={{ fontSize:9, color:active?'rgba(255,255,255,0.6)':'#9CA3AF' }}>🔊</span>
    </button>
  );
}

function TrickyTile({ word }) {
  const { playWord } = usePhonemePlayer();
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => { setActive(true); playWord(word); setTimeout(()=>setActive(false),700); }}
      style={{ padding:'5px 12px', borderRadius:8, cursor:'pointer',
        border:`1.5px solid ${active?'#EF4444':'#FECACA'}`,
        background:active?'#FEF2F2':'#FFF5F5', color:active?'#991B1B':'#DC2626',
        fontSize:13, fontWeight:700,
        transform:active?'scale(1.05)':'scale(1)', transition:'all 0.12s' }}>
      {word} 🔊
    </button>
  );
}

// ── ALPHABET EXPLORER ──────────────────────────────────────────────────────
function AlphabetExplorer() {
  const { playGrapheme, playWord } = usePhonemePlayer();
  const { speak } = useSpeech();
  const { startRecording, stopRecording } = useAudioRecorder();
  const [activeL, setActiveL] = useState(null);
  const [states, setStates]   = useState({});
  const timerRef = useRef(null);

  const hear = async (item) => {
    setActiveL(item.l);
    // Play isolated phoneme sound from Azure cache, then say the example word
    await playGrapheme(item.l, item.eg);
    await new Promise(r => setTimeout(r, 250));
    playWord(item.eg);
    setTimeout(() => setActiveL(null), 1200);
  };

  const practise = async (item) => {
    const cur = states[item.l];
    if (cur === 'listening') {
      clearTimeout(timerRef.current);
      const blob = await stopRecording();
      if (!blob) { setStates(p=>({...p,[item.l]:'idle'})); return; }
      await doScore(blob, item);
      return;
    }
    setStates(p=>({...p,[item.l]:'listening'}));
    playWord(item.eg);
    setTimeout(async () => {
      const ok = await startRecording();
      if (!ok) { setStates(p=>({...p,[item.l]:'idle'})); return; }
      timerRef.current = setTimeout(async () => {
        const blob = await stopRecording();
        if (!blob) { setStates(p=>({...p,[item.l]:'idle'})); return; }
        await doScore(blob, item);
      }, 2500);
    }, 600);
  };

  const doScore = async (blob, item) => {
    setStates(p=>({...p,[item.l]:'thinking'}));
    try {
      const res = await speechAPI.assess(blob, item.eg);
      const sc = res?.data?.accuracyScore ?? res?.data?.words?.[0]?.accuracyScore ?? null;
      setStates(p=>({...p,[item.l]:{ score:sc }}));
    } catch { setStates(p=>({...p,[item.l]:{ score:null }})); }
  };

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:16, padding:16, marginBottom:20, boxShadow:'var(--shadow-sm)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
        letterSpacing:'0.6px', marginBottom:4 }}>🔤 Alphabet Sound Explorer</div>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:14 }}>
        Tap any letter to hear its sound and an example word. Tap 🎤 to record yourself — you will get a score!
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:6 }}>
        {ALPHABET.map(item => {
          const st = states[item.l];
          const score = st && typeof st==='object' ? st.score : null;
          const isL = st==='listening', isT = st==='thinking';
          const sc = score != null ? score : null;
          const scColor = sc >= 80 ? '#059669' : sc >= 50 ? '#D97706' : '#EF4444';
          return (
            <div key={item.l} style={{ borderRadius:12, border:`1.5px solid ${activeL===item.l?'#7C3AED':'var(--border)'}`,
              background:activeL===item.l?'#F5F3FF':'var(--surface-2)',
              padding:'8px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              transition:'all 0.15s' }}>
              <button onClick={() => hear(item)}
                style={{ background:'none', border:'none', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                <span style={{ fontSize:22, fontWeight:900, color:'#7C3AED' }}>{item.l.toUpperCase()}</span>
                <span style={{ fontSize:8, color:'#9CA3AF', fontFamily:'var(--font-mono)' }}>{item.ipa}</span>
                <span style={{ fontSize:10, color:'#7C3AED80' }}>{item.eg}</span>
              </button>
              <button onClick={() => practise(item)}
                style={{ width:'100%', padding:'3px 0', borderRadius:8,
                  border:`1px solid ${isL?'#EF444460':'#E5E7EB'}`,
                  background:isL?'#FEF2F2':'transparent',
                  color:isL?'#EF4444':'#9CA3AF',
                  cursor:'pointer', fontSize:10, fontWeight:600,
                  animation:isL?'pl-pulse 1s infinite':'none' }}>
                {isL && '⏹ stop'}
                {isT && '⏳'}
                {!isL && !isT && (sc!=null ? `${Math.round(sc)}%` : '🎤 say it')}
              </button>
              {sc != null && (
                <div style={{ width:'100%', height:3, borderRadius:2, background:`${scColor}20`, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${sc}%`, background:scColor, borderRadius:2 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CONCEPT CARD ──────────────────────────────────────────────────────────
function ConceptCard({ concept, color, sectionId, isOpen, onToggle }) {
  const { speak } = useSpeech();
  return (
    <div style={{ border:`1.5px solid ${isOpen?color:'var(--border)'}`, borderRadius:16,
      overflow:'hidden', background:'var(--surface)',
      boxShadow:isOpen?`0 4px 20px ${color}20`:'var(--shadow-sm)', transition:'all 0.2s' }}>
      <button onClick={onToggle}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'14px 18px',
          background:isOpen?`${color}08`:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ width:38, height:38, borderRadius:10, background:`${color}18`,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color }}>{concept.term[0]}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{concept.term}</span>
            {concept.badge && (
              <span style={{ fontSize:10, fontWeight:700, background:`${color}15`, color, borderRadius:50, padding:'2px 8px' }}>
                {concept.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{concept.definition}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); speak(`${concept.term}. ${concept.definition}`, {rate:0.82}); }}
          title="Hear definition"
          style={{ background:`${color}15`, border:'none', borderRadius:50, width:30, height:30,
            cursor:'pointer', fontSize:14, flexShrink:0 }}>🔊</button>
        <span style={{ fontSize:18, color, flexShrink:0,
          transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.2s' }}>▾</span>
      </button>

      {isOpen && (
        <div style={{ padding:'0 18px 20px', animation:'fadeInUp 0.18s ease' }}>
          <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, marginBottom:16 }}>{concept.detail}</p>

          {concept.soundTiles && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                🔊 Tap each sound to hear it pronounced
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {concept.soundTiles.map(t => <SoundTile key={t.g} {...t} color={color} />)}
              </div>
            </div>
          )}

          {concept.wordList && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                🔊 Tap any word to hear it read aloud
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {concept.wordList.map(w => <WordTile key={w.word} {...w} color={color} />)}
              </div>
            </div>
          )}

          {concept.trickyWords && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                🔊 Tap to hear — these must be memorised!
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {concept.trickyWords.map(w => <TrickyTile key={w} word={w} />)}
              </div>
            </div>
          )}

          {concept.practiceWords && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                🎤 Practise — hear it, then say it back for a score
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {concept.practiceWords.map(pw => (
                  <div key={pw.word} style={{ display:'flex', alignItems:'center', gap:10,
                    flexWrap:'wrap', padding:'10px 14px', borderRadius:12,
                    background:`${color}08`, border:`1px solid ${color}20` }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      {pw.sounds.map((s,i) => (
                        <span key={i} style={{ padding:'4px 9px', borderRadius:8, fontSize:15,
                          fontWeight:900, background:`${color}18`, color }}>{s}</span>
                      ))}
                      <span style={{ fontSize:13, color:'var(--text-muted)', marginLeft:2 }}>
                        = <strong style={{ color:'var(--text)' }}>{pw.word}</strong>
                      </span>
                    </div>
                    <PracticeButton targetWord={pw.word} targetText={pw.spoken} color={color} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {concept.demoWords && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
                🔊 Example words — tap to hear
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {concept.demoWords.map(w => <WordTile key={w} word={w} color={color} />)}
              </div>
            </div>
          )}

          <div style={{ background:'var(--purple-10,#F5F3FF)', borderRadius:10,
            padding:'10px 14px', fontSize:12, color:'#4C1D95', lineHeight:1.6 }}>
            {concept.tip}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────
export default function PhonicsLearn({ childPhase = 2 }) {
  const [openSection, setOpenSection] = useState('letter-sound');
  const [openConcept, setOpenConcept] = useState(null);

  const toggle = (sid, term) => {
    const key = `${sid}:${term}`;
    setOpenConcept(p => p === key ? null : key);
  };
  const active = SECTIONS.find(s => s.id === openSection) || SECTIONS[0];

  return (
    <div style={{ maxWidth:780, margin:'0 auto' }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4 }}>
          🦉 Mrs Owl's Interactive Phonics Tutor
        </div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
          Learn Phonics — Listen, Practise and Score
        </h2>
        <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6 }}>
          Tap 🔊 on any letter, sound, or word to hear it pronounced. Tap 🎤 to record yourself and get an instant accuracy score!
          {childPhase ? ` Tailored for Phase ${childPhase}.` : ''}
        </p>
      </div>

      <AlphabetExplorer />

      {/* Phase strip */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:14, padding:'14px 16px', marginBottom:18, boxShadow:'var(--shadow-sm)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
          DfE Phonics Phases
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {PHASES.map(p => (
            <div key={p.n} style={{ flex:'1 1 0', minWidth:80, padding:'8px 10px', borderRadius:10,
              background:childPhase===p.n?p.color:`${p.color}12`,
              border:`1.5px solid ${childPhase===p.n?p.color:p.color+'30'}`,
              transition:'all 0.2s' }}>
              <div style={{ fontSize:13, fontWeight:900, color:childPhase===p.n?'#fff':p.color, marginBottom:2 }}>Phase {p.n}</div>
              <div style={{ fontSize:10, fontWeight:700, color:childPhase===p.n?'rgba(255,255,255,0.9)':p.color, marginBottom:2 }}>{p.label}</div>
              <div style={{ fontSize:9, color:childPhase===p.n?'rgba(255,255,255,0.7)':'var(--text-muted)' }}>{p.eg}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {SECTIONS.map(sec => (
          <button key={sec.id}
            onClick={() => { setOpenSection(sec.id); setOpenConcept(null); }}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:50,
              border:`1.5px solid ${openSection===sec.id?sec.color:'var(--border)'}`,
              background:openSection===sec.id?`${sec.color}12`:'var(--surface)',
              color:openSection===sec.id?sec.color:'var(--text-muted)',
              fontWeight:openSection===sec.id?700:500, fontSize:12, cursor:'pointer',
              boxShadow:openSection===sec.id?`0 2px 8px ${sec.color}20`:'none',
              transition:'all 0.15s' }}>
            <span>{sec.icon}</span><span style={{ whiteSpace:'nowrap' }}>{sec.title}</span>
          </button>
        ))}
      </div>

      {/* Section intro */}
      <div style={{ background:`${active.color}08`, border:`1px solid ${active.color}20`,
        borderRadius:12, padding:'12px 16px', marginBottom:14,
        fontSize:13, color:'var(--text-2)', lineHeight:1.65 }}>
        {active.icon}  {active.intro}
      </div>

      {/* Concept cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {active.concepts.map(c => (
          <ConceptCard key={c.term} concept={c} color={active.color} sectionId={active.id}
            isOpen={openConcept === `${active.id}:${c.term}`}
            onToggle={() => toggle(active.id, c.term)} />
        ))}
      </div>

      <div style={{ marginTop:20, padding:'12px 16px', borderRadius:12,
        background:'var(--surface)', border:'1px solid var(--border)',
        fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
        🏫 <strong>Based on</strong> the UK DfE Letters and Sounds framework.
        Pronunciation scoring powered by Microsoft Azure Cognitive Services.
      </div>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pl-pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
