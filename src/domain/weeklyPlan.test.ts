import { describe, expect, it } from 'vitest';
import { buildWeeklyPlan, upcomingActiveDates } from './weeklyPlan';
import { defaultPreferences } from './preferences';
import type { TenbisDish } from '../tenbis/types';

const dishes: TenbisDish[] = [
  { id: 'd1', restaurantId: 'r1', restaurantName: 'A', name: 'Chicken Bowl', priceNis: 38, proteinG: 42 },
  { id: 'd2', restaurantId: 'r2', restaurantName: 'B', name: 'Salmon Salad', priceNis: 39, proteinG: 30 },
  { id: 'd3', restaurantId: 'r3', restaurantName: 'C', name: 'Beef Wrap', priceNis: 35, proteinG: 28 },
  { id: 'd4', restaurantId: 'r1', restaurantName: 'A', name: 'Turkey Plate', priceNis: 33, proteinG: 35 },
  { id: 'd5', restaurantId: 'r4', restaurantName: 'D', name: 'Tofu Bowl', priceNis: 30, proteinG: 22 },
  { id: 'd6', restaurantId: 'r5', restaurantName: 'E', name: 'Pricey Steak', priceNis: 120, proteinG: 60 },
];

// A Sunday, so the Sun–Thu default active days map onto consecutive dates.
const sunday = new Date('2026-07-19T08:00:00Z');

describe('weekly plan', () => {
  const prefs = { ...defaultPreferences(), dailyBudgetNis: 40 };

  it('plans one pick per active day', () => {
    const plan = buildWeeklyPlan(dishes, prefs, [], sunday);
    expect(plan.days).toHaveLength(5);
    expect(plan.days.map((d) => d.day)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never repeats a dish within the week', () => {
    const plan = buildWeeklyPlan(dishes, prefs, [], sunday);
    const ids = plan.days.map((d) => d.pick.dish.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('spreads restaurants before reusing one', () => {
    const plan = buildWeeklyPlan(dishes, prefs, [], sunday);
    // 5 days, 4 distinct affordable restaurants -> at least 4 distinct.
    const restaurants = new Set(plan.days.map((d) => d.pick.dish.restaurantId));
    expect(restaurants.size).toBeGreaterThanOrEqual(4);
  });

  it('keeps every day inside the daily budget and sums the total', () => {
    const plan = buildWeeklyPlan(dishes, prefs, [], sunday);
    for (const d of plan.days) expect(d.pick.dish.priceNis).toBeLessThanOrEqual(40);
    expect(plan.totalNis).toBe(plan.days.reduce((s, d) => s + d.pick.dish.priceNis, 0));
  });

  it('is deterministic for the same week', () => {
    const a = buildWeeklyPlan(dishes, prefs, [], sunday);
    const b = buildWeeklyPlan(dishes, prefs, [], sunday);
    expect(a.days.map((d) => d.pick.dish.id)).toEqual(b.days.map((d) => d.pick.dish.id));
  });

  it('upcomingActiveDates respects custom active days', () => {
    const dates = upcomingActiveDates({ ...prefs, activeDays: [1, 3] }, sunday);
    expect(dates.map((d) => d.day)).toEqual([1, 3]);
  });
});
