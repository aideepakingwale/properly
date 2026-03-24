import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

function TestResult({ result }) {
  if (!result) return null;
  const ok = result.success;
  return (
    <div style={{
      marginTop: 10, padding: '10px 14px', borderRadius: 6,
      background: ok ? 'rgba(0,229,160,0.07)' : 'rgba(255,68,68,0.07)',
      border: `1px solid ${ok ? 'rgba(0,229,160,0.25)' : 'rgba(255,68,68,0.25)'}`,
      fontSize: 11, lineHeight: 1.7,
    }}>
      <div style={{ fontWeight:700, color: ok ? 'var(--accent)' : 'var(--danger)', marginBottom:3 }}>
        {ok ? 'Test passed' : 'Test failed'}
      </div>
      {result.note  && <div style={{ color:'var(--text)' }}>{result.note}</div>}
      {result.reply && <div style={{ color:'var(--muted)', fontStyle:'italic' }}>Reply: "{result.reply}"</div>}
      {result.error && <div style={{ color:'var(--danger)' }}>{result.error}</div>}
      {result.mode  && <div style={{ color:'var(--accent2)', fontWeight:700 }}>{result.mode}</div>}
      {result.results && Object.entries(result.results).map(([k, v]) => (
        <div key={k} style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
          <span style={{ color: v.ok ? 'var(--accent)' : 'var(--danger)', fontSize:12 }}>{v.ok ? "\u2713" : "\u2717"}</span>
          <span style={{ textTransform:'uppercase', color:'var(--muted)', fontSize:10, width:28 }}>{k}</span>
          <span style={{ color:'var(--text)' }}>{v.note}</span>
        </div>
      ))}
    </div>
  );
}

function ServiceRow({ label, value, configured, note, onTest, testKey, testing, results }) {
  const isLoading = testing === testKey;
  const result    = results[testKey];
  return (
    <div style={{ padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{label}</span>
            <span className={configured ? 'badge badge-green' : 'badge badge-red'}>
              {configured ? '\u2713 configured' : '\u2717 not set'}
            </span>
          </div>
          {note  && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{note}</div>}
          {value && <code style={{ fontSize:10, color:'var(--muted)', background:'var(--bg)', padding:'1px 6px', borderRadius:3, marginTop:3, display:'inline-block' }}>{value}</code>}
        </div>
        {configured && onTest && (
          <button className="btn btn-ghost btn-sm" onClick={() => onTest(testKey)} disabled={!!testing} style={{ flexShrink:0, marginLeft:16, minWidth:72 }}>
            {isLoading ? 'Testing...' : '\u25B6 Test'}
          </button>
        )}
      </div>
      <TestResult result={result} />
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
      <span>{icon}</span> {children}
    </div>
  );
}

function PlainRow({ label, value, status, note }) {
  const cls = { ok:'badge-green', warn:'badge-amber', red:'badge-red' }[status] || 'badge-gray';
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{label}</div>
        {note && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{note}</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:16 }}>
        {value && <code style={{ fontSize:10, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:3 }}>{value}</code>}
        <span className={"badge " + cls}>{status==='ok' ? '\u2713 set' : '\u26a0 not set'}</span>
      </div>
    </div>
  );
}

export default function Config() {
  const [cfg,       setCfg]       = useState(null);
  const [r2,        setR2]        = useState(null);
  const [r2Loading, setR2Loading] = useState(true);
  const [backing,   setBacking]   = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [testing,   setTesting]   = useState(null);
  const [results,   setResults]   = useState({});

  useEffect(() => {
    adminAPI.config().then(r => { if (r.success) setCfg(r.data); }).finally(() => setLoading(false));
    adminAPI.r2Status().then(r => setR2(r.data)).catch(() => setR2({ error:'Could not reach backend' })).finally(() => setR2Loading(false));
  }, []);

  const runTest = async (service) => {
    setTesting(service);
    setResults(prev => ({ ...prev, [service]: null }));
    try {
      const fn = adminAPI.test[service];
      const r  = await fn();
      setResults(prev => ({ ...prev, [service]: r }));
    } catch (e) {
      setResults(prev => ({ ...prev, [service]: { success:false, error: e.message || 'Request failed' } }));
    } finally { setTesting(null); }
  };

  const triggerBackup = async () => {
    setBacking(true); setBackupMsg('');
    try {
      await adminAPI.triggerBackup();
      setBackupMsg('Backup completed successfully');
      adminAPI.r2Status().then(r => setR2(r.data)).catch(() => {});
    } catch (e) { setBackupMsg('Backup failed: ' + (e.message || 'unknown error')); }
    finally { setBacking(false); }
  };

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading...</div>;
  if (!cfg)    return <div style={{ padding:40, color:'var(--danger)' }}>Failed to load config</div>;

  return (
    <div style={{ padding:28, maxWidth:860 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Configuration</h1>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>
          Live config status. Click Test to verify each key is working correctly.
        </div>
      </div>

      {/* R2 */}
      <section style={{ marginBottom:24 }}>
        <SectionTitle icon="\u25C8">Cloudflare R2 — Database Persistence</SectionTitle>
        <div style={{ background:'var(--surface)', borderRadius:8, padding:20, border:`1px solid ${r2?.backupExists?'rgba(0,229,160,0.3)':r2?.error?'rgba(255,68,68,0.3)':'var(--border)'}` }}>
          {r2Loading ? <div style={{ color:'var(--muted)' }}>Checking R2...</div> : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span className={"badge " + (r2?.backupExists?'badge-green':r2?.error?'badge-red':r2?.configured?'badge-amber':'badge-red')} style={{ fontSize:12, padding:'4px 12px' }}>
                  {r2?.backupExists ? 'Connected + backup found' : r2?.error ? 'Connection failed' : r2?.configured ? 'Connected, no backup yet' : 'Not configured'}
                </span>
                {r2?.configured && <button className="btn btn-ghost btn-sm" onClick={triggerBackup} disabled={backing}>{backing?'Backing up...':'Backup Now'}</button>}
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:2 }}>
                {r2?.bucket             && <div><strong style={{ color:'var(--text)' }}>Bucket:</strong> {r2.bucket}</div>}
                {r2?.backupSize         && <div><strong style={{ color:'var(--text)' }}>Size:</strong> {r2.backupSize}</div>}
                {r2?.backupLastModified && <div><strong style={{ color:'var(--text)' }}>Last backup:</strong> {new Date(r2.backupLastModified).toLocaleString('en-GB')}</div>}
                {r2?.error              && <div style={{ color:'var(--danger)' }}><strong>Error:</strong> {r2.error}</div>}
                <div style={{ color: r2?.backupExists?'var(--accent)':r2?.error?'var(--danger)':'var(--muted)' }}>{r2?.message}</div>
              </div>
              {backupMsg && <div style={{ marginTop:10, fontSize:12, fontWeight:600, color: backupMsg.includes('failed')?'var(--danger)':'var(--accent)' }}>{backupMsg}</div>}
              {!r2?.configured && (
                <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,68,68,0.08)', borderRadius:6, fontSize:11, color:'var(--danger)', lineHeight:1.7 }}>
                  <strong>Required env vars in Render:</strong> R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET=properly
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* AI */}
      <section style={{ marginBottom:24 }}>
        <SectionTitle icon="\u25C6">AI Services</SectionTitle>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ServiceRow label="Google Gemini Flash" configured={!!cfg.gemini.key}
            note="Primary AI story generator — free 1,500 req/day · aistudio.google.com"
            testKey="gemini" onTest={runTest} testing={testing} results={results} />
          <ServiceRow label="Groq / Llama 3.1" configured={!!cfg.groq.key}
            note="Fallback story generator — free 14,400 req/day · console.groq.com"
            testKey="groq" onTest={runTest} testing={testing} results={results} />
          <ServiceRow label="Azure Cognitive Services" configured={!!cfg.azure.key}
            note={"Pronunciation assessment + Neural TTS · region: " + cfg.azure.region}
            testKey="azure" onTest={runTest} testing={testing} results={results} />
        </div>
      </section>

      {/* Payments & Email */}
      <section style={{ marginBottom:24 }}>
        <SectionTitle icon="\u25C6">Payments & Email</SectionTitle>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ServiceRow label="Stripe" configured={!!cfg.stripe.configured}
            note="Subscription billing — Sprout 3.99/mo, Forest 6.99/mo · dashboard.stripe.com"
            testKey="stripe" onTest={runTest} testing={testing} results={results} />
          <ServiceRow label="Resend" value={cfg.resend.key} configured={!!cfg.resend.key}
            note="Email verification + welcome emails — free 3,000/month · resend.com"
            testKey="resend" onTest={runTest} testing={testing} results={results} />
        </div>
      </section>

      {/* Auth */}
      <section style={{ marginBottom:24 }}>
        <SectionTitle icon="\u25C6">Authentication</SectionTitle>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <PlainRow label="JWT Expiry" value={cfg.jwtExpiry} status="ok" note="30d — keeps users logged in across deploys" />
          <PlainRow label="Admin Emails" value={cfg.adminEmails?.join(', ')||null}
            status={cfg.adminEmails?.length?'ok':'warn'} note="ADMIN_EMAILS env var — auto-promoted to admin on login" />
        </div>
      </section>

      <div style={{ background:'rgba(0,229,160,0.04)', border:'1px solid rgba(0,229,160,0.12)', borderRadius:8, padding:16, fontSize:11, color:'var(--muted)', lineHeight:1.9 }}>
        <strong style={{ color:'var(--accent)' }}>To change any key:</strong> update in Render Dashboard, properly-api, Environment, Save, Redeploy.<br/>
        <strong style={{ color:'var(--accent)' }}>Tests are server-side</strong> — they call the real external APIs. No keys are sent to your browser.
      </div>
    </div>
  );
}
