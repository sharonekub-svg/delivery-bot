import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

/**
 * Step 1: connect 10Bis. Walk the user through grabbing their session from
 * DevTools, validate it server-side, then remember it in this browser and move
 * on to the profile.
 */
const STEPS: [string, string][] = [
  ['Open 10Bis and log in', 'Go to https://www.10bis.co.il in this browser and sign in as usual.'],
  ['Open DevTools', 'Press F12 (or ⌥⌘I on a Mac) and click the Network tab.'],
  ['Make 10Bis do something', 'Reload the page or click into a restaurant so requests show up in the list.'],
  ['Copy a request', 'Find any request to 10bis.co.il (the “NextApi” ones work great). Right-click it → Copy → Copy as cURL.'],
  ['Paste it below', 'Paste the whole thing and hit Connect. We only keep the cookie + token, on your device.'],
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
        store.setSession(data.session);
        if (data.addresses?.[0]?.id) store.setAddress(data.addresses[0].id);
        setStatus('✅ Connected! Now tell us how you like to eat…');
        router.push('/profile');
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
      <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Step 1 of 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>Connect your 10Bis</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        10Bis has no public API, so we use the session your browser already has. Takes ~30 seconds.
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
        🔒 Sent once over HTTPS to validate, then stored only in this browser. Nothing is saved to a shared server.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' };
const step: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };
const num: React.CSSProperties = { flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 };
const textarea: React.CSSProperties = { width: '100%', minHeight: 120, padding: 12, fontSize: 13, fontFamily: 'ui-monospace, monospace', border: '1px solid #cbd5e1', borderRadius: 10, boxSizing: 'border-box', resize: 'vertical' };
const button: React.CSSProperties = { marginTop: 12, background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
