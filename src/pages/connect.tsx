import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

/**
 * שלב 1: חיבור ל-10bis. מדריכים את המשתמש להעתיק את הסשן מכלי הפיתוח, מאמתים
 * בצד השרת, וזוכרים בדפדפן. כפתור "דלג" למטה מימין מאפשר לדלג אם כבר מחוברים.
 */
const ext: React.CSSProperties = { color: '#fdba74', textDecoration: 'underline', fontWeight: 600 };
const kbd: React.CSSProperties = {
  display: 'inline-block', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6, padding: '1px 7px', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700,
};

const STEPS: [string, React.ReactNode][] = [
  [
    'היכנסו לתן ביס במחשב',
    <>במחשב (הכי קל ככה, לא בנייד) פתחו את דף <a href="https://www.10bis.co.il/next/user-transactions" target="_blank" rel="noreferrer" style={ext}>"ההזמנות שלי" בתן ביס ←</a> והתחברו לחשבון שלכם כרגיל. דווקא הדף הזה — כך נתפוס גם את היסטוריית ההזמנות שלכם.</>,
  ],
  [
    'לחצו F12 במקלדת',
    <>הקישו על הכפתור <span style={kbd}>F12</span> (בשורה העליונה של המקלדת). ייפתח חלון נוסף בצד או בתחתית המסך — זה תקין. לא עבד? נסו <span style={kbd}>Ctrl</span>+<span style={kbd}>Shift</span>+<span style={kbd}>I</span>, או במק: <span style={kbd}>⌘</span>+<span style={kbd}>⌥</span>+<span style={kbd}>I</span>.</>,
  ],
  [
    'פתחו את הלשונית Network',
    <>בחלון שנפתח, לחצו על הכיתוב <span style={kbd}>Network</span>. אם אתם לא רואים אותו, לחצו על החץ הכפול » ובחרו אותו מהרשימה.</>,
  ],
  [
    'רעננו את העמוד',
    <>כשהחלון פתוח, הקישו <span style={kbd}>F5</span> כדי לרענן. תתחיל להופיע רשימה ארוכה של שורות בחלון ה-Network.</>,
  ],
  [
    'העתיקו בקשה אחת',
    <>הקלידו <span style={kbd}>NextApi</span> בתיבת הסינון (Filter) שבראש החלון — יישארו רק השורות הנכונות. לחצו קליק ימני על אחת מהן, ואז בחרו: <span style={kbd}>Copy</span> ואז <span style={kbd}>Copy as cURL</span>.</>,
  ],
  [
    'הדביקו כאן ולחצו התחברו',
    <>חזרו לעמוד הזה, לחצו על התיבה למטה, הדביקו (<span style={kbd}>Ctrl</span>+<span style={kbd}>V</span>), ולחצו על "התחברו".</>,
  ],
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
const skipBtn: React.CSSProperties = {
  position: 'fixed', bottom: 20, right: 20, background: 'rgba(255,255,255,0.1)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
  borderRadius: 9999, padding: '12px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10,
};
