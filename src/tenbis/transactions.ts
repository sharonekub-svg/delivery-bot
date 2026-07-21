import type { TenbisHistoryItem } from './types';

/**
 * Pure mapping from a 10Bis transactions-report response to history items.
 * The report is order-level (restaurant + total), and in some shapes carries a
 * per-dish list; we map dishes when present and otherwise fall back to a
 * per-restaurant pseudo-dish so frequency/favourite stats still work
 * ("you order from X a lot" instead of nothing).
 */

/** Parse the date formats 10Bis is known to emit: ISO, .NET "/Date(ms)/", dd/MM/yyyy. */
export function parseTenbisDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? new Date(v).toISOString() : null;
  const s = String(v).trim();
  const dotnet = s.match(/\/Date\((\d+)/);
  if (dotnet) return new Date(Number(dotnet[1])).toISOString();
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const d = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]), 12));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function firstNumber(...vals: unknown[]): number {
  for (const v of vals) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
}

/** Extract the raw order rows from any of the report shapes 10Bis uses. */
function rows(json: any): any[] {
  const d = json?.Data ?? json ?? {};
  if (Array.isArray(d)) return d;
  return d.orderList ?? d.transactions ?? d.orders ?? d.transactionList ?? [];
}

export function mapTransactionsReport(json: unknown): TenbisHistoryItem[] {
  const out: TenbisHistoryItem[] = [];
  for (const t of rows(json)) {
    const restaurantName: string = t.restaurantName ?? t.restaurant?.restaurantName ?? t.resName ?? '';
    if (!restaurantName) continue; // barcode / balance rows have no restaurant
    const restaurantId = String(t.restaurantId ?? t.restaurant?.restaurantId ?? t.resId ?? '');
    const orderedAt = parseTenbisDate(t.orderDateStr ?? t.orderDate ?? t.transactionDate ?? t.date);
    if (!orderedAt) continue;
    const totalNis = firstNumber(t.totalAmount, t.orderTotal, t.transactionAmount, t.sum, t.price, t.amount);

    const dishes: any[] = t.dishList ?? t.dishes ?? t.orderItems ?? [];
    const named = dishes.filter((d) => d?.dishName ?? d?.name);
    if (named.length > 0) {
      for (const d of named) {
        out.push({
          dishId: String(d.dishId ?? d.id ?? `${restaurantId}:${d.dishName ?? d.name}`),
          dishName: d.dishName ?? d.name,
          restaurantId,
          restaurantName,
          priceNis: firstNumber(d.price, d.dishPrice, d.sum) || (named.length === 1 ? totalNis : 0),
          orderedAt,
        });
      }
    } else {
      // Order-level only: group by restaurant so frequency stats stay meaningful.
      out.push({
        dishId: t.dishId != null ? String(t.dishId) : `rest:${restaurantId || restaurantName}`,
        dishName: t.dishName ?? `הזמנה מ${restaurantName}`,
        restaurantId,
        restaurantName,
        priceNis: totalNis,
        orderedAt,
      });
    }
  }
  return out;
}

/** De-dupe (same dish, same timestamp) and keep the window, newest first. */
export function finalizeHistory(items: TenbisHistoryItem[], sinceDays: number, now = new Date()): TenbisHistoryItem[] {
  const cutoff = now.getTime() - sinceDays * 24 * 3600 * 1000;
  const seen = new Set<string>();
  return items
    .filter((h) => new Date(h.orderedAt).getTime() >= cutoff)
    .filter((h) => {
      const key = `${h.dishId}@${h.orderedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1));
}
