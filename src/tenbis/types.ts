// Domain shapes for the 10Bis integration. These are the *contract* the rest of
// the app codes against. The real local API responses get mapped into these in
// src/tenbis/local.ts so nothing else cares what 10Bis actually returns.

export interface TenbisSession {
  /** Opaque token/cookie bundle used to authenticate subsequent calls. */
  token: string;
  /** Unix ms when the token should be treated as expired. */
  expiresAt: number;
}

/** Opaque context returned by requestLoginCode, passed back to verifyLoginCode. */
export interface LoginChallenge {
  /** Serialized {authenticationToken, shoppingCartGuid, cookies}. */
  pending: string;
}

/** Credentials lifted from the browser (DevTools) for the web connect flow. */
export interface ManualCredentials {
  /** Raw `Cookie:` header value — drives the stateful NextApi calls. */
  cookie?: string;
  /** Bearer token from the `Authorization:` header — drives catalog reads. */
  bearer?: string;
}

export interface TenbisAddress {
  id: string;
  label: string; // e.g. "Office - Rothschild 1"
  raw: string;
  lastUsedAt?: string; // ISO
  // Fields needed to rebuild SetAddressInOrder.
  cityId?: number;
  cityName?: string;
  streetId?: number;
  streetName?: string;
  houseNumber?: string;
  latitude?: number;
  longitude?: number;
  locationType?: string;
}

export interface TenbisDish {
  id: string;
  restaurantId: string;
  restaurantName: string;
  /** Menu category id — needed when adding the dish to the cart. */
  categoryId?: string;
  name: string;
  description?: string;
  priceNis: number;
  tags?: string[]; // e.g. ["vegan", "high-protein"]
  // Optional nutrition if the API exposes it.
  proteinG?: number;
  caloriesKcal?: number;
  /** 10Bis flags a frequently-ordered dish as popular. */
  popular?: boolean;
  /** 10Bis "green symbol" — flagged by the chain as a healthier choice. */
  isGreen?: boolean;
  /** Israeli mandatory front-of-pack warnings 10Bis exposes per dish. */
  healthWarnings?: ('sugar' | 'sodium' | 'fat')[];
  imageUrl?: string;
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
  /** Menu category the dish belongs to (required by SetDishListInShoppingCart). */
  categoryId?: string;
  includeBeverage?: boolean;
  /** Hard ceiling; client must refuse if total exceeds this. */
  maxTotalNis?: number;
}
