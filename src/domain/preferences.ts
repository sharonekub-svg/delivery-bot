import type { Preferences } from './types';

/** Average Israeli working days per month, used to derive a daily budget. */
export const AVG_ISRAELI_WORKING_DAYS = 22;

/** PRD §3.2 default profile. */
export function defaultPreferences(): Preferences {
  return {
    macroFocus: 'high_protein',
    weeklyProteinTargetG: undefined,
    exclusions: [],
    inclusions: [],
    includeBeverage: false,
    favoriteDishIds: [],
    dailyBudgetNis: 40,
    budgetIsManual: false,
    activeDays: [0, 1, 2, 3, 4], // Sun–Thu
    planningHorizon: 'daily',
    triggerTime: '09:00',
    optionCount: 2,
    mode: 'ask',
  };
}

/** Daily budget = monthly allowance / avg working days, unless manually set. */
export function deriveDailyBudget(monthlyNis: number): number {
  return Math.floor(monthlyNis / AVG_ISRAELI_WORKING_DAYS);
}

export function isActiveDay(prefs: Preferences, date: Date, timeZone: string): boolean {
  // Day-of-week in the app timezone.
  const dow = new Date(date.toLocaleString('en-US', { timeZone })).getDay();
  return prefs.activeDays.includes(dow);
}

/** True on the first active day of the week — when the weekly preview goes out. */
export function isFirstActiveDayOfWeek(prefs: Preferences, date: Date, timeZone: string): boolean {
  if (prefs.activeDays.length === 0) return false;
  const dow = new Date(date.toLocaleString('en-US', { timeZone })).getDay();
  return dow === Math.min(...prefs.activeDays);
}
