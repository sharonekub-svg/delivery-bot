import Link from 'next/link';

/** דף הבית. מציג את המוצר ושולח להתחברות ל-10bis. */
export default function Home() {
  return (
    <main style={wrap}>
      <section style={{ textAlign: 'center', padding: '64px 0 32px' }}>
        <div style={{ fontSize: 56 }}>🍽️</div>
        <h1 style={{ fontSize: 40, margin: '12px 0 8px', letterSpacing: -1 }}>עוזר הצהריים</h1>
        <p style={{ fontSize: 20, color: '#475569', maxWidth: 560, margin: '0 auto' }}>
          חברו את חשבון ה-<strong>10bis</strong> שלכם, מלאו פעם אחת את העדפות הטעם, והאתר יזכור —
          ואז יבחר ויזמין לכם את ארוחת הצהריים המושלמת.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/connect" style={cta}>התחברו ל-10bis ←</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', margin: '24px 0' }}>
        {[
          ['🔌', 'מדביקים ומתחילים', 'בלי סיסמה. מעתיקים בקשה אחת מכלי הפיתוח של הדפדפן ומדביקים — זו כל ההתקנה.'],
          ['📝', 'ממלאים פעם אחת', 'המטרות, יעד החלבון, המסעדות האהובות והאלרגיות — נשמר ונזכר, בלי להזין שוב.'],
          ['🛵', 'מזמין באמת', 'בוחר מהתפריט החי אפשרויות שמתאימות לטעם ולתקציב, ומזמין ברגע שאתם מאשרים.'],
        ].map(([icon, title, body]) => (
          <div key={title} style={card}>
            <div style={{ fontSize: 28 }}>{icon}</div>
            <h3 style={{ margin: '8px 0 4px' }}>{title}</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>{body}</p>
          </div>
        ))}
      </section>

      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 32 }}>
        הסשן שלכם נשמר רק בעוגייה בדפדפן שלכם. לעולם איננו רואים את הסיסמה שלכם.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 860, margin: '0 auto', padding: '0 20px 60px',
  fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a',
};
const cta: React.CSSProperties = {
  display: 'inline-block', background: '#f97316', color: '#fff', padding: '14px 28px',
  borderRadius: 12, fontSize: 18, fontWeight: 600, textDecoration: 'none',
};
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 };
