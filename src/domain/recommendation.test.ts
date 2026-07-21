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

  it('explains picks with Hebrew reasons', () => {
    const s = scoreDish(dishes[0], prefs, [], new Date());
    expect(s.reasons.join(' ')).toContain('חלבון');
  });

  it('boosts dishes matching stated likes', () => {
    const plain = scoreDish(dishes[1], prefs, [], new Date());
    const liked = scoreDish(dishes[1], { ...prefs, inclusions: ['salmon'] }, [], new Date());
    expect(liked.breakdown.taste).toBeGreaterThan(plain.breakdown.taste);
  });

  it('boosts favourite restaurants', () => {
    const liked = scoreDish(dishes[1], { ...prefs, favoriteRestaurantNames: ['B'] }, [], new Date());
    const other = scoreDish(dishes[0], { ...prefs, favoriteRestaurantNames: ['B'] }, [], new Date());
    expect(liked.breakdown.taste).toBeGreaterThan(other.breakdown.taste);
  });

  it('rewards green-badged dishes and penalises health warnings', () => {
    const green: typeof dishes[0] = { ...dishes[0], id: 'g', isGreen: true };
    const warned: typeof dishes[0] = { ...dishes[0], id: 'w', healthWarnings: ['sodium', 'fat'] };
    const gs = scoreDish(green, prefs, [], new Date());
    const ws = scoreDish(warned, prefs, [], new Date());
    expect(gs.breakdown.health).toBeGreaterThan(ws.breakdown.health);
  });

  it('daily variety is deterministic within a day but shifts across days', () => {
    const today = new Date('2026-07-20T10:00:00Z');
    const tomorrow = new Date('2026-07-21T10:00:00Z');
    const a = scoreDish(dishes[0], prefs, [], today);
    const b = scoreDish(dishes[0], prefs, [], today);
    const c = scoreDish(dishes[0], prefs, [], tomorrow);
    expect(a.breakdown.variety).toBe(b.breakdown.variety);
    expect(a.breakdown.variety).not.toBe(c.breakdown.variety);
  });

  it('calorie-aware low-carb scoring prefers lighter dishes', () => {
    const light: typeof dishes[0] = { ...dishes[0], id: 'l', caloriesKcal: 450 };
    const heavy: typeof dishes[0] = { ...dishes[0], id: 'h', caloriesKcal: 1100 };
    const lowCarb = { ...prefs, macroFocus: 'low_carb' as const };
    const ls = scoreDish(light, lowCarb, [], new Date());
    const hs = scoreDish(heavy, lowCarb, [], new Date());
    expect(ls.breakdown.macro).toBeGreaterThan(hs.breakdown.macro);
  });
});
