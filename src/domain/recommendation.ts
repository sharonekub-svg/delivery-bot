import type { TenbisDish, TenbisHistoryItem } from '../tenbis/types';
import type { Preferences } from './types';

/**
 * Recommendation engine v2 (PRD §4.1, extended).
 *
 *   Score = w1*BudgetFit + w2*MacroGoal + w3*Taste + w4*Health
 *         + w5*HistoricalFrequency + w6*DailyVariety - w7*RecentFatigue
 *
 * All component scores are normalised to [0,1] so weights are comparable.
 * Every pick also carries human-readable Hebrew `reasons` so the UI and the
 * WhatsApp bot can explain *why* a dish was chosen.
 */
export const WEIGHTS = {
  budget: 0.25,
  macro: 0.3,
  taste: 0.2,
  health: 0.15,
  frequency: 0.15,
  variety: 0.05,
  fatigue: 0.4,
};

export interface ScoredDish {
  dish: TenbisDish;
  score: number;
  breakdown: {
    budget: number;
    macro: number;
    taste: number;
    health: number;
    frequency: number;
    variety: number;
    fatigue: number;
  };
  /** Hebrew one-liners explaining the pick, e.g. "עתיר חלבון (42 ג׳)". */
  reasons: string[];
}

function budgetFit(dish: TenbisDish, dailyBudgetNis: number): number {
  if (dailyBudgetNis <= 0) return 0;
  if (dish.priceNis > dailyBudgetNis) return 0; // over budget => excluded by fit
  // Closer to (but under) budget is fine; reward staying within. Linear: full
  // marks at <=80% of budget, tapering to 0.5 at exactly budget.
  const ratio = dish.priceNis / dailyBudgetNis;
  return ratio <= 0.8 ? 1 : 1 - (ratio - 0.8) * 2.5;
}

function macroGoal(dish: TenbisDish, prefs: Preferences): number {
  if (prefs.macroFocus === 'high_protein') {
    if (dish.proteinG == null) return dish.tags?.includes('high-protein') ? 0.7 : 0.4;
    // 40g+ protein = full marks, with a protein-per-shekel value bonus so a
    // cheap 35g bowl can beat an expensive 40g steak.
    const absolute = Math.min(1, dish.proteinG / 40);
    const perShekel = dish.priceNis > 0 ? Math.min(1, dish.proteinG / dish.priceNis) : 0;
    return 0.8 * absolute + 0.2 * perShekel;
  }
  if (prefs.macroFocus === 'low_carb') {
    let s = dish.tags?.includes('low-carb') ? 1 : 0.4;
    // Calorie-aware: a light dish supports the goal even without the tag.
    if (dish.caloriesKcal != null) {
      if (dish.caloriesKcal <= 550) s = Math.max(s, 0.8);
      else if (dish.caloriesKcal >= 900) s = Math.min(s, 0.25);
    }
    return s;
  }
  return 0.6; // balanced: neutral
}

/** Match against the user's stated likes and favourite restaurants. */
function tasteMatch(dish: TenbisDish, prefs: Preferences): number {
  const hay = `${dish.name} ${dish.description ?? ''} ${dish.restaurantName} ${(dish.tags ?? []).join(' ')}`.toLowerCase();
  const likes = (prefs.inclusions ?? []).filter(Boolean);
  const favRestaurants = (prefs.favoriteRestaurantNames ?? []).filter(Boolean);
  if (likes.length === 0 && favRestaurants.length === 0) return 0.5; // neutral

  let s = 0.3; // stated preferences exist but this dish matches none of them
  if (likes.some((l) => hay.includes(l.toLowerCase()))) s += 0.4;
  const rest = dish.restaurantName.toLowerCase();
  if (favRestaurants.some((f) => rest.includes(f.toLowerCase()) || f.toLowerCase().includes(rest))) s += 0.3;
  return Math.min(1, s);
}

/** 10Bis health signals: green badge up, front-of-pack warnings down. */
function healthSignal(dish: TenbisDish, prefs: Preferences): number {
  let s = 0.5;
  if (dish.isGreen) s += 0.4;
  const warnings = dish.healthWarnings?.length ?? 0;
  // Warnings matter more when the user has a health-driven goal.
  const penalty = prefs.macroFocus === 'balanced' ? 0.15 : 0.2;
  s -= warnings * penalty;
  if (dish.popular) s += 0.1;
  return Math.max(0, Math.min(1, s));
}

function historicalFrequency(dish: TenbisDish, history: TenbisHistoryItem[]): number {
  if (history.length === 0) return 0.3;
  const count = history.filter((h) => h.dishId === dish.id).length;
  const max = Math.max(1, ...history.map((h) => history.filter((x) => x.dishId === h.dishId).length));
  return count / max;
}

/**
 * Deterministic daily rotation: a small per-(dish, date) jitter so near-tied
 * dishes trade places across days and the picks never feel stuck — without
 * making recommendations random within the same day.
 */
function dailyVariety(dishId: string, now: Date): number {
  const key = `${dishId}:${now.toISOString().slice(0, 10)}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/** Recency-weighted fatigue: ordered yesterday hurts most, decays over a week. */
function recentFatigue(dish: TenbisDish, history: TenbisHistoryItem[], now: Date): number {
  const recent = history
    .filter((h) => h.dishId === dish.id)
    .map((h) => (now.getTime() - new Date(h.orderedAt).getTime()) / (24 * 3600 * 1000));
  if (recent.length === 0) return 0;
  const minDaysAgo = Math.min(...recent);
  if (minDaysAgo < 1) return 1; // ordered today/yesterday
  if (minDaysAgo >= 7) return 0;
  return 1 - minDaysAgo / 7;
}

export function passesHardFilters(dish: TenbisDish, prefs: Preferences): boolean {
  // Allergen / exclusion filter — never recommend something excluded.
  const hay = `${dish.name} ${dish.description ?? ''} ${(dish.tags ?? []).join(' ')}`.toLowerCase();
  for (const ex of prefs.exclusions) {
    if (ex && hay.includes(ex.toLowerCase())) return false;
  }
  // Over hard budget ceiling is excluded entirely.
  if (dish.priceNis > prefs.dailyBudgetNis) return false;
  return true;
}

function buildReasons(dish: TenbisDish, b: ScoredDish['breakdown'], prefs: Preferences): string[] {
  const reasons: string[] = [];
  if (prefs.macroFocus === 'high_protein' && dish.proteinG != null && dish.proteinG >= 30) {
    reasons.push(`עתיר חלבון (${dish.proteinG} ג׳)`);
  }
  if (prefs.macroFocus === 'low_carb' && dish.caloriesKcal != null && dish.caloriesKcal <= 550) {
    reasons.push(`קל יחסית (${dish.caloriesKcal} קק״ל)`);
  }
  if (b.budget >= 1) reasons.push('משאיר מרווח בתקציב');
  else if (b.budget > 0) reasons.push('בתוך התקציב היומי');
  if (b.taste > 0.5 && (prefs.inclusions?.length || prefs.favoriteRestaurantNames?.length)) {
    reasons.push('מתאים לטעם שציינתם');
  }
  if (dish.isGreen) reasons.push('מסומן כבחירה בריאה');
  if (dish.popular) reasons.push('פופולרי במסעדה');
  if (b.frequency >= 0.6) reasons.push('אהבתם בעבר');
  return reasons;
}

export function scoreDish(
  dish: TenbisDish,
  prefs: Preferences,
  history: TenbisHistoryItem[],
  now: Date,
): ScoredDish {
  const breakdown = {
    budget: budgetFit(dish, prefs.dailyBudgetNis),
    macro: macroGoal(dish, prefs),
    taste: tasteMatch(dish, prefs),
    health: healthSignal(dish, prefs),
    frequency: historicalFrequency(dish, history),
    variety: dailyVariety(dish.id, now),
    fatigue: recentFatigue(dish, history, now),
  };
  const score =
    WEIGHTS.budget * breakdown.budget +
    WEIGHTS.macro * breakdown.macro +
    WEIGHTS.taste * breakdown.taste +
    WEIGHTS.health * breakdown.health +
    WEIGHTS.frequency * breakdown.frequency +
    WEIGHTS.variety * breakdown.variety -
    WEIGHTS.fatigue * breakdown.fatigue;
  return { dish, score, breakdown, reasons: buildReasons(dish, breakdown, prefs) };
}

/**
 * Pick the top `optionCount` dishes. Applies hard filters, the fatigue filter
 * (never the same dish two days running), and de-dupes by restaurant so the
 * options feel varied.
 */
export function recommend(
  dishes: TenbisDish[],
  prefs: Preferences,
  history: TenbisHistoryItem[],
  now = new Date(),
): ScoredDish[] {
  const orderedToday = new Set(
    history
      .filter((h) => (now.getTime() - new Date(h.orderedAt).getTime()) / (24 * 3600 * 1000) < 1)
      .map((h) => h.dishId),
  );

  const ranked = dishes
    .filter((d) => passesHardFilters(d, prefs) && !orderedToday.has(d.id))
    .map((d) => scoreDish(d, prefs, history, now))
    .sort((a, b) => b.score - a.score);

  const picked: ScoredDish[] = [];
  const seenRestaurants = new Set<string>();
  for (const s of ranked) {
    if (seenRestaurants.has(s.dish.restaurantId) && picked.length < ranked.length - 1) continue;
    picked.push(s);
    seenRestaurants.add(s.dish.restaurantId);
    if (picked.length >= prefs.optionCount) break;
  }
  // Backfill if restaurant de-dupe left us short.
  if (picked.length < prefs.optionCount) {
    for (const s of ranked) {
      if (!picked.includes(s)) picked.push(s);
      if (picked.length >= prefs.optionCount) break;
    }
  }
  return picked.slice(0, prefs.optionCount);
}
