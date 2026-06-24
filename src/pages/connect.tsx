import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

/**
 * שלב 1: חיבור ל-10bis. מדריכים את המשתמש להעתיק את הסשן מכלי הפיתוח, מאמתים
 * בצד השרת, וזוכרים בדפדפן. כפתור "דלג" למטה מימין מאפשר לדלג אם כבר מחוברים.
 */
const STEPS: [string, string][] = [
  ['היכנסו לתן ביס במחשב', 'במחשב (הכי קל ככה, לא בנייד) פתחו את האתר 10bis.co.il והתחברו לחשבון שלכם כרגיל.'],
  ['לחצו F12 במקלדת', 'הקישו על הכפתור F12 (בשורה העליונה של המקלדת). ייפתח חלון נוסף בצד או בתחתית המסך — זה תקין.'],
  ['פתחו את הלשונית Network', 'בחלון שנפתח, לחצו על הכיתוב "Network". אם אתם לא רואים אותו, לחצו על החץ הכפול » ובחרו אותו מהרשימה.'],
  ['רעננו את העמוד', 'כשהחלון פתוח, הקישו F5 כדי לרענן. תתחיל להופיע רשימה ארוכה של שורות בחלון ה-Network.'],
  ['העתיקו בקשה אחת', 'לחצו קליק ימני על שורה כלשהי שמופיעה בה המילה "NextApi", ואז בחרו: Copy ואז Copy as cURL.'],
  ['הדביקו כאן ולחצו התחברו', 'חזרו לעמוד הזה, לחצו על התיבה למטה, הדביקו (Ctrl+V), ולחצו על "התחברו".'],
];

export default function Connect() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => { setHasSession(!!store.getSession()); }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus('בודק את הפרטים…');
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
        setStatus('✅ התחברתם! עכשיו ספרו לנו איך אתם אוהבים לאכול…');
        router.push('/profile');
      } else {
        setStatus(`❌ ${data.error ?? 'החיבור נכשל.'}`);
      }
    } catch {
      setStatus('❌ תקלת רשת — נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    // אם כבר מחוברים — קפצו ישר לבוט; אחרת המשיכו למילוי הפרופיל.
    if (store.getSession()) router.push(store.getProfile() ? '/bot' : '/profile');
    else router.push('/profile');
  }

  return (
    <main style={wrap}>
      <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>→ חזרה</Link>
      <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>שלב 1 מתוך 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>חיבור לחשבון תן ביס</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        לתן ביס אין חיבור רשמי לאפליקציות, אז אנחנו "משאילים" את ההתחברות שכבר קיימת
        בדפדפן שלכם. פשוט עקבו אחרי 6 השלבים — לוקח פחות מדקה.
      </p>

      {hasSession && (
        <div style={connectedNote}>✅ אתם כבר מחוברים. אפשר לדלג למטה, או להדביק סשן חדש כדי להחליף.</div>
      )}

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
          placeholder="הדביקו כאן את הבקשה שהעתקתם (curl '…' -H 'cookie: …' …)"
          style={textarea}
          spellCheck={false}
          dir="ltr"
        />
        <button type="submit" disabled={busy || raw.trim().length < 10} style={{ ...button, opacity: busy || raw.trim().length < 10 ? 0.6 : 1 }}>
          {busy ? 'מתחבר…' : 'התחברו'}
        </button>
      </form>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}

      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>
        🔒 נשלח פעם אחת ב-HTTPS לאימות, ואז נשמר רק בדפדפן הזה. שום דבר לא נשמר בשרת משותף.
      </p>

      <button onClick={skip} style={skipBtn} aria-label="דלג">דלג ←</button>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '32px 20px 90px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' };
const step: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };
const num: React.CSSProperties = { flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 };
const textarea: React.CSSProperties = { width: '100%', minHeight: 120, padding: 12, fontSize: 13, fontFamily: 'ui-monospace, monospace', border: '1px solid #cbd5e1', borderRadius: 10, boxSizing: 'border-box', resize: 'vertical' };
const button: React.CSSProperties = { marginTop: 12, background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
const connectedNote: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, marginTop: 8, color: '#15803d', fontSize: 14 };
const skipBtn: React.CSSProperties = {
  position: 'fixed', bottom: 20, right: 20, background: '#0f172a', color: '#fff', border: 'none',
  borderRadius: 24, padding: '12px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10,
};
