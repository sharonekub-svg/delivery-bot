import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

interface DishOption {
  dishId: string; restaurantId: string; categoryId?: string; dishName: string;
  restaurantName: string; priceNis: number; proteinG?: number; description?: string; deepLink?: string;
}
interface OrderState {
  dishId: string; ok?: boolean; pending?: boolean; overBudget?: boolean; message?: string; trackerDeepLink?: string;
}

/** דף התוצאה: לפי הפרופיל הזכור, מביא ומדרג את אפשרויות 10bis של היום ומזמין. */
export default function Lunch() {
  const router = useRouter();
  const [options, setOptions] = useState<DishOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderState | null>(null);
  const [profile, setProfile] = useState<ReturnType<typeof store.getProfile>>(null);

  const load = useCallback(async () => {
    const session = store.getSession();
    const preferences = store.getProfile();
    const addressId = store.getAddress();
    setProfile(preferences);
    if (!session) { router.replace('/connect'); return; }
    if (!preferences) { router.replace('/profile'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session, preferences, addressId }),
      });
      const data = await res.json();
      if (res.status === 401) { router.replace('/connect'); return; }
      if (!res.ok || !data.ok) { setError(data.error ?? 'לא הצלחנו לטעון את האפשרויות.'); return; }
      setOptions(data.options ?? []);
    } catch {
      setError('תקלת רשת — נסו שוב.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function place(opt: DishOption, approveOverBudget = false) {
    setOrder({ dishId: opt.dishId, pending: true });
    try {
      const res = await fetch('/api/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session: store.getSession(), preferences: store.getProfile(), addressId: store.getAddress(),
          dishId: opt.dishId, restaurantId: opt.restaurantId, categoryId: opt.categoryId, approveOverBudget,
        }),
      });
      const data = await res.json();
      const r = data.result ?? {};
      if (data.ok) {
        setOrder({ dishId: opt.dishId, ok: true, message: `הוזמן ${opt.dishName}!`, trackerDeepLink: r.trackerDeepLink });
      } else if (r.errorCode === 'budget_exceeded') {
        setOrder({ dishId: opt.dishId, overBudget: true, message: r.errorMessage ?? 'זה מעל התקציב היומי.' });
      } else {
        setOrder({ dishId: opt.dishId, ok: false, message: data.error ?? r.errorMessage ?? 'ההזמנה נכשלה.' });
      }
    } catch {
      setOrder({ dishId: opt.dishId, ok: false, message: 'תקלת רשת — נסו שוב.' });
    }
  }

  return (
    <main style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>🍽️ הבחירות של היום</h1>
        <Link href="/profile" style={{ fontSize: 14, color: '#64748b' }}>עריכת פרופיל</Link>
      </header>
      <p style={{ color: '#475569', marginTop: 4 }}>נבחרו מהתפריט החי של 10bis כדי להתאים לטעם, למטרות ולתקציב שלכם.</p>

      {profile && (
        <div style={modeNote}>
          {profile.mode === 'autopilot'
            ? `⏰ ביקשתם הזמנה אוטומטית בסביבות ${profile.triggerTime}. הערה: כדי שזה יקרה לבד גם כשהאתר סגור צריך להוסיף רכיב שרת — פירוט בצ'אט.`
            : `⏰ שעת הזמנה מועדפת: ${profile.triggerTime}. כרגע אתם מאשרים כל הזמנה ידנית כאן.`}
        </div>
      )}

      {loading && <p style={{ color: '#64748b' }}>מחפש את האפשרויות הכי טובות בשבילכם…</p>}
      {error && (
        <div style={errorBox}>
          {error}
          <div style={{ marginTop: 8 }}><button onClick={load} style={smallBtn}>נסו שוב</button></div>
        </div>
      )}

      {!loading && !error && options.length === 0 && (
        <p style={{ color: '#64748b' }}>אין כרגע אפשרויות מתאימות. נסו להרחיב את הפרופיל או לבדוק שוב מאוחר יותר.</p>
      )}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {options.map((opt) => {
          const o = order?.dishId === opt.dishId ? order : null;
          return (
            <div key={opt.dishId} style={card}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{opt.dishName}</div>
                <div style={{ color: '#64748b', fontSize: 14 }}>{opt.restaurantName}</div>
                {opt.description && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{opt.description}</div>}
                <div style={{ marginTop: 8 }}>
                  <span style={pill}>₪{opt.priceNis}</span>
                  {opt.proteinG != null && <span style={pill}>{opt.proteinG}ג חלבון</span>}
                  {opt.deepLink && <a href={opt.deepLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#f97316', marginInlineStart: 6 }}>צפייה ←</a>}
                </div>
                {o?.ok && <div style={{ color: '#16a34a', marginTop: 8, fontWeight: 600 }}>✅ {o.message} {o.trackerDeepLink && <a href={o.trackerDeepLink} target="_blank" rel="noreferrer">מעקב ←</a>}</div>}
                {o && o.ok === false && !o.overBudget && <div style={{ color: '#dc2626', marginTop: 8 }}>❌ {o.message}</div>}
                {o?.overBudget && (
                  <div style={{ marginTop: 8, color: '#b45309' }}>
                    ⚠️ {o.message}{' '}
                    <button onClick={() => place(opt, true)} style={{ ...smallBtn, marginInlineStart: 6 }}>הזמינו בכל זאת</button>
                  </div>
                )}
              </div>
              {!o?.ok && (
                <button onClick={() => place(opt)} disabled={o?.pending} style={{ ...orderBtn, opacity: o?.pending ? 0.6 : 1 }}>
                  {o?.pending ? 'מזמין…' : 'הזמינו'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' };
const card: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 };
const pill: React.CSSProperties = { display: 'inline-block', background: '#f1f5f9', borderRadius: 999, padding: '2px 10px', marginInlineEnd: 6, fontSize: 12, fontWeight: 600, color: '#475569' };
const orderBtn: React.CSSProperties = { flex: '0 0 auto', background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const smallBtn: React.CSSProperties = { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14, color: '#b91c1c', marginTop: 12 };
const modeNote: React.CSSProperties = { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginTop: 12, color: '#1e40af', fontSize: 14 };
