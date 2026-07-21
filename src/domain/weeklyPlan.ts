import { passesHardFilters, scoreDish, type ScoredDish } from './recommendation';
import type { Preferences } from './types';
import type { TenbisDish, TenbisHistoryItem } from '../tenbis/types';

/**
 * Weekly meal plan (PRD §3.2 "Planning Horizon: weekly"): one pick per active
 * day, no dish repeated in the week and restaurants spread out, all inside the
 * daily budget. Deterministic for a given week so a re-run shows the same plan.
 */
export interface PlannedDay {
  /** Day of week, 0=Sunday..6=Saturday. */
  day: number;
  date: string; // ISO yyyy-mm-dd
  pick: ScoredDish;
}

export interface WeeklyPlan {
  days: PlannedDay[];
  totalNis: number;
}

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function dayNameHe(day: number): string {
  return DAY_NAMES_HE[day] ?? '';
}

/** The next occurrence of each active day, starting from (and including) `from`. */
export function upcomingActiveDates(prefs: Preferences, from: Date): { day: number; date: Date }[] {
  const out: { day: number; date: Date }[] = [];
  for (let offset = 0; offset < 7 && out.length < prefs.activeDays.length; offset++) {
    const d = new Date(from.getTime() + offset * 24 * 3600 * 1000);
    if (prefs.activeDays.includes(d.getDay())) out.push({ day: d.getDay(), date: d });
  }
  return out;
}

export function buildWeeklyPlan(
  dishes: TenbisDish[],
  prefs: Preferences,
  history: TenbisHistoryItem[],
  from = new Date(),
): WeeklyPlan {
  const dates = upcomingActiveDates(prefs, from);
  const usedDishes = new Set<string>();
  const usedRestaurants = new Set<string>();
  const days: PlannedDay[] = [];

  for (const { day, date } of dates) {
    const ranked = dishes
      .filter((d) => passesHardFilters(d, prefs) && !usedDishes.has(d.id))
      .map((d) => scoreDish(d, prefs, history, date))
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) continue;

    // Prefer a restaurant we haven't planned yet this week; fall back if all used.
    const pick = ranked.find((s) => !usedRestaurants.has(s.dish.restaurantId)) ?? ranked[0];
    usedDishes.add(pick.dish.id);
    usedRestaurants.add(pick.dish.restaurantId);
    days.push({ day, date: date.toISOString().slice(0, 10), pick });
  }

  return { days, totalNis: days.reduce((sum, d) => sum + d.pick.dish.priceNis, 0) };
}
