import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store, type StoredAddress } from '../lib/store';
import { nextDeliverySlot, describeSlot, type DeliverySlot } from '../domain/schedule';

interface DishOption {
  dishId: string; restaurantId: string; categoryId?: string; dishName: string;
  restaurantName: string; priceNis: number; proteinG?: number; caloriesKcal?: number;
  description?: string; deepLink?: string; etaMinutes?: number;
  popular?: boolean; isGreen?: boolean; healthWarnings?: ('sugar' | 'sodium' | 'fat')[];
  historyCount?: number;
}

type Basis = 'history' | 'goal';

const WARN_LABEL: Record<string, string> = { sugar: 'סוכר גבוה', sodium: 'נתרן גבוה', fat: 'שומן רווי גבוה' };
function Badges({ dish }: { dish: DishOption }) {
  if (!dish.popular && !dish.isGreen && !dish.healthWarnings?.length && dish.historyCount == null) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {dish.historyCount != null && <span style={badge('#f97316')}>🔁 הזמנת ×{dish.historyCount}</span>}
      {dish.popular && <span style={badge('#f59e0b')}>⭐ פופולרי</span>}
      {dish.isGreen && <span style={badge('#16a34a')}>🟢 בריא</span>}
      {dish.healthWarnings?.map((w) => <span key={w} style={badge('#b91c1c')}>{WARN_LABEL[w]}</span>)}
    </div>
  );
}
interface OrderState {
  dishId: string; ok?: boolean; pending?: boolean; overBudget?: boolean; message?: string; trackerDeepLink?: string;
}

/** בית / עבודה / אחר — לפי תווית הכתובת ב-10bis, כדי לשאול "לאן לשלוח?". */
function addressKind(label: string): 'home' | 'work' | 'other' {
  const l = label.toLowerCase();
  if (/בית|home|דירה/.test(l)) return 'home';
  if (/עבוד|work|office|משרד|חברה/.test(l)) return 'work';
  return 'other';
}
const ADDRESS_ICON = { home: '🏠', work: '🏢', other: '📍' } as const;

/** דף התוצאה: בוחרים על מה לבסס (הזמנות קודמות / מטרת חלבון), לאן לשלוח, וקובעים
 *  הזמנה מתוזמנת לימים ולשעות שהוגדרו בפרופיל — לא מזמין עכשיו. */
export default function Lunch() {
  const router = useRouter();
  const [options, setOptions] = useState<DishOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderState | null>(null);
  const [profile, setProfile] = useState<ReturnType<typeof store.getProfile>>(null);
  const [basis, setBasis] = useState<Basis>('history');
  const [addresses, setAddresses] = useState<StoredAddress[]>([]);
  const [addressId, setAddressId] = useState<string>('');

  // הזמנה מתוזמנת ליום ולשעה הקרובים מהפרופיל (מחושב בזמן המקומי של הדפדפן).
  const slot: DeliverySlot | null = useMemo(
    () => (profile ? nextDeliverySlot(profile.activeDays ?? [0, 1, 2, 3, 4], profile.timeFrom || '12:30') : null),
    [profile],
  );

  // טעינת הכתובות (בית/עבודה) — מהזיכרון, ואם אין מ-10bis.
  useEffect(() => {
    const session = store.getSession();
    if (!session) { router.replace('/connect'); return; }
    const saved = store.getAddresses();
    const selected = store.getAddress() ?? '';
    if (saved?.length) { setAddresses(saved); setAddressId(selected || saved[0].id); return; }
    fetch('/api/addresses', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; addresses?: StoredAddress[] }) => {
        if (data.ok && data.addresses?.length) {
          store.setAddresses(data.addresses);
          setAddresses(data.addresses);
          setAddressId(selected || data.addresses[0].id);
        }
      })
      .catch(() => { /* בלי כתובות נמשיך עם מה שנשמר בחיבור */ });
  }, [router]);

  const load = useCallback(async (forBasis: Basis, forAddress: string) => {
    const session = store.getSession();
    const preferences = store.getProfile();
    setProfile(preferences);
    if (!session) { router.replace('/connect'); return; }
    if (!preferences) { router.replace('/profile'); return; }
    if (!forAddress) return; // עוד אין כתובת נבחרת — נחכה לבחירה
    setLoading(true); setError(null); setOrder(null);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session, preferences, addressId: forAddress, basis: forBasis, count: 5 }),
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

  useEffect(() => { if (addressId) load(basis, addressId); }, [load, basis, addressId]);

  function chooseAddress(id: string) {
    setAddressId(id);
    store.setAddress(id);
  }

  async function place(opt: DishOption, approveOverBudget = false) {
    setOrder({ dishId: opt.dishId, pending: true });
    try {
      const p = store.getProfile();
      const res = await fetch('/api/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session: store.getSession(), preferences: p, addressId,
          dishId: opt.dishId, restaurantId: opt.restaurantId, categoryId: opt.categoryId, approveOverBudget,
          deliverAt: slot?.iso,
          pickup: p?.pickup, dontWantCutlery: p?.dontWantCutlery, useCoupons: p?.useCoupons, orderRemarks: p?.orderRemarks,
        }),
      });
      const data = await res.json();
      const r = data.result ?? {};
      if (data.ok) {
        const when = slot ? ` — יגיע ${describeSlot(slot)}` : '';
        setOrder({ dishId: opt.dishId, ok: true, message: `נקבע ${opt.dishName}${when}.${r.discountNis ? ` חסכת ₪${r.discountNis} עם קופון.` : ''}`, trackerDeepLink: r.trackerDeepLink });
      } else if (r.errorCode === 'budget_exceeded') {
        setOrder({ dishId: opt.dishId, overBudget: true, message: r.errorMessage ?? 'זה מעל התקציב היומי.' });
      } else {
        setOrder({ dishId: opt.dishId, ok: false, message: data.error ?? r.errorMessage ?? 'ההזמנה נכשלה.' });
      }
    } catch {
      setOrder({ dishId: opt.dishId, ok: false, message: 'תקלת רשת — נסו שוב.' });
    }
  }

  const ctaLabel = (pending?: boolean) => (pending ? 'קובע…' : 'קבעו את ההזמנה');

  return (
    <main style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="font-heading" style={{ fontSize: 32, margin: 0 }}>הבחירות של היום</h1>
        <Link href="/profile" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>עריכת פרופיל</Link>
      </header>

      {/* על מה לבסס את הבחירה */}
      <div style={{ marginTop: 16 }}>
        <div style={controlLabel}>על מה לבסס את הצהריים?</div>
        <div style={chipRow}>
          <button onClick={() => setBasis('history')} style={basis === 'history' ? chipOn : chip}>ההזמנות הקודמות שלי</button>
          <button onClick={() => setBasis('goal')} style={basis === 'goal' ? chipOn : chip}>מטרת החלבון שלי</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6, fontSize: 13 }}>
          {basis === 'history'
            ? 'המנות שאתם מזמינים הכי הרבה — אחת מכל מסעדה, מבין מה שזמין היום.'
            : 'דירוג מתוך התפריט החי לפי החלבון, התקציב והטעם שלכם.'}
        </p>
      </div>

      {/* לאן לשלוח */}
      {addresses.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={controlLabel}>לאן לשלוח?</div>
          <div style={chipRow}>
            {addresses.map((a) => {
              const k = addressKind(a.label);
              const label = k === 'home' ? 'בית' : k === 'work' ? 'עבודה' : a.label;
              return (
                <button key={a.id} onClick={() => chooseAddress(a.id)} style={addressId === a.id ? chipOn : chip} title={a.raw ?? a.label}>
                  {ADDRESS_ICON[k]} {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* מתי זה יוזמן — לא עכשיו */}
      <div style={slotNote}>
        {slot
          ? <>🗓️ ההזמנה לא יוצאת עכשיו — תיקבע ל<b>{describeSlot(slot)}</b>, בימים ובשעות שהגדרתם בפרופיל.</>
          : <>לא הוגדרו ימים/שעות להזמנה. <Link href="/profile" style={{ color: '#fdba74' }}>עדכנו בפרופיל</Link> כדי שאפשר יהיה לתזמן.</>}
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.6)' }}>מחפש את האפשרויות הכי טובות בשבילכם…</p>}
      {error && (
        <div style={errorBox}>
          {error}
          <div style={{ marginTop: 8 }}><button onClick={() => load(basis, addressId)} style={smallBtn}>נסו שוב</button></div>
        </div>
      )}

      {!loading && !error && options.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
          {basis === 'history' ? 'לא מצאנו מההזמנות הקודמות משהו שזמין כרגע לכתובת הזו. נסו "מטרת החלבון" או כתובת אחרת.' : 'אין כרגע אפשרויות מתאימות. נסו להרחיב את הפרופיל או לבדוק שוב מאוחר יותר.'}
        </p>
      )}

      {options.length > 0 && (() => {
        const top = options[0];
        const rest = options.slice(1);
        const o = order?.dishId === top.dishId ? order : null;
        return (
          <>
            {/* ההמלצה המובילה — עם כפתור ענק לתזמון (לא הזמנה מיידית) */}
            <div style={heroCard}>
              <div style={{ fontSize: 15, color: '#fdba74', fontWeight: 600 }}>
                {basis === 'history' ? 'הקבועה שלך' : 'הבחירה המובילה בשבילך'}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px' }}>{top.dishName}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>מ{top.restaurantName}</div>
              {top.description && <div style={{ color: '#fdba74', fontSize: 14, marginTop: 6 }}>{top.description}</div>}
              <Badges dish={top} />
              <div style={{ marginTop: 10 }}>
                <span style={heroPill}>₪{top.priceNis}</span>
                {top.proteinG != null && <span style={heroPill}>{top.proteinG}ג חלבון</span>}
                {top.caloriesKcal != null && <span style={heroPill}>{top.caloriesKcal} קלוריות</span>}
                {top.etaMinutes != null && <span style={heroPill}>משלוח כ-{top.etaMinutes} דק׳</span>}
              </div>
              <OrderStatus o={o} onForce={() => place(top, true)} />
              {!o?.ok && (
                <button onClick={() => place(top)} disabled={o?.pending || !slot} style={{ ...heroBtn, opacity: o?.pending || !slot ? 0.6 : 1 }}>
                  {ctaLabel(o?.pending)}
                </button>
              )}
            </div>

            {rest.length > 0 && (
              <>
                <h2 style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: '24px 0 8px' }}>או אפשרויות אחרות</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {rest.map((opt) => {
                    const ro = order?.dishId === opt.dishId ? order : null;
                    return (
                      <div key={opt.dishId} style={card}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 17 }}>{opt.dishName}</div>
                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{opt.restaurantName}</div>
                          {opt.description && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 }}>{opt.description}</div>}
                          <Badges dish={opt} />
                          <div style={{ marginTop: 8 }}>
                            <span style={pill}>₪{opt.priceNis}</span>
                            {opt.proteinG != null && <span style={pill}>{opt.proteinG}ג חלבון</span>}
                            {opt.caloriesKcal != null && <span style={pill}>{opt.caloriesKcal} קלוריות</span>}
                            {opt.etaMinutes != null && <span style={pill}>משלוח כ-{opt.etaMinutes} דק׳</span>}
                            {opt.deepLink && <a href={opt.deepLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#f97316', marginInlineStart: 6 }}>צפייה</a>}
                          </div>
                          <OrderStatus o={ro} onForce={() => place(opt, true)} />
                        </div>
                        {!ro?.ok && (
                          <button onClick={() => place(opt)} disabled={ro?.pending || !slot} style={{ ...orderBtn, opacity: ro?.pending || !slot ? 0.6 : 1 }}>
                            {ctaLabel(ro?.pending)}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        );
      })()}
    </main>
  );
}

/** הצגת מצב ההזמנה (הצלחה / שגיאה / מעל תקציב) — משותף לכרטיס המוביל ולשאר. */
function OrderStatus({ o, onForce }: { o: OrderState | null; onForce: () => void }) {
  if (!o) return null;
  if (o.ok) return <div style={{ color: '#16a34a', marginTop: 8, fontWeight: 600 }}>✅ {o.message} {o.trackerDeepLink && <a href={o.trackerDeepLink} target="_blank" rel="noreferrer">מעקב ←</a>}</div>;
  if (o.overBudget) return (
    <div style={{ marginTop: 8, color: '#fbbf24' }}>
      ⚠️ {o.message}{' '}
      <button onClick={onForce} style={smallBtn}>קבעו בכל זאת</button>
    </div>
  );
  if (o.ok === false) return <div style={{ color: '#f87171', marginTop: 8 }}>❌ {o.message}</div>;
  return null;
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px', minHeight: '100vh' };
const card: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 };
const pill: React.CSSProperties = { display: 'inline-block', background: 'rgba(255,255,255,0.08)', borderRadius: 9999, padding: '2px 10px', marginInlineEnd: 6, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' };
const badge = (color: string): React.CSSProperties => ({ display: 'inline-block', background: `${color}22`, border: `1px solid ${color}`, color: '#fff', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 });
const orderBtn: React.CSSProperties = { flex: '0 0 auto', background: '#f97316', color: '#fff', border: 'none', borderRadius: 9999, padding: '10px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const smallBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const errorBox: React.CSSProperties = { background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 12, padding: 14, color: '#fca5a5', marginTop: 12 };
const slotNote: React.CSSProperties = { background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(147,197,253,0.35)', borderRadius: 12, padding: 12, marginTop: 16, color: '#bfdbfe', fontSize: 14 };
const controlLabel: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 8 };
const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const chip: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 9999, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const chipOn: React.CSSProperties = { ...chip, background: '#f97316', borderColor: '#f97316' };
const heroCard: React.CSSProperties = { background: 'rgba(249,115,22,0.12)', border: '2px solid rgba(253,186,116,0.55)', borderRadius: 20, padding: 20, marginTop: 16, backdropFilter: 'blur(8px)' };
const heroPill: React.CSSProperties = { display: 'inline-block', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(253,186,116,0.5)', borderRadius: 9999, padding: '3px 12px', marginInlineEnd: 6, fontSize: 13, fontWeight: 700, color: '#fff' };
const heroBtn: React.CSSProperties = { marginTop: 16, width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 9999, padding: '16px 24px', fontSize: 19, fontWeight: 800, cursor: 'pointer' };
