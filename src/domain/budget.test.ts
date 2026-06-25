import { describe, expect, it } from 'vitest';
import { checkMonthlyBudget } from './budget';

describe('checkMonthlyBudget', () => {
  it('allows an order that fits under the monthly limit', () => {
    // 1000 limit, 800 spent → 200 left; a 49 order fits.
    expect(checkMonthlyBudget(1000, 800, 49)).toEqual({ withinBudget: true, remainingNis: 200, overByNis: 0 });
  });

  it('blocks an order that would exceed the monthly limit', () => {
    // 1000 limit, 980 spent → 20 left; a 49 order is 29 over.
    expect(checkMonthlyBudget(1000, 980, 49)).toEqual({ withinBudget: false, remainingNis: 20, overByNis: 29 });
  });

  it('blocks once the limit is already used up', () => {
    expect(checkMonthlyBudget(1000, 1000, 30).withinBudget).toBe(false);
  });

  it('does not enforce when the monthly limit is unknown', () => {
    expect(checkMonthlyBudget(undefined, 5000, 99)).toMatchObject({ withinBudget: true, overByNis: 0 });
  });
});
