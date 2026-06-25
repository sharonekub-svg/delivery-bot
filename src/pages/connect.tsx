import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';
import { parseCredentials } from '../lib/curlParse';

/**
 * שלב 1: חיבור ל-10bis. מדריכים את המשתמש להעתיק *שתי* בקשות מכלי הפיתוח —
 * אחת מ-NextApi (נושאת את העוגייה) ואחת מ-api.10bis.co.il (נושאת את הטוקן) —
 * מאמתים בצד השרת, וזוכרים בדפדפן. חיווי חי מראה מה כבר זוהה בהדבקה.
 */
const STEPS: [string, string][] = [
  ['היכנסו לתן ביס במחשב', 'במחשב (הכי קל ככה, לא בנייד) פתחו את 10bis.co.il בכרום או אדג׳, והתחברו לחשבון שלכם כרגיל.'],
  ['לחצו F12 במקלדת', 'הקישו F12 (בשורה העליונה של המקלדת). ייפתח חלון של כלי פיתוח בצד או בתחתית המסך — זה תקין, אל תיבהלו.'],
  ['פתחו את הלשונית Network', 'בחלון שנפתח, לחצו למעלה על הכיתוב "Network". אם לא רואים אותו, לחצו על החץ הכפול » ובחרו אותו מהרשימה.'],
  ['העתיקו את GetUser (זה כל מה שצריך)', 'בתיבת הסינון ("Filter") הקלידו NextApi והקישו F5. קליק ימני על השורה GetUser ← Copy ← Copy as cURL. הדביקו בתיבה למטה. זו מביאה היסטוריה, תקציב, קופונים — והכול.'],
  ['רק אם יש לכם טוקן (לא חובה!)', 'אצל רוב המשתמשים אין טוקן נפרד וזה מצוין — העוגייה מספיקה. אם בכל זאת תרצו: נקו את הסינון, הקלידו api.10bis, קליק ימני על שורה ← Copy as cURL, והדביקו גם אותה. אם אין — דלגו על השלב הזה.'],
  ['לחצו התחברו', 'כשהחיווי למטה מראה ✓ עוגייה — לחצו "התחברו". זהו, מוכנים. (✓ טוקן זה בונוס, לא חובה.)'],
];

export default function Connect() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => { setHasSession(!!store.getSession()); }, []);

  // חיווי חי: מה זוהה במה שהודבק עד כה (עוגייה / טוקן).
  const detected = parseCredentials(raw);

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
      <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}>→ חזרה</Link>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 12 }}>שלב 1 מתוך 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>חיבור לחשבון תן ביס</h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0 }}>
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
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{body}</div>
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={connect}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="הדביקו כאן את שתי הבקשות, אחת מתחת לשנייה (curl '…' -H 'cookie: …' …)"
          style={textarea}
          spellCheck={false}
          dir="ltr"
        />
        {raw.trim().length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 14, alignItems: 'center' }}>
            <span style={detected.cookie ? detPillOn : detPillOff}>{detected.cookie ? '✓' : '◻︎'} עוגייה</span>
            <span style={detected.bearer ? detPillOn : detPillOff}>{detected.bearer ? '✓' : '◻︎'} טוקן (לא חובה)</span>
            {detected.cookie
              ? <span style={{ color: '#86efac' }}>מוכן להתחברות 🎉</span>
              : <span style={{ color: 'rgba(255,255,255,0.5)' }}>הדביקו את בקשת GetUser</span>}
          </div>
        )}
        <button type="submit" disabled={busy || !detected.cookie} style={{ ...button, opacity: busy || !detected.cookie ? 0.6 : 1 }}>
          {busy ? 'מתחבר…' : 'התחברו'}
        </button>
      </form>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 24 }}>
        נשלח פעם אחת ב-HTTPS לאימות, ואז נשמר רק בדפדפן הזה. שום דבר לא נשמר בשרת משותף.
      </p>

      <button onClick={skip} style={skipBtn} aria-label="דלג">דלג ←</button>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '32px 20px 90px', minHeight: '100vh' };
const step: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' };
const num: React.CSSProperties = { flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 };
const textarea: React.CSSProperties = { width: '100%', minHeight: 120, padding: 12, fontSize: 13, fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, boxSizing: 'border-box', resize: 'vertical' };
const button: React.CSSProperties = { marginTop: 12, background: '#f97316', color: '#fff', border: 'none', borderRadius: 9999, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
const connectedNote: React.CSSProperties = { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 12, padding: 12, marginTop: 8, color: '#86efac', fontSize: 14 };
const detPillBase: React.CSSProperties = { borderRadius: 9999, padding: '4px 12px', fontWeight: 600, border: '1px solid' };
const detPillOn: React.CSSProperties = { ...detPillBase, background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.6)', color: '#86efac' };
const detPillOff: React.CSSProperties = { ...detPillBase, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)' };
const skipBtn: React.CSSProperties = {
  position: 'fixed', bottom: 20, right: 20, background: 'rgba(255,255,255,0.1)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
  borderRadius: 9999, padding: '12px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10,
};
