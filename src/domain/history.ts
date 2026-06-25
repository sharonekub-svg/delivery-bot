import type { TenbisBudget, TenbisHistoryItem } from '../tenbis/types';
import { deriveDailyBudget } from './preferences';

/**
 * Order-history insights for the profile page. Everything here is *derived from
 * what 10Bis actually returns* — recent orders, what the user orders a lot, what
 * they ordered once and never again, their employer's monthly allowance. We
 * never invent dishes or numbers; if the history is empty the lists are empty.
 */

export interface DishStat {
  dishId: string;
  dishName: string;
  restaurantName: string;
  priceNis: number;
  count: number;
  lastOrderedAt: string; // ISO
}

export interface HistorySummary {
  totalOrders: number;
  /** Most recent orders first, capped. */
  recent: TenbisHistoryItem[];
  /** Ordered most often — "what they like". */
  favorites: DishStat[];
  /** Tried once and never repeated — "what they don't order much". */
  rarely: DishStat[];
  /** Restaurant names by frequency — used to pre-fill favourite restaurants. */
  topRestaurants: string[];
  /** Employer monthly allowance, if 10Bis exposes it. */
  monthlyBudgetNis?: number;
  /** Per-day budget: the API's daily figure, else monthly / working days. */
  dailyBudgetNis?: number;
  /** Allowance left on the Moneycard today, if 10Bis exposes it. */
  remainingTodayNis?: number;
  /** What the user actually spent over the last 30 days (from history). */
  monthlySpendNis: number;
  /** Average price per order across the whole history (rounded). */
  avgOrderNis: number;
}

const CAPS = { recent: 8, favorites: 5, rarely: 5, restaurants: 4 } as const;

function byDish(history: TenbisHistoryItem[]): DishStat[] {
  const map = new Map<string, DishStat>();
  for (const h of history) {
    const existing = map.get(h.dishId);
    if (existing) {
      existing.count += 1;
      if (h.orderedAt > existing.lastOrderedAt) {
        existing.lastOrderedAt = h.orderedAt;
        existing.priceNis = h.priceNis;
      }
    } else {
      map.set(h.dishId, {
        dishId: h.dishId,
        dishName: h.dishName,
        restaurantName: h.restaurantName,
        priceNis: h.priceNis,
        count: 1,
        lastOrderedAt: h.orderedAt,
      });
    }
  }
  return [...map.values()];
}

/**
 * The single most-ordered dish in each restaurant, restaurants ranked by that
 * dish's order count. This gives a *varied* "order from my history" list — your
 * go-to at each place (the top item at McDonald's, the top at Greens, …) instead
 * of five variations of the same most-recent dish.
 */
export function topDishPerRestaurant(history: TenbisHistoryItem[], cap = 6): DishStat[] {
  const best = new Map<string, DishStat>(); // restaurantName -> its most-ordered dish
  for (const s of byDish(history)) {
    const cur = best.get(s.restaurantName);
    if (!cur || s.count > cur.count || (s.count === cur.count && s.lastOrderedAt > cur.lastOrderedAt)) {
      best.set(s.restaurantName, s);
    }
  }
  return [...best.values()]
    .sort((a, b) => b.count - a.count || (a.lastOrderedAt < b.lastOrderedAt ? 1 : -1))
    .slice(0, cap);
}

export function summarizeHistory(
  history: TenbisHistoryItem[],
  budget?: TenbisBudget,
): HistorySummary {
  const recent = [...history]
    .sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1))
    .slice(0, CAPS.recent);

  const stats = byDish(history);
  // Favourites: most-ordered first; break ties by recency.
  const favorites = stats
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count || (a.lastOrderedAt < b.lastOrderedAt ? 1 : -1))
    .slice(0, CAPS.favorites);
  // Rarely: ordered exactly once; oldest first (longest since they bothered).
  const rarely = stats
    .filter((s) => s.count === 1)
    .sort((a, b) => (a.lastOrderedAt < b.lastOrderedAt ? -1 : 1))
    .slice(0, CAPS.rarely);

  const restaurantCounts = new Map<string, number>();
  for (const h of history) {
    restaurantCounts.set(h.restaurantName, (restaurantCounts.get(h.restaurantName) ?? 0) + 1);
  }
  const topRestaurants = [...restaurantCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CAPS.restaurants)
    .map(([name]) => name);

  const monthlyBudgetNis = budget?.monthlyNis;
  const dailyBudgetNis =
    budget?.dailyNis ??
    (monthlyBudgetNis != null ? deriveDailyBudget(monthlyBudgetNis) : undefined);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const monthlySpendNis = Math.round(
    history.filter((h) => new Date(h.orderedAt).getTime() >= cutoff).reduce((sum, h) => sum + h.priceNis, 0),
  );
  const avgOrderNis = history.length
    ? Math.round(history.reduce((sum, h) => sum + h.priceNis, 0) / history.length)
    : 0;

  return {
    totalOrders: history.length,
    recent,
    favorites,
    rarely,
    topRestaurants,
    monthlyBudgetNis,
    dailyBudgetNis,
    remainingTodayNis: budget?.remainingTodayNis,
    monthlySpendNis,
    avgOrderNis,
  };
}
