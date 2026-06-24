import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { store, type StoredProfile } from '../lib/store';

/**
 * שלב 2: פרופיל הטעם — "המסמך שממלאים פעם אחת". מה אוהבים, מה המטרה, יעד חלבון,
 * מסעדות אהובות, אלרגיות, תקציב, שעת הזמנה והאם להזמין לבד. נשמר בדפדפן ונזכר.
 */
const GOALS: { value: string; label: string; macro: StoredProfile['macroFocus'] }[] = [
  { value: 'muscle', label: 'בניית שריר', macro: 'high_protein' },
  { value: 'lose', label: 'ירידה במשקל', macro: 'low_carb' },
  { value: 'healthy', label: 'פשוט לאכול בריא יותר', macro: 'balanced' },
  { value: 'none', label: 'אין מטרה מסוימת', macro: 'balanced' },
];

export default function Profile() {
  const router = useRouter();
  const [likes, setLikes] = useState('');
  const [goal, setGoal] = useState('muscle');
  const [protein, setProtein] = useState('');
  const [favorites, setFavorites] = useState('');
  const [allergies, setAllergies] = useState('');
  const [budget, setBudget] = useState(40);
  const [beverage, setBeverage] = useState(false);
  const [timeFrom, setTimeFrom] = useState('12:30');
  const [timeTo, setTimeTo] = useState('17:30');
  const [mode, setMode] = useState<'ask' | 'autopilot'>('ask');

  // ממלאים מראש אם כבר נשמר פרופיל (האתר זוכר).
  useEffect(() => {
    const p = store.getProfile();
    if (p) {
      setLikes(p.inclusions.join(', '));
      setGoal(GOALS.find((g) => g.macro === p.macroFocus && (!p.goal || g.value === p.goal))?.value ?? GOALS.find((g) => g.macro === p.macroFocus)?.value ?? 'none');
      setProtein(p.weeklyProteinTargetG ? String(Math.round(p.weeklyProteinTargetG / 7)) : '');
      setFavorites(p.favoriteRestaurantNames.join(', '));
      setAllergies(p.exclusions.join(', '));
      setBudget(p.dailyBudgetNis);
      setBeverage(p.includeBeverage);
      if (p.timeFrom) setTimeFrom(p.timeFrom);
      if (p.timeTo) setTimeTo(p.timeTo);
      if (p.mode) setMode(p.mode);
    }
  }, []);

  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

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
      includeBeverage: beverage,
      timeFrom,
      timeTo,
      mode,
    };
    store.setProfile(profile);
    router.push('/bot');
  }

  return (
    <main style={wrap}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>שלב 2 מתוך 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>פרופיל הטעם שלכם</h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0 }}>ממלאים פעם אחת. נזכור את זה ונשתמש בו כדי לבחור לכם צהריים בכל פעם.</p>

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
        <label style={lbl}>תקציב יומי (₪)
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={ctl} />
        </label>
        <div style={lbl}>באיזה טווח שעות להזמין?
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>משעה</span>
            <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} style={{ ...ctl, marginTop: 0 }} />
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>עד</span>
            <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} style={{ ...ctl, marginTop: 0 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontWeight: 400 }}>
            {[['12:30', '17:30'], ['18:00', '20:00'], ['11:30', '14:30']].map(([f, t]) => (
              <button type="button" key={f} onClick={() => { setTimeFrom(f); setTimeTo(t); }} style={preset}>{f}–{t}</button>
            ))}
          </div>
        </div>
        <label style={lbl}>איך להזמין?
          <select value={mode} onChange={(e) => setMode(e.target.value as 'ask' | 'autopilot')} style={ctl}>
            <option value="ask">לשאול אותי קודם ולחכות לאישור</option>
            <option value="autopilot">להזמין לבד אוטומטית בשעה הזו</option>
          </select>
        </label>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
          <input type="checkbox" checked={beverage} onChange={(e) => setBeverage(e.target.checked)} /> להוסיף משקה בהזמנה
        </label>
        <button type="submit" style={button}>שמרו ודברו עם הבוט ←</button>
      </form>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px', minHeight: '100vh' };
const lbl: React.CSSProperties = { display: 'block', margin: '18px 0', fontWeight: 600 };
const ctl: React.CSSProperties = { display: 'block', width: '100%', padding: 10, marginTop: 6, fontSize: 16, boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10 };
const button: React.CSSProperties = { marginTop: 8, width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 9999, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
const preset: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 9999, padding: '6px 12px', fontSize: 14, cursor: 'pointer' };
