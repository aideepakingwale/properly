import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

function ConfigRow({ label, value, status, note }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{label}</div>
        {note && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{note}</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {value && <code style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:3 }}>{value}</code>}
        <span className={`badge ${status==='ok'?'badge-green':status==='warn'?'badge-amber':'badge-red'}`}>
          {status==='ok' ? '✓ configured' : status==='warn' ? '⚠ partial' : '✗ not set'}
        </span>
      </div>
    </div>
  );
}

export default function Config() {
  const [cfg, setCfg]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.config().then(r => { if (r.success) setCfg(r.data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading…</div>;
  if (!cfg)    return <div style={{ padding:40, color:'var(--danger)' }}>Failed to load</div>;

  return (
    <div style={{ padding:28, maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Configuration</h1>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Read-only view of runtime configuration</div>
      </div>

      {/* AI Services */}
      <section style={{ marginBottom:24 }}>
        <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>◆</span> AI Services
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ConfigRow label="Google Gemini Flash" value={cfg.gemini.key} status={cfg.gemini.key?'ok':'red'} note="Primary story generator — free 1,500 req/day" />
          <ConfigRow label="Groq / Llama 3.1" value={cfg.groq.key} status={cfg.groq.key?'ok':'warn'} note="Fallback story generator — free 14,400 req/day" />
          <ConfigRow label="Azure Cognitive Services" value={cfg.azure.key} status={cfg.azure.key?'ok':'warn'} note={`Pronunciation assessment + TTS — region: ${cfg.azure.region}`} />
        </div>
      </section>

      {/* Storage & DB */}
      <section style={{ marginBottom:24 }}>
        <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>◆</span> Storage
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ConfigRow label="Cloudflare R2 (DB persistence)" value={cfg.r2.bucket} status={cfg.r2.configured?'ok':'red'} note="SQLite backup/restore — prevents data loss on redeploy" />
        </div>
      </section>

      {/* Payments & Email */}
      <section style={{ marginBottom:24 }}>
        <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>◆</span> Payments & Email
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ConfigRow label="Stripe" status={cfg.stripe.configured?'ok':'warn'} note="Subscription billing — sprout & forest plans" />
          <ConfigRow label="Resend (Email)" value={cfg.resend.key} status={cfg.resend.key?'ok':'warn'} note="Email verification & welcome emails" />
        </div>
      </section>

      {/* Auth */}
      <section style={{ marginBottom:24 }}>
        <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span>◆</span> Authentication
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'0 20px' }}>
          <ConfigRow label="JWT Expiry" value={cfg.jwtExpiry} status="ok" note="Set to 30d to survive deploys" />
          <ConfigRow
            label="Admin Emails (auto-promote)"
            value={cfg.adminEmails.length ? cfg.adminEmails.join(', ') : null}
            status={cfg.adminEmails.length?'ok':'warn'}
            note="Set ADMIN_EMAILS env var (comma-separated) to auto-grant admin on login"
          />
        </div>
      </section>

      {/* Help */}
      <div style={{ background:'rgba(0,229,160,0.05)', border:'1px solid rgba(0,229,160,0.15)', borderRadius:8, padding:16 }}>
        <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.8 }}>
          <strong style={{ color:'var(--accent)' }}>To change any configuration:</strong> update the environment variable in Render Dashboard → properly-api → Environment, then redeploy.<br/>
          <strong style={{ color:'var(--accent)' }}>To grant admin access:</strong> add your email to <code style={{ color:'var(--accent2)' }}>ADMIN_EMAILS</code> and log in, or run SQL: <code style={{ color:'var(--accent2)' }}>UPDATE users SET is_admin=1 WHERE email='you@x.com'</code>
        </div>
      </div>
    </div>
  );
}
