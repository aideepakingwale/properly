import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

const APP_VERSION = '2.0.0';
const year = new Date().getFullYear();
const UPDATED = '22 March 2025';

export default function Terms() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0, color: '#6B7280' }}>←</button>
        <span style={{ fontSize: 16 }}>🦉</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1C1917' }}>Terms &amp; Conditions</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>v{APP_VERSION} · Updated {UPDATED}</span>
      </header>

      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '36px 24px', width: '100%' }}>
        <Style />

        <h1>Terms &amp; Conditions</h1>
        <p className="lead">Please read these terms carefully before using Properly. By registering an account, you agree to these terms.</p>

        <Section title="1. About Properly">
          <p>Properly is an AI-powered phonics tutoring application developed by <strong>Deepak Ingwale</strong> ("we", "us", "our"). The service is provided at <strong>properly.app</strong> and via our mobile and desktop applications.</p>
          <p>Properly is intended for use by children aged 4–7 under parental or guardian supervision.</p>
        </Section>

        <Section title="2. Accounts and eligibility">
          <p>You must be 18 years or older to create a parent account. By registering, you confirm that you are the parent or legal guardian of the child whose profile you create.</p>
          <p>You are responsible for maintaining the confidentiality of your password and for all activity on your account. Please notify us immediately of any unauthorised access.</p>
          <p>You must provide a valid email address and verify it to activate your account.</p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree to use Properly only for its intended purpose — supporting your child's phonics learning. You must not:</p>
          <ul>
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorised access to any part of the service</li>
            <li>Interfere with or disrupt the service or its servers</li>
            <li>Reverse-engineer, decompile, or extract source code</li>
            <li>Use automated tools, bots, or scrapers to access the service</li>
            <li>Resell, sublicense, or commercially exploit the service</li>
          </ul>
        </Section>

        <Section title="4. Free tier and service availability">
          <p>Properly is provided free of charge. We make reasonable efforts to maintain service availability but do not guarantee uninterrupted access. The service may be modified, suspended, or discontinued at any time with reasonable notice.</p>
          <p>We reserve the right to introduce paid features in the future. Free tier users will be given advance notice of any changes.</p>
        </Section>

        <Section title="5. AI-generated content">
          <p>Properly uses AI models (Google Gemini, Groq/Llama, and optionally Anthropic Claude) to generate personalised phonics stories and coaching tips. While we design prompts to ensure age-appropriate, curriculum-aligned content, AI outputs may occasionally be imperfect.</p>
          <p>All AI-generated stories are designed for UK Phonics Phases 2–6 (children aged approximately 4–7). If you encounter content that seems inappropriate, please report it to <a href="mailto:support@properly.app">support@properly.app</a>.</p>
        </Section>

        <Section title="6. Intellectual property">
          <p>The Properly name, logo, application design, and all associated intellectual property are owned by Deepak Ingwale. You are granted a limited, non-transferable licence to use the service for personal, non-commercial purposes.</p>
          <p>AI-generated stories created for your child during a session are for personal educational use only.</p>
        </Section>

        <Section title="7. Disclaimer of warranties">
          <p>Properly is provided "as is" and "as available" without any warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
          <p>We do not warrant that Properly will improve your child's reading — outcomes depend on many factors including practice frequency, individual learning differences, and parental involvement.</p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>To the maximum extent permitted by applicable law, Deepak Ingwale shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, Properly.</p>
        </Section>

        <Section title="9. Governing law">
          <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>We may update these terms from time to time. We will notify registered users by email of material changes at least 14 days before they take effect. Your continued use of Properly after that date constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="11. Contact">
          <p>For questions about these terms, please contact: <a href="mailto:legal@properly.app">legal@properly.app</a></p>
          <p>Deepak Ingwale, Properly AI Phonics Tutor</p>
        </Section>

        <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 36 }}>
          © {year} Deepak Ingwale · Properly v{APP_VERSION} · Last updated {UPDATED}
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Style() {
  return (
    <style>{`
      h1 { font-size: 26px; font-weight: 900; color: #1C1917; margin: 0 0 8px; }
      .lead { font-size: 15px; color: #44403C; margin-bottom: 28px; line-height: 1.7; }
      h2 { font-size: 17px; font-weight: 800; color: #1C1917; margin: 0 0 10px; }
      p { font-size: 14px; color: #44403C; line-height: 1.75; margin: 0 0 10px; }
      ul { padding-left: 20px; margin: 0 0 10px; }
      li { font-size: 14px; color: #44403C; line-height: 1.75; margin-bottom: 4px; }
      a { color: #2D6A4F; }
      strong { color: #1C1917; }
    `}</style>
  );
}
