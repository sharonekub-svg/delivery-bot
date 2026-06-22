import { useState } from 'react';

/**
 * Secure re-authentication page. Posts the 10Bis credentials to
 * /api/auth/credentials, which validates and stores only the encrypted token.
 * The userId is passed as ?u=... from the WhatsApp link.
 */
export default function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Validating…');
    const userId = new URLSearchParams(window.location.search).get('u') ?? '';
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, username, password }),
    });
    setStatus(res.ok ? '✅ Connected! You can close this and head back to WhatsApp.' : '❌ Login failed — check your details.');
  }

  return (
    <main style={{ maxWidth: 420, margin: '60px auto', fontFamily: 'system-ui', padding: '0 16px' }}>
      <h1>Connect 10Bis</h1>
      <p>Your credentials are validated once and never stored — only an encrypted session token is kept.</p>
      <form onSubmit={submit}>
        <input placeholder="10Bis username / email" value={username} onChange={(e) => setUsername(e.target.value)} style={input} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
        <button type="submit" style={button}>Connect securely</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}

const input: React.CSSProperties = { display: 'block', width: '100%', padding: 12, margin: '8px 0', fontSize: 16, boxSizing: 'border-box' };
const button: React.CSSProperties = { padding: '12px 20px', fontSize: 16, marginTop: 8, cursor: 'pointer' };
