import { useState } from 'react';

/**
 * Secure 10Bis connect page (SMS one-time-code). Step 1: enter the 10Bis email
 * -> a code is texted to the account phone. Step 2: enter the code. Only the
 * resulting encrypted session token is stored; no password is ever involved.
 * userId comes from ?u=... in the WhatsApp link.
 */
export default function Auth() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [status, setStatus] = useState<string | null>(null);

  function userId() {
    return new URLSearchParams(window.location.search).get('u') ?? '';
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sending code…');
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: userId(), action: 'request', email }),
    });
    if (res.ok) {
      setPhase('code');
      setStatus('📲 We texted a code to the account phone. Enter it below.');
    } else setStatus('❌ Could not send a code — check the email.');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Verifying…');
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: userId(), action: 'verify', code }),
    });
    setStatus(res.ok ? '✅ Connected! You can head back to WhatsApp.' : '❌ Wrong or expired code.');
  }

  return (
    <main style={{ maxWidth: 420, margin: '60px auto', fontFamily: 'system-ui', padding: '0 16px' }}>
      <h1>Connect 10Bis</h1>
      <p>We use a one-time SMS code — no password is stored, only an encrypted session token.</p>
      {phase === 'email' ? (
        <form onSubmit={requestCode}>
          <input placeholder="10Bis email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          <button type="submit" style={button}>Send me a code</button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <input placeholder="SMS code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} style={input} />
          <button type="submit" style={button}>Connect</button>
        </form>
      )}
      {status && <p>{status}</p>}
    </main>
  );
}

const input: React.CSSProperties = { display: 'block', width: '100%', padding: 12, margin: '8px 0', fontSize: 16, boxSizing: 'border-box' };
const button: React.CSSProperties = { padding: '12px 20px', fontSize: 16, marginTop: 8, cursor: 'pointer' };
