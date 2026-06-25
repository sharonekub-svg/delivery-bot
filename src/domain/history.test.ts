import { describe, expect, it } from 'vitest';
import { summarizeHistory, spendThisMonth } from './history';
import type { TenbisHistoryItem } from '../tenbis/types';

const DAY = 24 * 60 * 60 * 1000;
function at(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY).toISOString();
}

const history: TenbisHistoryItem[] = [
  // Chicken bowl ordered 3 times (the favourite).
  { dishId: 'd1', dishName: 'Chicken Bowl', restaurantId: 'r1', restaurantName: 'Greens', priceNis: 52, orderedAt: at(1) },
  { dishId: 'd1', dishName: 'Chicken Bowl', restaurantId: 'r1', restaurantName: 'Greens', priceNis: 52, orderedAt: at(4) },
  { dishId: 'd1', dishName: 'Chicken Bowl', restaurantId: 'r1', restaurantName: 'Greens', priceNis: 52, orderedAt: at(9) },
  // Shawarma ordered twice.
  { dishId: 'd2', dishName: 'Shawarma', restaurantId: 'r2', restaurantName: 'Pita Bar', priceNis: 49, orderedAt: at(2) },
  { dishId: 'd2', dishName: 'Shawarma', restaurantId: 'r2', restaurantName: 'Pita Bar', priceNis: 49, orderedAt: at(15) },
  // Falafel ordered once (rarely).
  { dishId: 'd3', dishName: 'Falafel', restaurantId: 'r2', restaurantName: 'Pita Bar', priceNis: 38, orderedAt: at(20) },
];

describe('summarizeHistory', () => {
  it('ranks the most-ordered dish first in favourites', () => {
    const s = summarizeHistory(history);
    expect(s.favorites[0].dishId).toBe('d1');
    expect(s.favorites[0].count).toBe(3);
    expect(s.favorites.map((f) => f.dishId)).toEqual(['d1', 'd2']);
  });

  it('lists order-once dishes as rarely ordered', () => {
    const s = summarizeHistory(history);
    expect(s.rarely.map((r) => r.dishId)).toEqual(['d3']);
  });

  it('returns recent orders newest first', () => {
    const s = summarizeHistory(history);
    expect(s.recent[0].orderedAt > s.recent[1].orderedAt).toBe(true);
    expect(s.recent[0].dishId).toBe('d1'); // most recent (1 day ago)
  });

  it('derives top restaurants by frequency', () => {
    const s = summarizeHistory(history);
    // Greens (3 orders) and Pita Bar (3 orders) both appear, de-duped by name.
    expect(s.topRestaurants).toContain('Greens');
    expect(s.topRestaurants).toContain('Pita Bar');
    expect(s.topRestaurants).toHaveLength(2);
  });

  it('derives a daily budget from the employer monthly allowance', () => {
    const s = summarizeHistory(history, { monthlyNis: 880 });
    expect(s.monthlyBudgetNis).toBe(880);
    expect(s.dailyBudgetNis).toBe(40); // 880 / 22 working days
  });

  it('prefers the API daily figure over deriving it', () => {
    const s = summarizeHistory(history, { monthlyNis: 880, dailyNis: 45 });
    expect(s.dailyBudgetNis).toBe(45);
  });

  it('passes through the remaining-today allowance', () => {
    const s = summarizeHistory(history, { monthlyNis: 880, remainingTodayNis: 22 });
    expect(s.remainingTodayNis).toBe(22);
  });

  it('sums last-30-day spend and averages order price from real orders', () => {
    const s = summarizeHistory(history);
    // 6 orders within 30 days: 52+52+52+49+49+38 = 292; avg = 49.
    expect(s.monthlySpendNis).toBe(292);
    expect(s.avgOrderNis).toBe(49);
  });

  it('sums only the current calendar month for spendThisMonth', () => {
    const now = new Date(2026, 5, 25); // June 2026
    const items: TenbisHistoryItem[] = [
      { dishId: 'a', dishName: 'A', restaurantId: '1', restaurantName: 'R', priceNis: 50, orderedAt: new Date(2026, 5, 3).toISOString() },
      { dishId: 'b', dishName: 'B', restaurantId: '1', restaurantName: 'R', priceNis: 40, orderedAt: new Date(2026, 5, 20).toISOString() },
      { dishId: 'c', dishName: 'C', restaurantId: '1', restaurantName: 'R', priceNis: 99, orderedAt: new Date(2026, 4, 28).toISOString() }, // May — excluded
    ];
    expect(spendThisMonth(items, now)).toBe(90);
  });

  it('handles empty history without inventing anything', () => {
    const s = summarizeHistory([]);
    expect(s).toMatchObject({ totalOrders: 0, recent: [], favorites: [], rarely: [], topRestaurants: [] });
    expect(s.dailyBudgetNis).toBeUndefined();
  });
});
