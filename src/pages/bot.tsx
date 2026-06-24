import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { store } from '../lib/store';

interface DishOption {
  dishId: string; restaurantId: string; categoryId?: string; dishName: string;
  restaurantName: string; priceNis: number; proteinG?: number; caloriesKcal?: number;
  description?: string; deepLink?: string; etaMinutes?: number;
}
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
      const res = await fetch('/api/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session: store.getSession(), preferences: store.getProfile(), addressId: store.getAddress(),
          dishId: dish.dishId, restaurantId: dish.restaurantId, categoryId: dish.categoryId, approveOverBudget,
        }),
      });
      const data = await res.json();
      const r = data.result ?? {};
      if (data.ok) {
        add({ role: 'bot', kind: 'text', text: `הוזמן: ${dish.dishName} מ${dish.restaurantName}. בתיאבון.${dish.etaMinutes != null ? `\nזמן משלוח משוער: כ-${dish.etaMinutes} דקות.` : ''}${r.trackerDeepLink ? `\nמעקב: ${r.trackerDeepLink}` : ''}` });
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

  if (!ready) return <main style={wrap}><p style={{ color: '#64748b', padding: 16 }}>טוען…</p></main>;

  return (
    <main style={wrap}>
      <header style={head}>
        <div style={{ fontWeight: 700 }}>עוזר הצהריים</div>
        <Link href="/lunch" style={{ fontSize: 13, color: '#64748b' }}>כל האפשרויות</Link>
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
        {stage === 'loading' && <span style={{ color: '#94a3b8', fontSize: 14 }}>רגע…</span>}
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
        background: mine ? '#f97316' : '#fff', color: mine ? '#fff' : '#0f172a',
        border: mine ? 'none' : '1px solid #e2e8f0',
      }}>{text}</div>
    </div>
  );
}

function DishCard({ dish }: { dish: DishOption }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}>
      <div style={dishCard}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{dish.dishName}</div>
        <div style={{ color: '#475569', fontSize: 14, marginTop: 2 }}>מסעדה: {dish.restaurantName}</div>
        {dish.description && <div style={{ color: '#64748b', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{dish.description}</div>}
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid #fde7cf' }}>
      <span style={{ color: '#9a3412' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Chip({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      border: primary ? 'none' : '1px solid #fdba74', background: primary ? '#f97316' : '#fff7ed',
      color: primary ? '#fff' : '#9a3412', borderRadius: 999, padding: '10px 16px', fontSize: 15,
      fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  );
}

const wrap: React.CSSProperties = { maxWidth: 680, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a', background: '#f8fafc' };
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff' };
const feed: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 16 };
const bar: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, borderTop: '1px solid #e2e8f0', background: '#fff' };
const dishCard: React.CSSProperties = { maxWidth: '88%', background: '#fff', border: '2px solid #fdba74', borderRadius: 16, padding: 16 };
const detailRows: React.CSSProperties = { marginTop: 12, fontSize: 14, color: '#0f172a' };
