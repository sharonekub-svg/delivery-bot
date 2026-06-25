import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { store, type StoredProfile } from '../lib/store';
import type { HistorySummary } from '../domain/history';
import type { SlotResult } from '../domain/calendar';
import type { TenbisCoupon, TenbisUserProfile } from '../tenbis/types';

/**
 * שלב 2: פרופיל הטעם — "המסמך שממלאים פעם אחת". האתר קורא קודם את ההיסטוריה
 * שלכם ב-10bis (הזמנות אחרונות, תקציב חודשי מהמעסיק, מה אוהבים להזמין ומה כמעט
 * לא), ממלא מראש לפי הנתונים האמיתיים, ונותן לכם לכוונן: טווח שעות, ימים, וחיבור
 * ליומן כדי שהמשלוח יגיע כשאין פגישה. נשמר בדפדפן ונזכר.
 */
const GOALS: { value: string; label: string; macro: StoredProfile['macroFocus'] }[] = [
  { value: 'muscle', label: 'בניית שריר', macro: 'high_protein' },
  { value: 'lose', label: 'ירידה במשקל', macro: 'low_carb' },
  { value: 'healthy', label: 'פשוט לאכול בריא יותר', macro: 'balanced' },
  { value: 'none', label: 'אין מטרה מסוימת', macro: 'balanced' },
];

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']; // 0=ראשון … 6=שבת
const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'ימי עבודה (א׳–ה׳)', days: [0, 1, 2, 3, 4] },
  { label: 'א׳–ו׳', days: [0, 1, 2, 3, 4, 5] },
  { label: 'כל יום', days: [0, 1, 2, 3, 4, 5, 6] },
];
const BUDGET_PRESETS = [35, 40, 50, 60];
const TIME_PRESETS: [string, string][] = [['12:30', '17:30'], ['11:30', '14:30'], ['18:00', '20:00']];

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

export default function Profile() {
  const router = useRouter();
  const [likes, setLikes] = useState('');
  const [goal, setGoal] = useState('muscle');
  const [protein, setProtein] = useState('');
  const [favorites, setFavorites] = useState('');
  const [allergies, setAllergies] = useState('');
  const [budget, setBudget] = useState(40);
  const [monthlyBudget, setMonthlyBudget] = useState(''); // '' = no monthly cap
  const [beverage, setBeverage] = useState(false);
  const [timeFrom, setTimeFrom] = useState('12:30');
  const [timeTo, setTimeTo] = useState('17:30');
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [mode, setMode] = useState<'ask' | 'autopilot'>('ask');

  // קריאת ההיסטוריה והחשבון מ-10bis.
  const [insights, setInsights] = useState<HistorySummary | null>(null);
  const [userProfile, setUserProfile] = useState<TenbisUserProfile | null>(null);
  const [coupons, setCoupons] = useState<TenbisCoupon[]>([]);
  const [insightsState, setInsightsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // אפשרויות הזמנה.
  const [pickup, setPickup] = useState(false);
  const [dontWantCutlery, setDontWantCutlery] = useState(false);
  const [useCoupons, setUseCoupons] = useState(true);
  const [orderRemarks, setOrderRemarks] = useState('');

  // חיבור ליומן.
  const [scheduleAroundMeetings, setScheduleAroundMeetings] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [slot, setSlot] = useState<SlotResult | null>(null);
  const [calState, setCalState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [calError, setCalError] = useState<string | null>(null);

  // ממלאים מראש אם כבר נשמר פרופיל (האתר זוכר).
  useEffect(() => {
    const p = store.getProfile();
    const hadProfile = !!p;
    if (p) {
      setLikes(p.inclusions.join(', '));
      setGoal(GOALS.find((g) => g.macro === p.macroFocus && (!p.goal || g.value === p.goal))?.value ?? GOALS.find((g) => g.macro === p.macroFocus)?.value ?? 'none');
      setProtein(p.weeklyProteinTargetG ? String(Math.round(p.weeklyProteinTargetG / 7)) : '');
      setFavorites(p.favoriteRestaurantNames.join(', '));
      setAllergies(p.exclusions.join(', '));
      setBudget(p.dailyBudgetNis);
      if (p.monthlyBudgetNis) setMonthlyBudget(String(p.monthlyBudgetNis));
      setBeverage(p.includeBeverage);
      if (p.timeFrom) setTimeFrom(p.timeFrom);
      if (p.timeTo) setTimeTo(p.timeTo);
      if (p.activeDays?.length) setActiveDays(p.activeDays);
      if (p.mode) setMode(p.mode);
      if (p.scheduleAroundMeetings) setScheduleAroundMeetings(true);
      if (p.calendarUrl) setCalendarUrl(p.calendarUrl);
      if (p.pickup) setPickup(true);
      if (p.dontWantCutlery) setDontWantCutlery(true);
      if (p.useCoupons === false) setUseCoupons(false);
      if (p.orderRemarks) setOrderRemarks(p.orderRemarks);
    }

    // קוראים את ההיסטוריה מ-10bis וממלאים מראש (רק בכניסה ראשונה, בלי לדרוס בחירות).
    const session = store.getSession();
    if (!session) return;
    setInsightsState('loading');
    fetch('/api/insights', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; insights?: HistorySummary; profile?: TenbisUserProfile; coupons?: TenbisCoupon[] }) => {
        if (!data.ok || !data.insights) { setInsightsState('error'); return; }
        setInsights(data.insights);
        if (data.profile) setUserProfile(data.profile);
        if (data.coupons) setCoupons(data.coupons);
        setInsightsState('done');
        // The employer's monthly allowance comes straight from the 10Bis profile —
        // auto-fill it whenever the user hasn't set their own, even on return visits.
        if (data.insights.monthlyBudgetNis && !p?.monthlyBudgetNis) {
          setMonthlyBudget(String(data.insights.monthlyBudgetNis));
        }
        if (!hadProfile) {
          const i = data.insights;
          if (i.dailyBudgetNis) setBudget(i.dailyBudgetNis);
          if (i.topRestaurants.length) setFavorites(i.topRestaurants.join(', '));
          if (i.favorites.length) setLikes(i.favorites.map((f) => f.dishName).join(', '));
        }
      })
      .catch(() => setInsightsState('error'));
  }, []);

  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  function toggleDay(d: number) {
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function checkCalendar() {
    if (!calendarUrl.trim()) return;
    setCalState('loading'); setCalError(null); setSlot(null);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ calendarUrl: calendarUrl.trim(), timeFrom, timeTo }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setCalError(data.error ?? 'לא הצלחנו לקרוא את היומן.'); setCalState('error'); return; }
      setSlot(data.slot);
      setCalState('idle');
    } catch {
      setCalError('תקלת רשת — נסו שוב.'); setCalState('error');
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const g = GOALS.find((x) => x.value === goal) ?? GOALS[3];
    const dailyProtein = Number(protein);
    const profile: StoredProfile = {
      inclusions: list(likes),
      exclusions: list(allergies).map((s) => s.toLowerCase()),
      favoriteRestaurantNames: list(favorites),
      macroFocus: g.macro,
      goal: g.value,
      weeklyProteinTargetG: dailyProtein > 0 ? dailyProtein * 7 : undefined,
      dailyBudgetNis: budget,
      monthlyBudgetNis: Number(monthlyBudget) > 0 ? Number(monthlyBudget) : undefined,
      includeBeverage: beverage,
      timeFrom,
      timeTo,
      activeDays,
      mode,
      scheduleAroundMeetings,
      calendarUrl: scheduleAroundMeetings ? calendarUrl.trim() || undefined : undefined,
      pickup,
      dontWantCutlery,
      useCoupons,
      orderRemarks: orderRemarks.trim() || undefined,
    };
    store.setProfile(profile);
    router.push('/bot');
  }

  return (
    <main style={wrap}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>שלב 2 מתוך 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>
        {userProfile?.firstName ? `היי ${userProfile.firstName} 👋` : 'פרופיל הטעם שלכם'}
      </h1>
      {userProfile?.companyName && (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 2 }}>מחוברים דרך {userProfile.companyName}</div>
      )}
      <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0 }}>ממלאים פעם אחת. נזכור את זה ונשתמש בו כדי לבחור לכם צהריים בכל פעם.</p>

      <InsightsCard state={insightsState} insights={insights} coupons={coupons} />

      <form onSubmit={save}>
        <label style={lbl}>מה אתם בדרך כלל אוהבים לאכול?
          <textarea value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="סושי, עוף בגריל, תאילנדי, סלטים…" style={{ ...ctl, minHeight: 64 }} />
        </label>
        <label style={lbl}>מה המטרה שלכם?
          <select value={goal} onChange={(e) => setGoal(e.target.value)} style={ctl}>
            {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <label style={lbl}>יעד חלבון (גרם ביום) — לא חובה
          <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="למשל 120" style={ctl} />
        </label>
        <label style={lbl}>מסעדות אהובות או מנות קבועות
          <input value={favorites} onChange={(e) => setFavorites(e.target.value)} placeholder="Greens & Co, פיתה בר…" style={ctl} />
        </label>
        <label style={lbl}>אלרגיות / דברים שלעולם לא תרצו
          <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="גלוטן, אגוזים, פירות ים…" style={ctl} />
        </label>

        <div style={lbl}>תקציב יומי (₪)
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={ctl} />
          {insights?.dailyBudgetNis != null && (
            <div style={hint}>לפי המעסיק שלכם ב-10bis: כ-₪{insights.dailyBudgetNis} ליום{insights.monthlyBudgetNis ? ` (₪${insights.monthlyBudgetNis} בחודש)` : ''}.</div>
          )}
          <div style={chipRow}>
            {BUDGET_PRESETS.map((b) => (
              <button type="button" key={b} onClick={() => setBudget(b)} style={budget === b ? presetOn : preset}>₪{b}</button>
            ))}
          </div>
        </div>

        <div style={lbl}>תקציב חודשי כולל (₪)
          <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="נטען לבד מ-10bis…" style={ctl} />
          <div style={hint}>
            {insights?.monthlyBudgetNis != null
              ? 'מילאנו את זה אוטומטית מהקצבה החודשית שמוגדרת לכם ב-10bis. אפשר לשנות אם רוצים.'
              : 'הבוט יוודא שסך כל ההזמנות בחודש לא יעבור את הסכום הזה, ויפרוס לכם אותן לאורך החודש.'}
            {monthlyBudget && Number(monthlyBudget) > 0 && insights?.spentThisMonthNis != null &&
              ` כרגע הוצאתם ₪${insights.spentThisMonthNis} החודש, נשאר ₪${Math.max(0, Number(monthlyBudget) - insights.spentThisMonthNis)}.`}
          </div>
          {insights?.monthlyBudgetNis != null && Number(monthlyBudget) !== insights.monthlyBudgetNis && (
            <div style={chipRow}>
              <button type="button" onClick={() => setMonthlyBudget(String(insights.monthlyBudgetNis))} style={preset}>
                חזרה לקצבה מ-10bis: ₪{insights.monthlyBudgetNis}
              </button>
            </div>
          )}
        </div>

        <div style={lbl}>באיזה טווח שעות להזמין?
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>משעה</span>
            <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} style={{ ...ctl, marginTop: 0 }} />
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>עד</span>
            <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} style={{ ...ctl, marginTop: 0 }} />
          </div>
          <div style={chipRow}>
            {TIME_PRESETS.map(([f, t]) => (
              <button type="button" key={f} onClick={() => { setTimeFrom(f); setTimeTo(t); }}
                style={timeFrom === f && timeTo === t ? presetOn : preset}>{f}–{t}</button>
            ))}
          </div>
        </div>

        <div style={lbl}>באילו ימים להזמין?
          <div style={chipRow}>
            {DAY_PRESETS.map((p) => (
              <button type="button" key={p.label} onClick={() => setActiveDays(p.days)}
                style={sameDays(activeDays, p.days) ? presetOn : preset}>{p.label}</button>
            ))}
          </div>
          <div style={{ ...chipRow, marginTop: 8 }}>
            {DAYS.map((d, i) => (
              <button type="button" key={d} onClick={() => toggleDay(i)}
                style={activeDays.includes(i) ? dayOn : dayOff}>{d}</button>
            ))}
          </div>
        </div>

        <CalendarSection
          on={scheduleAroundMeetings}
          setOn={setScheduleAroundMeetings}
          url={calendarUrl}
          setUrl={setCalendarUrl}
          onCheck={checkCalendar}
          loading={calState === 'loading'}
          error={calError}
          slot={slot}
        />

        <label style={lbl}>איך להזמין?
          <select value={mode} onChange={(e) => setMode(e.target.value as 'ask' | 'autopilot')} style={ctl}>
            <option value="ask">לשאול אותי קודם ולחכות לאישור</option>
            <option value="autopilot">להזמין לבד אוטומטית בטווח הזה</option>
          </select>
        </label>

        <div style={{ ...lbl, fontWeight: 600 }}>אפשרויות הזמנה
          <label style={optRow}>
            <input type="checkbox" checked={beverage} onChange={(e) => setBeverage(e.target.checked)} /> להוסיף משקה בהזמנה
          </label>
          <label style={optRow}>
            <input type="checkbox" checked={useCoupons} onChange={(e) => setUseCoupons(e.target.checked)} /> להשתמש אוטומטית בקופונים והנחות
          </label>
          <label style={optRow}>
            <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} /> איסוף עצמי במקום משלוח (כשאפשר)
          </label>
          <label style={optRow}>
            <input type="checkbox" checked={dontWantCutlery} onChange={(e) => setDontWantCutlery(e.target.checked)} /> בלי סכו״ם חד-פעמי
          </label>
          <input value={orderRemarks} onChange={(e) => setOrderRemarks(e.target.value)} placeholder="הערה קבועה למסעדה (למשל: בלי בצל, להשאיר בקבלה)" style={{ ...ctl, marginTop: 10 }} />
        </div>
        <button type="submit" style={button}>שמרו ודברו עם הבוט ←</button>
      </form>
    </main>
  );
}

/** כרטיס הסיכום של ההיסטוריה — נשען רק על מה ש-10bis החזיר, בלי להמציא. */
function InsightsCard({ state, insights, coupons }: { state: string; insights: HistorySummary | null; coupons: TenbisCoupon[] }) {
  if (state === 'idle') return null;
  if (state === 'loading') return <div style={insightsBox}>קוראים את ההיסטוריה שלכם ב-10bis…</div>;
  if (state === 'error') return <div style={insightsBox}>לא הצלחנו לקרוא היסטוריה כרגע — אפשר למלא ידנית למטה.</div>;
  if (!insights || insights.totalOrders === 0) {
    return <div style={insightsBox}>עדיין אין היסטוריית הזמנות לקרוא ממנה — מלאו את הפרופיל ונתחיל.</div>;
  }
  const top = insights.favorites[0];
  return (
    <div style={insightsBox}>
      <div style={{ fontWeight: 700, color: '#fdba74', marginBottom: 8 }}>מה שראינו אצלכם ב-10bis</div>
      {(insights.monthlyBudgetNis != null || insights.remainingTodayNis != null || insights.monthlySpendNis > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {insights.monthlyBudgetNis != null && <Stat label="תקציב חודשי (מגבלה)">₪{insights.monthlyBudgetNis}</Stat>}
          {insights.remainingThisMonthNis != null && <Stat label="נשאר החודש">₪{insights.remainingThisMonthNis}</Stat>}
          {insights.spentThisMonthNis > 0 && <Stat label="הוצאת החודש">₪{insights.spentThisMonthNis}</Stat>}
          {insights.remainingTodayNis != null && <Stat label="נשאר היום">₪{insights.remainingTodayNis}</Stat>}
          {insights.avgOrderNis > 0 && <Stat label="ממוצע להזמנה">₪{insights.avgOrderNis}</Stat>}
        </div>
      )}
      {top && <div style={{ marginBottom: 8 }}>נתחיל מההמלצה לפי ההיסטוריה: <b>{top.dishName}</b> (הזמנתם {top.count} פעמים).</div>}
      {insights.recent.length > 0 && (
        <Line label="הזמנות אחרונות">{insights.recent.slice(0, 4).map((r) => r.dishName).join(' · ')}</Line>
      )}
      {insights.favorites.length > 0 && (
        <Line label="מזמינים הכי הרבה">{insights.favorites.map((f) => `${f.dishName} ×${f.count}`).join(' · ')}</Line>
      )}
      {insights.rarely.length > 0 && (
        <Line label="כמעט לא הזמנתם">{insights.rarely.map((r) => r.dishName).join(' · ')}</Line>
      )}
      {coupons.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>קופונים זמינים בחשבון:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {coupons.map((c, i) => (
              <span key={c.code ?? i} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 9999, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>
                🎟️ {c.description}{c.code ? ` (${c.code})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>מילאנו את התקציב, המסעדות והטעמים מראש מהנתונים האלה — אפשר לשנות הכל למטה.</div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 12px', minWidth: 96 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{children}</div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, margin: '4px 0', color: 'rgba(255,255,255,0.85)' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}: </span>{children}
    </div>
  );
}

/** חיבור ליומן: הדבקת קישור iCal, ובדיקה של חלון פנוי בלי פגישות. */
function CalendarSection({ on, setOn, url, setUrl, onCheck, loading, error, slot }: {
  on: boolean; setOn: (v: boolean) => void; url: string; setUrl: (v: string) => void;
  onCheck: () => void; loading: boolean; error: string | null; slot: SlotResult | null;
}) {
  return (
    <div style={{ ...lbl, marginTop: 24 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        תזמנו את המשלוח סביב הפגישות שלי
      </label>
      <div style={{ ...hint, fontWeight: 400 }}>נחבר את היומן שלכם, נראה מתי יש פגישות, ונכוון שהאוכל יגיע דווקא בחלון פנוי — שתוכלו לאכול ברוגע.</div>
      {on && (
        <div style={{ marginTop: 10 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="קישור iCal סודי מהיומן (Google Calendar → הגדרות → כתובת סודית בפורמט iCal)" style={ctl} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={onCheck} disabled={loading || !url.trim()} style={{ ...preset, opacity: loading || !url.trim() ? 0.5 : 1 }}>
              {loading ? 'בודקים…' : 'בדקו את היומן של היום'}
            </button>
            {slot?.suggestedTime && <span style={{ color: '#86efac', fontSize: 14, fontWeight: 600 }}>זמן מומלץ למשלוח: {slot.suggestedTime}</span>}
          </div>
          {error && <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 8 }}>{error}</div>}
          {slot && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
              {slot.reason}
              {slot.busy.length > 0 && (
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.55)' }}>
                  פגישות היום בטווח: {slot.busy.map((b) => `${b.from}–${b.to}`).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px', minHeight: '100vh' };
const lbl: React.CSSProperties = { display: 'block', margin: '18px 0', fontWeight: 600 };
const ctl: React.CSSProperties = { display: 'block', width: '100%', padding: 10, marginTop: 6, fontSize: 16, boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10 };
const button: React.CSSProperties = { marginTop: 8, width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 9999, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontWeight: 400 };
const preset: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 9999, padding: '6px 12px', fontSize: 14, cursor: 'pointer' };
const presetOn: React.CSSProperties = { ...preset, background: '#f97316', borderColor: '#f97316', fontWeight: 600 };
const dayOff: React.CSSProperties = { ...preset, padding: '6px 0', width: 40, textAlign: 'center' };
const dayOn: React.CSSProperties = { ...dayOff, background: '#f97316', borderColor: '#f97316', fontWeight: 700 };
const hint: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 };
const optRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, margin: '10px 0' };
const insightsBox: React.CSSProperties = { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(253,186,116,0.4)', borderRadius: 14, padding: 16, margin: '16px 0', color: '#fff' };
