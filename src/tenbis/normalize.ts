import type { TenbisHistoryItem } from './types';

/**
 * Turn whatever 10Bis's order-history endpoint returns into our flat
 * TenbisHistoryItem[]. The live API shape varies (order-level vs dish-level,
 * Hebrew/Pascal/camel field names, `/Date(ms)/` vs ISO dates, the array buried
 * under different keys), so this is deliberately defensive: it hunts for the
 * transactions array anywhere in the payload and reads each field by trying a
 * list of aliases. No network, fully unit-tested.
 */

type Json = any;

const FIELDS = {
  restaurantName: ['restaurantName', 'RestaurantName', 'barName', 'BarName', 'restaurant', 'Restaurant'],
  restaurantId: ['restaurantId', 'RestaurantId', 'restaurantNumber', 'RestaurantNumber'],
  date: ['orderDate', 'OrderDate', 'transactionDate', 'TransactionDate', 'date', 'Date', 'orderDateStr', 'dateStr', 'purchaseDate'],
  amount: ['sumToCharge', 'SumToCharge', 'totalAmount', 'TotalAmount', 'totalPrice', 'orderTotal', 'sum', 'Sum', 'amount', 'Amount', 'price', 'Price'],
  dishName: ['dishName', 'DishName', 'name', 'Name', 'productName'],
  dishId: ['dishId', 'DishId', 'id', 'Id', 'productId'],
  dishes: ['dishes', 'Dishes', 'orderItems', 'OrderItems', 'items', 'Items', 'dishList', 'DishList', 'orderedDishes'],
} as const;

function pick(obj: Json, names: readonly string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const n of names) {
    const v = obj[n];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Parse 10Bis's many date encodings into an ISO string. */
export function toIso(v: unknown): string {
  if (v == null) return new Date().toISOString();
  if (typeof v === 'number') {
    return new Date(v > 1e12 ? v : v * 1000).toISOString();
  }
  const s = String(v);
  // ASP.NET "/Date(1693526400000)/"
  const aspNet = /\/Date\((\d+)/.exec(s);
  if (aspNet) return new Date(Number(aspNet[1])).toISOString();
  // dd/MM/yyyy (Israeli) — disambiguate from ISO by the slash form.
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    const iso = new Date(Number(year), Number(m) - 1, Number(d));
    if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function looksLikeTransaction(o: Json): boolean {
  return !!o && typeof o === 'object' && (pick(o, FIELDS.restaurantName) != null || pick(o, FIELDS.date) != null);
}

/**
 * Find the array of transactions/orders anywhere in the payload. Scores every
 * array by how many of its elements look like a transaction and returns the
 * best one (ties broken by length).
 */
export function findTransactionArray(root: Json, maxDepth = 5): Json[] {
  let best: Json[] = [];
  let bestScore = 0;
  function visit(node: Json, depth: number) {
    if (depth > maxDepth || node == null) return;
    if (Array.isArray(node)) {
      const score = node.filter(looksLikeTransaction).length;
      if (score > bestScore || (score === bestScore && node.length > best.length)) {
        if (score > 0) { best = node; bestScore = score; }
      }
      // Arrays can still contain nested arrays (rare) — peek one level.
      for (const el of node) if (el && typeof el === 'object') visit(el, depth + 2);
      return;
    }
    if (typeof node === 'object') {
      for (const k of Object.keys(node)) visit(node[k], depth + 1);
    }
  }
  visit(root, 0);
  return best;
}

const MONTHLY_LIMIT_KEYS = [
  'monthlyLimit', 'MonthlyLimit', 'monthlyAmountLimit', 'MonthlyAmountLimit',
  'companyMonthlyLimit', 'monthlyBudget', 'monthlyMaxAmount', 'maxMonthlyAmount',
  'monthlyAllowance', 'monthlyTotalLimit', 'creditLimit',
];

/**
 * Pull the employer's monthly limit out of a billing/transactions report,
 * wherever 10Bis nests it. Returns the first positive number found under any of
 * the known "monthly limit" field names.
 */
export function extractMonthlyLimit(payload: Json): number | undefined {
  return findNumberByKeys(payload, MONTHLY_LIMIT_KEYS);
}

function findNumberByKeys(root: Json, keys: readonly string[], maxDepth = 6): number | undefined {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  let found: number | undefined;
  function visit(node: Json, depth: number) {
    if (found != null || depth > maxDepth || node == null || typeof node !== 'object') return;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (wanted.has(k.toLowerCase())) {
        const n = num(v);
        if (n > 0) { found = n; return; }
      }
      if (v && typeof v === 'object') visit(v, depth + 1);
    }
  }
  visit(root, 0);
  return found;
}

export function normalizeHistory(payload: Json): TenbisHistoryItem[] {
  const txns = findTransactionArray(payload);
  const out: TenbisHistoryItem[] = [];

  for (const t of txns) {
    const restaurantName = String(pick(t, FIELDS.restaurantName) ?? '').trim();
    const restaurantId = String(pick(t, FIELDS.restaurantId) ?? '');
    const orderedAt = toIso(pick(t, FIELDS.date));
    const orderAmount = num(pick(t, FIELDS.amount));

    const dishes = pick(t, FIELDS.dishes);
    if (Array.isArray(dishes) && dishes.length > 0) {
      // Dish-level detail available: one history row per dish.
      for (const d of dishes) {
        const dishName = String(pick(d, FIELDS.dishName) ?? '').trim();
        const dishId = String(pick(d, FIELDS.dishId) ?? '') || `r${restaurantId}:${dishName}`;
        out.push({
          dishId,
          dishName: dishName || restaurantName,
          restaurantId,
          restaurantName,
          priceNis: num(pick(d, FIELDS.amount)) || orderAmount,
          orderedAt,
        });
      }
      continue;
    }

    // Order-level only (restaurant + amount + date). Use the restaurant as the
    // "dish" so frequency/favourites still work per restaurant.
    const dishName = String(pick(t, FIELDS.dishName) ?? '').trim();
    const dishId = String(pick(t, FIELDS.dishId) ?? '') || `r${restaurantId}`;
    if (!restaurantName && !dishName) continue;
    out.push({
      dishId,
      dishName: dishName || restaurantName,
      restaurantId,
      restaurantName,
      priceNis: orderAmount,
      orderedAt,
    });
  }
  return out;
}
