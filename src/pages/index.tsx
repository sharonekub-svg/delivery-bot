import Link from 'next/link';

/**
 * Landing page. Pitches the product and sends people to /connect, where they
 * paste their 10Bis session from DevTools.
 */
export default function Home() {
  return (
    <main style={wrap}>
      <section style={{ textAlign: 'center', padding: '64px 0 32px' }}>
        <div style={{ fontSize: 56 }}>🍽️</div>
        <h1 style={{ fontSize: 40, margin: '12px 0 8px', letterSpacing: -1 }}>Lunch Helper</h1>
        <p style={{ fontSize: 20, color: '#475569', maxWidth: 560, margin: '0 auto' }}>
          Connect your <strong>10Bis</strong> account, tell the bot how you like to eat, and it
          recommends — and orders — the perfect lunch for you.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/connect" style={cta}>Connect 10Bis →</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', margin: '24px 0' }}>
        {[
          ['🔌', 'Paste & go', 'No password. Copy one request from your browser’s DevTools and paste it in — that’s the whole setup.'],
          ['💬', 'It interviews you', 'A friendly chatbot learns your goals, protein targets, favourite restaurants and allergies.'],
          ['🛵', 'It orders for real', 'Picks live menu options that fit your taste and budget, then places the order once you say go.'],
        ].map(([icon, title, body]) => (
          <div key={title} style={card}>
            <div style={{ fontSize: 28 }}>{icon}</div>
            <h3 style={{ margin: '8px 0 4px' }}>{title}</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>{body}</p>
          </div>
        ))}
      </section>

      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 32 }}>
        Your session is encrypted and stored only in your own browser cookie. We never see your password.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 860,
  margin: '0 auto',
  padding: '0 20px 60px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#0f172a',
};
const cta: React.CSSProperties = {
  display: 'inline-block',
  background: '#f97316',
  color: '#fff',
  padding: '14px 28px',
  borderRadius: 12,
  fontSize: 18,
  fontWeight: 600,
  textDecoration: 'none',
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
};
