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

export interface MonthlyBudgetCheck {
  withinBudget: boolean;
  /** Allowance left this month *before* this order. */
  remainingNis: number;
  /** How much this order would blow past the monthly limit (0 if within). */
  overByNis: number;
}

/**
 * Keep a whole month's orders under the employer's monthly limit. With no known
 * limit there's nothing to enforce, so the order is allowed.
 */
export function checkMonthlyBudget(
  monthlyLimitNis: number | undefined,
  spentThisMonthNis: number,
  orderPriceNis: number,
): MonthlyBudgetCheck {
  if (monthlyLimitNis == null || monthlyLimitNis <= 0) {
    return { withinBudget: true, remainingNis: Infinity, overByNis: 0 };
  }
  const remainingNis = monthlyLimitNis - spentThisMonthNis;
  const overByNis = Math.max(0, orderPriceNis - remainingNis);
  return { withinBudget: overByNis <= 0, remainingNis, overByNis };
}
