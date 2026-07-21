import { describe, expect, it } from 'vitest';
import { finalizeHistory, mapTransactionsReport, parseTenbisDate } from './transactions';

describe('parseTenbisDate', () => {
  it('parses ISO, .NET and dd/MM/yyyy dates', () => {
    expect(parseTenbisDate('2026-07-01T10:00:00Z')).toBe('2026-07-01T10:00:00.000Z');
    expect(parseTenbisDate('/Date(1751364000000)/')).toBe(new Date(1751364000000).toISOString());
    expect(parseTenbisDate('15/06/2026')).toBe('2026-06-15T12:00:00.000Z');
    expect(parseTenbisDate(null)).toBeNull();
    expect(parseTenbisDate('not a date')).toBeNull();
  });
});

describe('mapTransactionsReport', () => {
  it('maps the orderList shape with per-dish data', () => {
    const out = mapTransactionsReport({
      Data: {
        orderList: [
          {
            restaurantId: 123,
            restaurantName: 'Greens',
            orderDateStr: '01/07/2026',
            totalAmount: 52,
            dishList: [{ dishId: 9, dishName: 'Chicken Bowl', price: 52 }],
          },
        ],
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dishId: '9', dishName: 'Chicken Bowl', restaurantName: 'Greens', priceNis: 52 });
  });

  it('falls back to a per-restaurant pseudo-dish when only order totals exist', () => {
    const out = mapTransactionsReport({
      Data: {
        orderList: [
          { restaurantId: 5, restaurantName: 'Pita Bar', orderDate: '/Date(1751364000000)/', totalAmount: 45 },
          { restaurantId: 5, restaurantName: 'Pita Bar', orderDate: '/Date(1751450400000)/', totalAmount: 47 },
        ],
      },
    });
    expect(out).toHaveLength(2);
    // Same pseudo-dish id -> frequency stats can count "orders from Pita Bar".
    expect(out[0].dishId).toBe(out[1].dishId);
    expect(out[0].dishName).toContain('Pita Bar');
  });

  it('skips rows without a restaurant (barcode / balance rows) and bad dates', () => {
    const out = mapTransactionsReport({
      Data: { orderList: [{ transactionAmount: 30 }, { restaurantName: 'X', orderDate: 'garbage' }] },
    });
    expect(out).toHaveLength(0);
  });

  it('accepts transactions/orders key variants and top-level arrays', () => {
    expect(mapTransactionsReport({ Data: { transactions: [{ restaurantName: 'A', date: '2026-07-01', sum: 30 }] } })).toHaveLength(1);
    expect(mapTransactionsReport({ Data: [{ restaurantName: 'B', date: '2026-07-01', price: 20 }] })).toHaveLength(1);
  });
});

describe('finalizeHistory', () => {
  const now = new Date('2026-07-21T12:00:00Z');
  const item = (id: string, daysAgo: number) => ({
    dishId: id,
    dishName: id,
    restaurantId: 'r',
    restaurantName: 'R',
    priceNis: 30,
    orderedAt: new Date(now.getTime() - daysAgo * 24 * 3600 * 1000).toISOString(),
  });

  it('filters by window, de-dupes and sorts newest first', () => {
    const out = finalizeHistory([item('a', 40), item('b', 2), item('b', 2), item('c', 5)], 30, now);
    expect(out.map((h) => h.dishId)).toEqual(['b', 'c']);
  });
});
