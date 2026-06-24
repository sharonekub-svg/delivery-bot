import type {
  LoginChallenge,
  ManualCredentials,
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
 *  - MockTenbisClient (src/tenbis/mock.ts)  — deterministic fake data, used for
 *    tests and until live verification.
 *  - LocalTenbisClient (src/tenbis/local.ts) — wraps the real 10Bis API.
 *
 * Picked at runtime via TENBIS_CLIENT env var (see src/tenbis/index.ts).
 *
 * Auth is SMS one-time-code, so login is two steps + a refresh that avoids
 * re-prompting for a code on every session expiry.
 */
export interface TenbisClient {
  /** Step 1: trigger an SMS code to the account phone for the given email. */
  requestLoginCode(email: string): Promise<LoginChallenge>;

  /** Step 2: verify the SMS code; returns an authenticated session. */
  verifyLoginCode(email: string, code: string, challenge: LoginChallenge): Promise<TenbisSession>;

  /**
   * Web flow: build a session directly from credentials the user copied out of
   * their browser DevTools (the `cookie` header and/or `authorization` bearer
   * token). Validates them against 10Bis and throws if they don't work.
   */
  sessionFromManualInput(input: ManualCredentials): Promise<TenbisSession>;

  /** Refresh an expiring session without a new SMS code. Throws if it can't. */
  refreshSession(session: TenbisSession): Promise<TenbisSession>;

  /** Cheap call to verify a session is still valid. */
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
