import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Preference webview (PRD §3.2). Collects the configurable attributes, saves
 * them, then sends the user to /auth to connect 10Bis (credentials #11).
 */
export default function Onboarding() {
  const [macroFocus, setMacroFocus] = useState('high_protein');
  const [exclusions, setExclusions] = useState('');
  const [includeBeverage, setIncludeBeverage] = useState(false);
  const [dailyBudgetNis, setDailyBudgetNis] = useState(40);
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [triggerTime, setTriggerTime] = useState('09:00');
  const [optionCount, setOptionCount] = useState(2);
  const [mode, setMode] = useState('ask');
  const [status, setStatus] = useState<string | null>(null);

  function toggleDay(d: number) {
    setActiveDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Saving…');
    const userId = new URLSearchParams(window.location.search).get('u') ?? '';
    const preferences = {
      macroFocus,
      exclusions: exclusions.split(',').map((s) => s.trim()).filter(Boolean),
      includeBeverage,
      dailyBudgetNis,
      budgetIsManual: true,
      activeDays,
      triggerTime,
      optionCount,
      mode,
    };
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, preferences }),
    });
    if (res.ok) window.location.href = `/auth?u=${userId}`;
    else setStatus('Something went wrong, please retry.');
  }

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'system-ui', padding: '0 16px' }}>
      <h1>Lunch preferences</h1>
      <form onSubmit={submit}>
        <label style={lbl}>Nutritional focus
          <select value={macroFocus} onChange={(e) => setMacroFocus(e.target.value)} style={ctl}>
            <option value="high_protein">High protein</option>
            <option value="balanced">Balanced</option>
            <option value="low_carb">Low carb</option>
          </select>
        </label>
        <label style={lbl}>Exclusions / allergens (comma-separated)
          <input value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="gluten, nuts" style={ctl} />
        </label>
        <label style={lbl}>
          <input type="checkbox" checked={includeBeverage} onChange={(e) => setIncludeBeverage(e.target.checked)} /> Include a beverage
        </label>
        <label style={lbl}>Daily budget (₪)
          <input type="number" value={dailyBudgetNis} onChange={(e) => setDailyBudgetNis(Number(e.target.value))} style={ctl} />
        </label>
        <div style={lbl}>Active days
          <div>{DAYS.map((d, i) => (
            <button type="button" key={d} onClick={() => toggleDay(i)}
              style={{ ...chip, background: activeDays.includes(i) ? '#2563eb' : '#eee', color: activeDays.includes(i) ? '#fff' : '#333' }}>{d}</button>
          ))}</div>
        </div>
        <label style={lbl}>Daily suggestion time
          <input type="time" value={triggerTime} onChange={(e) => setTriggerTime(e.target.value)} style={ctl} />
        </label>
        <label style={lbl}>Options to show
          <select value={optionCount} onChange={(e) => setOptionCount(Number(e.target.value))} style={ctl}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </label>
        <label style={lbl}>Mode
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={ctl}>
            <option value="ask">Ask me first</option>
            <option value="autopilot">Autopilot (order unless I cancel)</option>
          </select>
        </label>
        <button type="submit" style={{ ...ctl, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Save &amp; connect 10Bis →</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}

const lbl: React.CSSProperties = { display: 'block', margin: '16px 0', fontWeight: 600 };
const ctl: React.CSSProperties = { display: 'block', width: '100%', padding: 10, marginTop: 6, fontSize: 16, boxSizing: 'border-box' };
const chip: React.CSSProperties = { border: 'none', borderRadius: 16, padding: '6px 12px', margin: 4, cursor: 'pointer' };
