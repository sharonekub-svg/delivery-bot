import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Connect page. Walks the user through grabbing their 10Bis session from
 * DevTools and pasting it. On success the server sets the encrypted session
 * cookie and we move on to the chat.
 */
const STEPS: [string, string][] = [
  ['Open 10Bis and log in', 'Go to https://www.10bis.co.il in this browser and sign in to your account as usual.'],
  ['Open DevTools', 'Press F12 (or ⌥⌘I on a Mac) and click the Network tab.'],
  ['Make 10Bis do something', 'Reload the page or click into a restaurant so requests show up in the Network list.'],
  ['Copy a request', 'Find any request to 10bis.co.il (the ones to “NextApi” work great). Right-click it → Copy → Copy as cURL.'],
  ['Paste it below', 'Paste the whole thing into the box and hit Connect. We only keep the cookie + token, encrypted.'],
];

export default function Connect() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus('Checking your credentials…');
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus('✅ Connected! Taking you to your lunch assistant…');
        router.push('/chat');
      } else {
        setStatus(`❌ ${data.error ?? 'Could not connect.'}`);
      }
    } catch {
      setStatus('❌ Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={wrap}>
      <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← Back</Link>
      <h1 style={{ fontSize: 30, margin: '12px 0 4px' }}>Connect your 10Bis</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        10Bis has no public API, so we use the session your browser already has. It takes ~30 seconds.
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0' }}>
        {STEPS.map(([title, body], i) => (
          <li key={title} style={step}>
            <div style={num}>{i + 1}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{title}</div>
              <div style={{ color: '#64748b', fontSize: 15 }}>{body}</div>
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={connect}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste the copied request here (curl '…' -H 'cookie: …' …)"
          style={textarea}
          spellCheck={false}
        />
        <button type="submit" disabled={busy || raw.trim().length < 10} style={{ ...button, opacity: busy || raw.trim().length < 10 ? 0.6 : 1 }}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}

      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>
        🔒 The paste is sent over HTTPS, encrypted with a server key, and stored only in your own httpOnly cookie.
        Nothing is written to a shared database.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '32px 20px 60px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#0f172a',
};
const step: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };
const num: React.CSSProperties = {
  flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', background: '#f97316', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
};
const textarea: React.CSSProperties = {
  width: '100%', minHeight: 120, padding: 12, fontSize: 13, fontFamily: 'ui-monospace, monospace',
  border: '1px solid #cbd5e1', borderRadius: 10, boxSizing: 'border-box', resize: 'vertical',
};
const button: React.CSSProperties = {
  marginTop: 12, background: '#f97316', color: '#fff', border: 'none', borderRadius: 10,
  padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
