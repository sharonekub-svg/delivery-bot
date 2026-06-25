import { describe, expect, it } from 'vitest';
import { normalizeHistory, findTransactionArray, toIso, extractMonthlyLimit } from './normalize';

describe('toIso', () => {
  it('parses ASP.NET /Date(ms)/', () => {
    expect(toIso('/Date(1780000000000)/')).toBe(new Date(1780000000000).toISOString());
  });
  it('parses Israeli dd/MM/yyyy', () => {
    expect(toIso('01/06/2026').slice(0, 10)).toBe('2026-06-01');
  });
  it('passes through ISO', () => {
    expect(toIso('2026-06-01T12:00:00Z')).toBe(new Date('2026-06-01T12:00:00Z').toISOString());
  });
  it('treats epoch seconds as ms*1000', () => {
    expect(toIso(1780000000)).toBe(new Date(1780000000000).toISOString());
  });
});

describe('findTransactionArray', () => {
  it('digs the transactions array out from under wrapper keys', () => {
    const payload = { Success: true, Data: { report: { orderList: [{ restaurantName: 'A', orderDate: '2026-06-01' }] } } };
    expect(findTransactionArray(payload)).toHaveLength(1);
  });
  it('ignores unrelated arrays', () => {
    const payload = { Data: { banners: [{ url: 'x' }, { url: 'y' }], transactions: [{ restaurantName: 'A', date: '2026-06-01' }] } };
    expect(findTransactionArray(payload)[0].restaurantName).toBe('A');
  });
});

describe('extractMonthlyLimit', () => {
  it('finds a top-level monthlyLimit', () => {
    expect(extractMonthlyLimit({ Data: { monthlyLimit: 1000, used: 240 } })).toBe(1000);
  });
  it('finds a nested PascalCase MonthlyAmountLimit', () => {
    expect(extractMonthlyLimit({ Data: { report: { budget: { MonthlyAmountLimit: '880' } } } })).toBe(880);
  });
  it('returns undefined when absent', () => {
    expect(extractMonthlyLimit({ Data: { dailyLimit: 40 } })).toBeUndefined();
  });
});

describe('normalizeHistory', () => {
  it('reads a flat, dish-level camelCase shape', () => {
    const payload = { Data: { transactions: [
      { restaurantName: 'Pita Bar', restaurantId: 5, orderDate: '2026-06-01T12:00:00Z', dishName: 'Shawarma', dishId: 9, price: 49 },
    ] } };
    const out = normalizeHistory(payload);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dishId: '9', dishName: 'Shawarma', restaurantName: 'Pita Bar', priceNis: 49 });
  });

  it('expands a nested order→dishes PascalCase shape with /Date/', () => {
    const payload = { Data: { orderList: [
      { RestaurantName: 'Greens', RestaurantId: '3', OrderDate: '/Date(1780000000000)/', SumToCharge: 104,
        Dishes: [ { DishName: 'Bowl', DishId: 1, Price: 52 }, { DishName: 'Salad', DishId: 2, Price: 52 } ] },
    ] } };
    const out = normalizeHistory(payload);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.dishName)).toEqual(['Bowl', 'Salad']);
    expect(out[0].restaurantName).toBe('Greens');
    expect(out[0].priceNis).toBe(52);
  });

  it('falls back to restaurant-level when no dish detail exists', () => {
    const payload = { Data: [
      { restaurantName: 'Tokyo Express', restaurantId: 7, transactionDate: '01/06/2026', sumToCharge: 56 },
    ] };
    const out = normalizeHistory(payload);
    expect(out).toHaveLength(1);
    // Restaurant used as the "dish" so favourites still group by restaurant.
    expect(out[0]).toMatchObject({ dishId: 'r7', dishName: 'Tokyo Express', restaurantName: 'Tokyo Express', priceNis: 56 });
  });

  it('returns nothing for an empty/foreign payload', () => {
    expect(normalizeHistory({ Data: { somethingElse: true } })).toEqual([]);
    expect(normalizeHistory(null)).toEqual([]);
  });
});
