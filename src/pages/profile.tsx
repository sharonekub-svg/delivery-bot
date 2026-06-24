import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { store, type StoredProfile } from '../lib/store';

/**
 * Step 2: the taste profile. The "doc you fill in once" — what you like, your
 * goal, protein target, favourite spots, allergies, budget. Saved in this
 * browser and reused every time, so you never answer twice.
 */
const GOALS: { value: string; label: string; macro: StoredProfile['macroFocus'] }[] = [
  { value: 'muscle', label: 'Build muscle', macro: 'high_protein' },
  { value: 'lose', label: 'Lose weight', macro: 'low_carb' },
  { value: 'healthy', label: 'Just eat healthier', macro: 'balanced' },
  { value: 'none', label: 'No specific goal', macro: 'balanced' },
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

  // Connect first; and prefill if they've saved a profile before (it remembers).
  useEffect(() => {
    if (!store.getSession()) { router.replace('/connect'); return; }
    const p = store.getProfile();
    if (p) {
      setLikes(p.inclusions.join(', '));
      setGoal(GOALS.find((g) => g.macro === p.macroFocus && (!p.goal || g.value === p.goal))?.value ?? GOALS.find((g) => g.macro === p.macroFocus)?.value ?? 'none');
      setProtein(p.weeklyProteinTargetG ? String(Math.round(p.weeklyProteinTargetG / 7)) : '');
      setFavorites(p.favoriteRestaurantNames.join(', '));
      setAllergies(p.exclusions.join(', '));
      setBudget(p.dailyBudgetNis);
      setBeverage(p.includeBeverage);
    }
  }, [router]);

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
    };
    store.setProfile(profile);
    router.push('/lunch');
  }

  return (
    <main style={wrap}>
      <div style={{ color: '#94a3b8', fontSize: 13 }}>Step 2 of 2</div>
      <h1 style={{ fontSize: 30, margin: '4px 0' }}>Your taste profile</h1>
      <p style={{ color: '#475569', marginTop: 0 }}>Fill this in once. We’ll remember it and use it to pick your lunch every time.</p>

      <form onSubmit={save}>
        <label style={lbl}>What do you usually like to eat?
          <textarea value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="sushi, grilled chicken, Thai, salads…" style={{ ...ctl, minHeight: 64 }} />
        </label>
        <label style={lbl}>What’s your goal?
          <select value={goal} onChange={(e) => setGoal(e.target.value)} style={ctl}>
            {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <label style={lbl}>Protein goal (grams per day) — optional
          <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 120" style={ctl} />
        </label>
        <label style={lbl}>Favourite restaurants or go-to dishes
          <input value={favorites} onChange={(e) => setFavorites(e.target.value)} placeholder="Greens & Co, Pita Bar…" style={ctl} />
        </label>
        <label style={lbl}>Allergies / things you never want
          <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="gluten, nuts, shellfish…" style={ctl} />
        </label>
        <label style={lbl}>Daily budget (₪)
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={ctl} />
        </label>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
          <input type="checkbox" checked={beverage} onChange={(e) => setBeverage(e.target.checked)} /> Add a beverage when ordering
        </label>
        <button type="submit" style={button}>Save &amp; see my lunch →</button>
      </form>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' };
const lbl: React.CSSProperties = { display: 'block', margin: '18px 0', fontWeight: 600 };
const ctl: React.CSSProperties = { display: 'block', width: '100%', padding: 10, marginTop: 6, fontSize: 16, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8 };
const button: React.CSSProperties = { marginTop: 8, width: '100%', background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
