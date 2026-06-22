import { describe, expect, it } from 'vitest';
import { recommend, scoreDish } from './recommendation';
import { defaultPreferences } from './preferences';
import type { TenbisDish, TenbisHistoryItem } from '../tenbis/types';

const dishes: TenbisDish[] = [
  { id: 'd1', restaurantId: 'r1', restaurantName: 'A', name: 'Chicken Bowl', priceNis: 38, proteinG: 42, tags: ['high-protein'] },
  { id: 'd2', restaurantId: 'r2', restaurantName: 'B', name: 'Salmon Salad', priceNis: 39, proteinG: 30 },
  { id: 'd3', restaurantId: 'r3', restaurantName: 'C', name: 'Nut Brownie', priceNis: 20, proteinG: 4, tags: ['nuts'] },
  { id: 'd4', restaurantId: 'r4', restaurantName: 'D', name: 'Pricey Steak', priceNis: 120, proteinG: 60 },
];

describe('recommendation engine', () => {
  const prefs = { ...defaultPreferences(), dailyBudgetNis: 40, optionCount: 2 };

  it('excludes over-budget dishes', () => {
    const out = recommend(dishes, prefs, []);
    expect(out.find((s) => s.dish.id === 'd4')).toBeUndefined();
  });

  it('respects allergen exclusions', () => {
    const out = recommend(dishes, { ...prefs, exclusions: ['nuts'] }, []);
    expect(out.find((s) => s.dish.id === 'd3')).toBeUndefined();
  });

  it('returns optionCount items', () => {
    expect(recommend(dishes, prefs, [])).toHaveLength(2);
  });

  it('does not recommend a dish ordered today (fatigue filter)', () => {
    const history: TenbisHistoryItem[] = [
      { dishId: 'd1', dishName: 'Chicken Bowl', restaurantId: 'r1', restaurantName: 'A', priceNis: 38, orderedAt: new Date().toISOString() },
    ];
    const out = recommend(dishes, prefs, history);
    expect(out.find((s) => s.dish.id === 'd1')).toBeUndefined();
  });

  it('scores high-protein within-budget dishes well', () => {
    const s = scoreDish(dishes[0], prefs, [], new Date());
    expect(s.score).toBeGreaterThan(0.3);
  });
});
