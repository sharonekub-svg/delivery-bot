import type { TenbisDish } from '../tenbis/types';
import type { Preferences } from './types';

export interface BudgetCheck {
  withinBudget: boolean;
  overByNis: number;
}

/** PRD §4.3 — flag dishes that exceed the daily allocation. */
export function checkBudget(dish: TenbisDish, prefs: Preferences): BudgetCheck {
  const over = dish.priceNis - prefs.dailyBudgetNis;
  return { withinBudget: over <= 0, overByNis: Math.max(0, over) };
}
