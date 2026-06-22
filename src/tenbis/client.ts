import type {
  PlaceOrderInput,
  TenbisAddress,
  TenbisBudget,
  TenbisDish,
  TenbisHistoryItem,
  TenbisOrderResult,
  TenbisRestaurant,
  TenbisSession,
} from './types';

/**
 * The single seam between this app and 10Bis.
 *
 * Two implementations exist:
 *  - MockTenbisClient (src/tenbis/mock.ts)  — deterministic fake data, used until
 *    the real API is wired and for tests.
 *  - LocalTenbisClient (src/tenbis/local.ts) — wraps the user's *local* 10Bis API.
 *
 * Picked at runtime via TENBIS_CLIENT env var (see src/tenbis/index.ts).
 */
export interface TenbisClient {
  /** Authenticate. Throws on bad credentials. */
  login(credentials: { username: string; password: string }): Promise<TenbisSession>;

  /** Cheap call to verify a token is still valid. */
  isSessionValid(session: TenbisSession): Promise<boolean>;

  getAddresses(session: TenbisSession): Promise<TenbisAddress[]>;

  /** Recent order history; used to derive favourites and the fatigue filter. */
  getHistory(session: TenbisSession, sinceDays: number): Promise<TenbisHistoryItem[]>;

  /** Restaurants currently deliverable to the given address. */
  getRestaurants(session: TenbisSession, addressId: string): Promise<TenbisRestaurant[]>;

  /** Dishes available right now for the given address (optionally one restaurant). */
  getAvailableDishes(
    session: TenbisSession,
    addressId: string,
    restaurantId?: string,
  ): Promise<TenbisDish[]>;

  getBudget(session: TenbisSession): Promise<TenbisBudget>;

  placeOrder(session: TenbisSession, input: PlaceOrderInput): Promise<TenbisOrderResult>;
}
