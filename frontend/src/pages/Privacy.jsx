import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

const APP_VERSION = '2.0.0';
const year = new Date().getFullYear();
const UPDATED = '22 March 2025';

export default function Privacy() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0, color: '#6B7280' }}>←</button>
        <span style={{ fontSize: 16 }}>🦉</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1C1917' }}>Privacy Policy</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>v{APP_VERSION} · Updated {UPDATED}</span>
      </header>

      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '36px 24px', width: '100%' }}>
        <Style />

        <h1>Privacy Policy</h1>
        <p className="lead">Properly is an AI phonics tutor designed for children aged 4–7. We take your family's privacy extremely seriously, especially because our users include young children.</p>

        <Section title="1. Who we are">
          <p>Properly is developed and operated by <strong>Deepak Ingwale</strong>. If you have any questions about this policy, please contact us at <a href="mailto:privacy@properly.app">privacy@properly.app</a>.</p>
        </Section>

        <Section title="2. Information we collect">
          <p><strong>Parent/Guardian account:</strong> Email address and a hashed (encrypted) password. We never store your password in plain text.</p>
          <p><strong>Child profile:</strong> First name only, selected phonics phase (a number from 2–6), acorn balance, and reading progress (words read, stories completed, accuracy scores).</p>
          <p><strong>Reading sessions:</strong> Accuracy scores per word, overall session accuracy, and acorns earned. No audio is ever stored — audio is processed in real time and immediately discarded.</p>
          <p><strong>Device information:</strong> We do not collect device identifiers, IP addresses, or browser fingerprints.</p>
        </Section>

        <Section title="3. How we use your information">
          <ul>
            <li>To create and manage your account</li>
            <li>To personalise AI-generated phonics stories based on your child's name, phase, and interests</li>
            <li>To track your child's reading progress and award achievements</li>
            <li>To send account-related emails (verification, password reset)</li>
          </ul>
          <p>We do <strong>not</strong> use your data for advertising, profiling, or any commercial purpose beyond operating the service.</p>
        </Section>

        <Section title="4. Children's privacy (COPPA / UK GDPR-K)">
          <p>Properly is designed for use by young children under direct parental supervision. We comply with the Children's Online Privacy Protection Act (COPPA) and the UK GDPR-K (Age-Appropriate Design Code).</p>
          <ul>
            <li>We only collect the minimum information needed to run the service</li>
            <li>Child profiles store a first name only — never a surname, photo, or date of birth</li>
            <li>No audio recordings are stored at any time</li>
            <li>We do not show advertising to children</li>
            <li>We do not share children's data with third parties for commercial purposes</li>
            <li>Parents can request deletion of all data by emailing <a href="mailto:privacy@properly.app">privacy@properly.app</a></li>
          </ul>
        </Section>

        <Section title="5. Third-party services">
          <p>We use the following services to power Properly. Each has their own privacy policy:</p>
          <ul>
            <li><strong>Azure Cognitive Services (Microsoft)</strong> — Pronunciation assessment and text-to-speech. Audio is sent for real-time processing only and is not retained by Microsoft under our service agreement.</li>
            <li><strong>Google Gemini</strong> — AI-generated story content and coaching tips. We send only the child's first name, phonics phase, and theme — never personal identifiers.</li>
            <li><strong>Groq (Llama)</strong> — Backup AI provider. Same data minimisation applies.</li>
            <li><strong>Render.com</strong> — Hosting provider for our servers.</li>
          </ul>
        </Section>

        <Section title="6. Data storage and security">
          <p>All data is stored in a SQLite database hosted on Render.com's secure infrastructure. Passwords are hashed using bcrypt with a cost factor of 12. All connections use HTTPS/TLS.</p>
        </Section>

        <Section title="7. Data retention and deletion">
          <p>You can delete your account and all associated data (including your child's profile and progress) at any time by emailing <a href="mailto:privacy@properly.app">privacy@properly.app</a>. We will action deletion requests within 30 days.</p>
        </Section>

        <Section title="8. Your rights">
          <p>Under UK GDPR, you have the right to: access your data, correct inaccurate data, request erasure, object to processing, and data portability. Contact <a href="mailto:privacy@properly.app">privacy@properly.app</a> to exercise any of these rights.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>We may update this policy from time to time. We will notify registered users by email of any material changes. Continued use of Properly after changes constitutes acceptance.</p>
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
