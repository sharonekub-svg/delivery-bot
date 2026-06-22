import type { TenbisClient } from './client';
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
 * ============================================================================
 *  REAL 10Bis LOCAL API CLIENT  —  FILL THIS IN WITH THE PROVIDED API
 * ============================================================================
 *
 * Everything else in the app already codes against the TenbisClient interface,
 * so wiring the real API is localised to this one file. For each method below:
 *   1. Build the request to your local API (base URL from TENBIS_API_BASE_URL).
 *   2. Map the response into the shared shapes from ./types.
 *
 * What I need from you to complete each method is noted inline as `// NEED:`.
 *
 * Token handling: login() must return an opaque `token` (cookie string, bearer,
 * or JSON blob — anything) plus a best-effort `expiresAt`. The rest of the app
 * treats it as opaque and re-auths when isSessionValid() returns false.
 */

const BASE = process.env.TENBIS_API_BASE_URL ?? '';

async function call<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) };
  if (init?.token) headers['authorization'] = init.token; // NEED: confirm auth header/cookie scheme
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 || res.status === 419) {
    const e = new Error('session_expired');
    (e as any).code = 'session_expired';
    throw e;
  }
  if (!res.ok) throw new Error(`10Bis ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export class LocalTenbisClient implements TenbisClient {
  async login(_credentials: { username: string; password: string }): Promise<TenbisSession> {
    // NEED: login endpoint + payload shape + where the token/cookie comes back.
    throw new Error('LocalTenbisClient.login not implemented — provide the 10Bis local API.');
  }

  async isSessionValid(_session: TenbisSession): Promise<boolean> {
    // NEED: a cheap authenticated endpoint (e.g. profile) to ping.
    throw new Error('LocalTenbisClient.isSessionValid not implemented.');
  }

  async getAddresses(_session: TenbisSession): Promise<TenbisAddress[]> {
    // NEED: addresses endpoint + response shape.
    throw new Error('LocalTenbisClient.getAddresses not implemented.');
  }

  async getHistory(_session: TenbisSession, _sinceDays: number): Promise<TenbisHistoryItem[]> {
    // NEED: order-history endpoint + response shape.
    throw new Error('LocalTenbisClient.getHistory not implemented.');
  }

  async getRestaurants(_session: TenbisSession, _addressId: string): Promise<TenbisRestaurant[]> {
    // NEED: restaurants-for-address endpoint + how "open now" is represented.
    throw new Error('LocalTenbisClient.getRestaurants not implemented.');
  }

  async getAvailableDishes(_session: TenbisSession, _addressId: string, _restaurantId?: string): Promise<TenbisDish[]> {
    // NEED: menu endpoint + price/nutrition fields if available.
    throw new Error('LocalTenbisClient.getAvailableDishes not implemented.');
  }

  async getBudget(_session: TenbisSession): Promise<TenbisBudget> {
    // NEED: whether the API exposes monthly/daily budget. If not, we compute it
    // from preferences (monthly / working days).
    throw new Error('LocalTenbisClient.getBudget not implemented.');
  }

  async placeOrder(_session: TenbisSession, _input: PlaceOrderInput): Promise<TenbisOrderResult> {
    // NEED: the order-submission endpoint + payload (cart build, address, submit).
    // Map known failures to errorCode: restaurant_closed | out_of_stock |
    // budget_exceeded | session_expired.
    throw new Error('LocalTenbisClient.placeOrder not implemented.');
  }

  // Keep a reference so `call`/`BASE` aren't flagged unused before wiring.
  protected readonly _call = call;
  protected readonly _base = BASE;
}
