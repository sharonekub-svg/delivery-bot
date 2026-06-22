// Domain shapes for the 10Bis integration. These are the *contract* the rest of
// the app codes against. The real local API responses get mapped into these in
// src/tenbis/local.ts so nothing else cares what 10Bis actually returns.

export interface TenbisSession {
  /** Opaque token/cookie bundle used to authenticate subsequent calls. */
  token: string;
  /** Unix ms when the token should be treated as expired. */
  expiresAt: number;
}

export interface TenbisAddress {
  id: string;
  label: string; // e.g. "Office - Rothschild 1"
  raw: string;
  lastUsedAt?: string; // ISO
}

export interface TenbisDish {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  description?: string;
  priceNis: number;
  tags?: string[]; // e.g. ["vegan", "high-protein"]
  // Optional nutrition if the API exposes it.
  proteinG?: number;
  caloriesKcal?: number;
  deepLink?: string; // direct link to item page in the app
}

export interface TenbisRestaurant {
  id: string;
  name: string;
  isOpenNow: boolean;
  minOrderNis?: number;
  deliveryEtaMinutes?: number;
}

export interface TenbisOrderResult {
  ok: boolean;
  orderId?: string;
  totalNis?: number;
  etaMinutes?: number;
  trackerDeepLink?: string;
  errorCode?: 'restaurant_closed' | 'out_of_stock' | 'budget_exceeded' | 'session_expired' | 'unknown';
  errorMessage?: string;
}

export interface TenbisHistoryItem {
  dishId: string;
  dishName: string;
  restaurantId: string;
  restaurantName: string;
  priceNis: number;
  orderedAt: string; // ISO
}

export interface TenbisBudget {
  /** Per-employer monthly allowance if exposed. */
  monthlyNis?: number;
  /** Per-day allowance if exposed. */
  dailyNis?: number;
  /** Remaining today, if the API can tell us. */
  remainingTodayNis?: number;
}

export interface PlaceOrderInput {
  dishId: string;
  restaurantId: string;
  addressId: string;
  includeBeverage?: boolean;
  /** Hard ceiling; client must refuse if total exceeds this. */
  maxTotalNis?: number;
}
