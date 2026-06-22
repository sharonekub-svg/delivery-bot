import type { TenbisDish, TenbisHistoryItem } from '../tenbis/types';
import type { Preferences } from './types';

/**
 * Recommendation engine (PRD §4.1).
 *
 *   Score = w1*BudgetFit + w2*MacroGoal + w3*HistoricalFrequency - w4*RecentFatigue
 *
 * All component scores are normalised to [0,1] so weights are comparable.
 */
export const WEIGHTS = { budget: 0.3, macro: 0.3, frequency: 0.25, fatigue: 0.4 };

export interface ScoredDish {
  dish: TenbisDish;
  score: number;
  breakdown: { budget: number; macro: number; frequency: number; fatigue: number };
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
    // 40g+ protein = full marks.
    return Math.min(1, dish.proteinG / 40);
  }
  if (prefs.macroFocus === 'low_carb') {
    return dish.tags?.includes('low-carb') ? 1 : 0.4;
  }
  return 0.6; // balanced: neutral
}

function historicalFrequency(dish: TenbisDish, history: TenbisHistoryItem[]): number {
  if (history.length === 0) return 0.3;
  const count = history.filter((h) => h.dishId === dish.id).length;
  const max = Math.max(1, ...history.map((h) => history.filter((x) => x.dishId === h.dishId).length));
  return count / max;
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

export function scoreDish(
  dish: TenbisDish,
  prefs: Preferences,
  history: TenbisHistoryItem[],
  now: Date,
): ScoredDish {
  const breakdown = {
    budget: budgetFit(dish, prefs.dailyBudgetNis),
    macro: macroGoal(dish, prefs),
    frequency: historicalFrequency(dish, history),
    fatigue: recentFatigue(dish, history, now),
  };
  const score =
    WEIGHTS.budget * breakdown.budget +
    WEIGHTS.macro * breakdown.macro +
    WEIGHTS.frequency * breakdown.frequency -
    WEIGHTS.fatigue * breakdown.fatigue;
  return { dish, score, breakdown };
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
