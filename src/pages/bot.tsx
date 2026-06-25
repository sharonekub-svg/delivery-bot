import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

interface DishOption {
  dishId: string; restaurantId: string; categoryId?: string; dishName: string;
  restaurantName: string; priceNis: number; proteinG?: number; caloriesKcal?: number;
  description?: string; deepLink?: string; etaMinutes?: number;
  popular?: boolean; isGreen?: boolean; healthWarnings?: ('sugar' | 'sodium' | 'fat')[];
}

const WARN_LABEL: Record<string, string> = { sugar: 'סוכר גבוה', sodium: 'נתרן גבוה', fat: 'שומן רווי גבוה' };
interface Msg { id: number; role: 'bot' | 'user'; kind: 'text' | 'dish'; text?: string; dish?: DishOption; }
type Stage = 'freq' | 'craving' | 'loading' | 'dish' | 'overbudget' | 'ordered';

const FREQ = [
  { label: 'פעם בשבוע', value: 1 },
  { label: '2–3 פעמים', value: 3 },
  { label: 'כל יום', value: 5 },
];
const CRAVINGS = [
  { key: 'sushi', label: 'סושי' },
  { key: 'burger', label: 'המבורגר' },
  { key: 'pizza', label: 'פיצה' },
  { key: 'salad', label: 'סלט בריא' },
  { key: 'meat', label: 'בשר' },
  { key: 'any', label: 'שתבחר בשבילי' },
];

/**
 * הצ'אט. ממשק שיחה (בלי AI) שמציע אוכל לפי המטרות שבפרופיל, שואל כמה פעמים בשבוע
 * רוצים להזמין, ומזמין בלחיצה. הכול מונע מהמנוע הקיים — אפס מפתחות.
 */
export default function Bot() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>('freq');
  const [options, setOptions] = useState<DishOption[]>([]);
  const [idx, setIdx] = useState(0);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const add = useCallback((m: Omit<Msg, 'id'>) => setLog((l) => [...l, { ...m, id: idRef.current++ }]), []);

  useEffect(() => {
    if (!store.getSession()) { router.replace('/connect'); return; }
    if (!store.getProfile()) { router.replace('/profile'); return; }
    setReady(true);
    add({ role: 'bot', kind: 'text', text: 'היי, אני העוזר שלך לצהריים. כמה פעמים בשבוע בא לך שאמצא לך אוכל?' });
  }, [router, add]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log, stage]);

  function pickFreq(f: { label: string; value: number }) {
    add({ role: 'user', kind: 'text', text: f.label });
    const p = store.getProfile();
    if (p) store.setProfile({ ...p, ordersPerWeek: f.value });
    setTimeout(() => { add({ role: 'bot', kind: 'text', text: 'מעולה. ועל מה בא לך עכשיו? אתאים את זה למטרות שלך.' }); setStage('craving'); }, 250);
  }

  async function pickCraving(c: { key: string; label: string }) {
    add({ role: 'user', kind: 'text', text: c.label });
    setStage('loading');
    add({ role: 'bot', kind: 'text', text: 'רגע, מחפש לך את הכי טוב…' });
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session: store.getSession(), preferences: store.getProfile(), addressId: store.getAddress(),
          craving: c.key === 'any' ? undefined : c.key, count: 6,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { router.replace('/connect'); return; }
      if (!res.ok || !data.ok || !(data.options?.length)) {
        add({ role: 'bot', kind: 'text', text: 'לא מצאתי כרגע משהו מתאים בקטגוריה הזו. ננסה סוג אחר?' });
        setStage('craving');
        return;
      }
      setOptions(data.options);
      setIdx(0);
      presentDish(data.options[0], 'מצאתי. הנה הפירוט המלא:');
    } catch {
      add({ role: 'bot', kind: 'text', text: 'תקלת רשת. ננסה שוב?' });
      setStage('craving');
    }
  }

  function presentDish(dish: DishOption, lead: string) {
    add({ role: 'bot', kind: 'text', text: lead });
    add({ role: 'bot', kind: 'dish', dish });
    setStage('dish');
  }

  function another() {
    const next = idx + 1;
    if (next < options.length) {
      setIdx(next);
      add({ role: 'user', kind: 'text', text: 'משהו אחר' });
      presentDish(options[next], 'אז אולי זה:');
    } else {
      add({ role: 'user', kind: 'text', text: 'משהו אחר' });
      add({ role: 'bot', kind: 'text', text: 'אלה כל האפשרויות שמצאתי. ננסה סוג אוכל אחר?' });
      setStage('craving');
    }
  }

  async function order(approveOverBudget = false) {
    const dish = options[idx];
    if (!dish) return;
    setStage('loading');
    if (!approveOverBudget) add({ role: 'user', kind: 'text', text: 'כן, הזמינו' });
    add({ role: 'bot', kind: 'text', text: 'מזמין…' });
    try {
      const p = store.getProfile();
      const res = await fetch('/api/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session: store.getSession(), preferences: p, addressId: store.getAddress(),
          dishId: dish.dishId, restaurantId: dish.restaurantId, categoryId: dish.categoryId, approveOverBudget,
          pickup: p?.pickup, dontWantCutlery: p?.dontWantCutlery, useCoupons: p?.useCoupons, orderRemarks: p?.orderRemarks,
        }),
      });
      const data = await res.json();
      const r = data.result ?? {};
      if (data.ok) {
        add({ role: 'bot', kind: 'text', text: `הוזמן: ${dish.dishName} מ${dish.restaurantName}. בתיאבון.${r.discountNis ? `\nחסכת ₪${r.discountNis} עם קופון.` : ''}${dish.etaMinutes != null ? `\nזמן משלוח משוער: כ-${dish.etaMinutes} דקות.` : ''}${r.trackerDeepLink ? `\nמעקב: ${r.trackerDeepLink}` : ''}` });
        setStage('ordered');
      } else if (r.errorCode === 'budget_exceeded') {
        add({ role: 'bot', kind: 'text', text: `${r.errorMessage ?? 'זה מעל התקציב היומי.'} להזמין בכל זאת?` });
        setStage('overbudget');
      } else {
        add({ role: 'bot', kind: 'text', text: `ההזמנה נכשלה: ${data.error ?? r.errorMessage ?? 'שגיאה לא ידועה.'} ננסה אפשרות אחרת?` });
        setStage('dish');
      }
    } catch {
      add({ role: 'bot', kind: 'text', text: 'תקלת רשת. ננסה שוב?' });
      setStage('dish');
    }
  }

  function restart() {
    add({ role: 'user', kind: 'text', text: 'להזמין עוד' });
    add({ role: 'bot', kind: 'text', text: 'בכיף. על מה בא לך הפעם?' });
    setStage('craving');
  }

  if (!ready) return <main style={wrap}><p style={{ color: 'rgba(255,255,255,0.6)', padding: 16 }}>טוען…</p></main>;

  return (
    <main style={wrap}>
      <header style={head}>
        <div style={{ fontWeight: 700 }}>עוזר הצהריים</div>
        <Link href="/lunch" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>כל האפשרויות</Link>
      </header>

      <div style={feed}>
        {log.map((m) => m.kind === 'dish' && m.dish
          ? <DishCard key={m.id} dish={m.dish} />
          : <Bubble key={m.id} role={m.role} text={m.text ?? ''} />)}
        <div ref={endRef} />
      </div>

      <div style={bar}>
        {stage === 'freq' && FREQ.map((f) => <Chip key={f.value} label={f.label} onClick={() => pickFreq(f)} />)}
        {stage === 'craving' && CRAVINGS.map((c) => <Chip key={c.key} label={c.label} onClick={() => pickCraving(c)} />)}
        {stage === 'dish' && (
          <>
            <Chip label="כן, הזמינו" primary onClick={() => order(false)} />
            <Chip label="משהו אחר" onClick={another} />
            <Chip label="סוג אחר" onClick={() => { add({ role: 'user', kind: 'text', text: 'סוג אחר' }); add({ role: 'bot', kind: 'text', text: 'בטח. על מה בא לך?' }); setStage('craving'); }} />
          </>
        )}
        {stage === 'overbudget' && (
          <>
            <Chip label="כן, בכל זאת" primary onClick={() => order(true)} />
            <Chip label="לא, משהו אחר" onClick={another} />
          </>
        )}
        {stage === 'ordered' && <Chip label="להזמין עוד" primary onClick={restart} />}
        {stage === 'loading' && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>רגע…</span>}
      </div>
    </main>
  );
}

function Bubble({ role, text }: { role: 'bot' | 'user'; text: string }) {
  const mine = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-start' : 'flex-end', margin: '6px 0' }}>
      <div style={{
        maxWidth: '80%', whiteSpace: 'pre-wrap', lineHeight: 1.45, padding: '10px 14px', borderRadius: 16,
        background: mine ? '#f97316' : 'rgba(255,255,255,0.06)', color: '#fff',
        border: mine ? 'none' : '1px solid rgba(255,255,255,0.12)',
      }}>{text}</div>
    </div>
  );
}

function DishCard({ dish }: { dish: DishOption }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}>
      <div style={dishCard}>
        <div className="font-heading" style={{ fontWeight: 400, fontSize: 24 }}>{dish.dishName}</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 }}>מסעדה: {dish.restaurantName}</div>
        {(dish.popular || dish.isGreen || dish.healthWarnings?.length) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {dish.popular && <span style={badge('#f59e0b')}>⭐ פופולרי</span>}
            {dish.isGreen && <span style={badge('#16a34a')}>🟢 בריא</span>}
            {dish.healthWarnings?.map((w) => <span key={w} style={badge('#b91c1c')}>{WARN_LABEL[w]}</span>)}
          </div>
        )}
        {dish.description && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{dish.description}</div>}
        <div style={detailRows}>
          <Row label="מחיר" value={`₪${dish.priceNis}`} />
          {dish.etaMinutes != null && <Row label="זמן משלוח משוער" value={`כ-${dish.etaMinutes} דקות`} />}
          {dish.proteinG != null && <Row label="חלבון" value={`${dish.proteinG} גרם`} />}
          {dish.caloriesKcal != null && <Row label="קלוריות" value={`${dish.caloriesKcal}`} />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Chip({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.25)', background: primary ? '#f97316' : 'rgba(255,255,255,0.06)',
      color: '#fff', borderRadius: 9999, padding: '10px 16px', fontSize: 15,
      fontWeight: 600, cursor: 'pointer', backdropFilter: primary ? 'none' : 'blur(8px)',
    }}>{label}</button>
  );
}

const wrap: React.CSSProperties = { maxWidth: 680, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000' };
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' };
const feed: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 16 };
const bar: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' };
const dishCard: React.CSSProperties = { maxWidth: '88%', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(253,186,116,0.5)', borderRadius: 16, padding: 16, backdropFilter: 'blur(8px)' };
const badge = (color: string): React.CSSProperties => ({ display: 'inline-block', background: `${color}22`, border: `1px solid ${color}`, color: '#fff', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 });
const detailRows: React.CSSProperties = { marginTop: 12, fontSize: 14, color: '#fff' };
