import type { TenbisClient } from './client';
import { cookieStringToJar } from '../lib/curlParse';
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
 * ============================================================================
 *  REAL 10Bis CLIENT — implemented from a captured browser session.
 *  See docs/tenbis-api.md. Points marked `VERIFY LIVE` need a real run to
 *  confirm (the capture had cookies stripped, so the session/cookie mechanics
 *  are best-effort until the first live login).
 * ============================================================================
 */

const API = 'https://api.10bis.co.il/api/v1'; // catalog (GET)
const NEXT = 'https://www.10bis.co.il/NextApi'; // account/cart (POST)
const CULTURE = { culture: 'he-IL', uiCulture: 'he' };

/** Everything we persist (encrypted) to act as the user between requests. */
interface SessionState {
  email: string;
  cookies: Record<string, string>;
  /** Bearer token for the catalog host (api.10bis.co.il), when supplied. */
  bearer?: string;
  userToken?: string;
  userId?: number;
  shoppingCartGuid?: string;
}

function parse(session: TenbisSession): SessionState {
  return JSON.parse(session.token) as SessionState;
}

function pack(state: SessionState, ttlMs = 6 * 60 * 60 * 1000): TenbisSession {
  return { token: JSON.stringify(state), expiresAt: Date.now() + ttlMs };
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Merge Set-Cookie headers from a response into the jar. */
function absorbCookies(res: Response, jar: Record<string, string>): void {
  // Node fetch exposes combined set-cookie via getSetCookie() when available.
  const raw: string[] = (res.headers as any).getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
}

class SessionExpired extends Error {
  constructor() {
    super('session_expired');
  }
}

/** POST to NextApi with cookies; absorbs Set-Cookie back into the jar. */
async function postNext<T = any>(path: string, jar: Record<string, string>, body: object): Promise<T> {
  const res = await fetch(`${NEXT}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-app-type': 'mobileWeb',
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ ...CULTURE, ...body }),
  });
  absorbCookies(res, jar);
  if (res.status === 401) throw new SessionExpired();
  if (!res.ok) throw new Error(`10Bis ${path} -> ${res.status}`);
  const json = (await res.json()) as { Success?: boolean; Errors?: unknown[]; Data?: T; ShoppingCartGuid?: string };
  if (json && json.Success === false) {
    throw new Error(`10Bis ${path} failed: ${JSON.stringify(json.Errors ?? [])}`);
  }
  return json as unknown as T;
}

async function getApi<T = any>(path: string, jar: Record<string, string>, bearer?: string): Promise<T> {
  const headers: Record<string, string> = { 'x-app-type': 'mobileWeb', language: 'he', cookie: cookieHeader(jar) };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const res = await fetch(`${API}/${path}`, { headers });
  if (res.status === 401) throw new SessionExpired();
  if (!res.ok) throw new Error(`10Bis ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export class LocalTenbisClient implements TenbisClient {
  // ---- Auth (SMS OTP, two steps) ----

  async requestLoginCode(email: string): Promise<LoginChallenge> {
    const jar: Record<string, string> = {};
    const r: any = await postNext('GetUserAuthenticationDataAndSendAuthenticationCodeToUser_V2', jar, { email });
    // authenticationToken lives under Data (shape varies); grab it defensively.
    const data = r.Data ?? {};
    const authenticationToken =
      data.authenticationToken ?? data.codeAuthenticationData?.authenticationToken ?? data?.authenticationData?.authenticationToken;
    const shoppingCartGuid = r.ShoppingCartGuid ?? data.shoppingCartGuid;
    return { pending: JSON.stringify({ email, authenticationToken, shoppingCartGuid, cookies: jar }) };
  }

  async verifyLoginCode(email: string, code: string, challenge: LoginChallenge): Promise<TenbisSession> {
    const ctx = JSON.parse(challenge.pending) as { authenticationToken: string; shoppingCartGuid: string; cookies: Record<string, string> };
    const jar = { ...ctx.cookies };
    const r: any = await postNext('GetUserV2', jar, {
      shoppingCartGuid: ctx.shoppingCartGuid,
      email,
      authenticationCode: code,
      authenticationToken: ctx.authenticationToken,
    });
    const d = r.Data ?? {};
    return pack({
      email,
      cookies: jar,
      userToken: d.userToken ?? d.sessionToken,
      userId: d.userId,
      shoppingCartGuid: r.ShoppingCartGuid ?? ctx.shoppingCartGuid,
    });
  }

  async sessionFromManualInput(input: ManualCredentials): Promise<TenbisSession> {
    const jar = input.cookie ? cookieStringToJar(input.cookie) : {};
    if (Object.keys(jar).length === 0 && !input.bearer) {
      throw new Error('No cookie or bearer token found in the pasted data.');
    }
    // GetUser both validates the credentials and initialises a shopping cart
    // (returns the user id + ShoppingCartGuid we need to build an order later).
    const r: any = await postNext('GetUser', jar, {});
    const d = r.Data ?? {};
    return pack({
      email: d.email ?? '',
      cookies: jar,
      bearer: input.bearer,
      userToken: d.userToken ?? d.sessionToken,
      userId: d.userId,
      shoppingCartGuid: r.ShoppingCartGuid ?? d.shoppingCartGuid,
    });
  }

  async refreshSession(session: TenbisSession): Promise<TenbisSession> {
    const state = parse(session);
    const res = await fetch(`${API}/Authentication/RefreshToken`, {
      method: 'POST',
      headers: { 'x-app-type': 'mobileWeb', cookie: cookieHeader(state.cookies) },
    });
    if (!res.ok) throw new SessionExpired();
    absorbCookies(res, state.cookies);
    return pack(state);
  }

  async isSessionValid(session: TenbisSession): Promise<boolean> {
    if (session.expiresAt > Date.now()) return true;
    try {
      await this.refreshSession(session);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Reads ----

  async getAddresses(session: TenbisSession): Promise<TenbisAddress[]> {
    const state = parse(session);
    const r: any = await postNext('GetUserAddresses', state.cookies, {});
    const list: any[] = r.Data ?? [];
    return list.map((a) => ({
      id: String(a.addressId),
      label: `${a.streetName ?? ''} ${a.houseNumber ?? ''}, ${a.cityName ?? ''}`.trim(),
      raw: `${a.streetName} ${a.houseNumber}, ${a.cityName}`,
      cityId: a.cityId,
      cityName: a.cityName,
      streetId: a.streetId,
      streetName: a.streetName,
      houseNumber: String(a.houseNumber ?? ''),
      latitude: a.latitude,
      longitude: a.longitude,
      locationType: a.locationType,
    }));
  }

  async getHistory(session: TenbisSession, _sinceDays: number): Promise<TenbisHistoryItem[]> {
    // VERIFY LIVE: confirm the user-transactions endpoint/shape; the capture
    // showed GetLastTransactionWithoutReview but not full history. Empty history
    // is safe (engine just loses the fatigue/frequency signal).
    try {
      const state = parse(session);
      const r: any = await postNext('GetUserTransactionsReport', state.cookies, {});
      const list: any[] = r.Data?.transactions ?? r.Data ?? [];
      return list
        .filter((t) => t.dishName || t.restaurantName)
        .map((t) => ({
          dishId: String(t.dishId ?? ''),
          dishName: t.dishName ?? '',
          restaurantId: String(t.restaurantId ?? ''),
          restaurantName: t.restaurantName ?? '',
          priceNis: Number(t.sum ?? t.price ?? 0),
          orderedAt: t.orderDate ?? t.date ?? new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  async getRestaurants(session: TenbisSession, addressId: string): Promise<TenbisRestaurant[]> {
    // The address coords drive availability; resolve the address first.
    const addr = (await this.getAddresses(session)).find((a) => a.id === addressId);
    const state = parse(session);
    const qs = addr ? `?addressId=${addressId}&longitude=${addr.longitude}&latitude=${addr.latitude}` : `?addressId=${addressId}`;
    const r: any = await getApi(`Restaurants/SearchByAddressId${qs}`, state.cookies, state.bearer).catch(() => ({ Data: [] }));
    const list: any[] = r.Data?.restaurantsList ?? r.Data ?? [];
    return list.map((x) => ({
      id: String(x.restaurantId ?? x.id),
      name: x.restaurantName ?? x.name,
      isOpenNow: x.isOpenNow ?? x.isActive ?? true,
      minOrderNis: x.minimumOrder,
      deliveryEtaMinutes: x.deliveryTimeInMinutes,
    }));
  }

  async getAvailableDishes(session: TenbisSession, addressId: string, restaurantId?: string): Promise<TenbisDish[]> {
    if (!restaurantId) {
      // Aggregate across open restaurants would be many calls; callers pass a
      // restaurantId in practice. Keep it simple and return empty otherwise.
      return [];
    }
    const state = parse(session);
    const dateTime = new Date().toISOString().slice(0, 16);
    const r: any = await getApi(`Restaurants/${restaurantId}/Menu?addressId=${addressId}&dateTime=${dateTime}`, state.cookies, state.bearer);
    const data = r.Data ?? r;
    const categories: any[] = data.categories ?? [];
    const out: TenbisDish[] = [];
    for (const cat of categories) {
      for (const dish of cat.dishes ?? []) {
        out.push({
          id: String(dish.id),
          restaurantId: String(restaurantId),
          restaurantName: data.restaurantName ?? '',
          categoryId: String(cat.id),
          name: dish.name,
          description: dish.description,
          priceNis: Number(dish.price),
          tags: dish.hasGreenSymbol ? ['healthy'] : [],
          deepLink: `https://www.10bis.co.il/next/restaurants/menu/delivery/${restaurantId}`,
        });
      }
    }
    return out;
  }

  async getBudget(session: TenbisSession): Promise<TenbisBudget> {
    // VERIFY LIVE: the daily allowance lives on the user's Moneycard; the exact
    // field isn't certain from the capture. Returning {} lets preferences drive
    // the daily budget instead.
    void session;
    return {};
  }

  // ---- Order ----

  async placeOrder(session: TenbisSession, input: PlaceOrderInput): Promise<TenbisOrderResult> {
    const state = parse(session);
    const jar = state.cookies;
    const guid = state.shoppingCartGuid;
    if (!guid) return { ok: false, errorCode: 'unknown', errorMessage: 'no shopping cart' };

    try {
      const addr = (await this.getAddresses(session)).find((a) => a.id === input.addressId);
      if (!addr) return { ok: false, errorCode: 'unknown', errorMessage: 'address not found' };

      await postNext('SetAddressInOrder', jar, {
        shoppingCartGuid: guid,
        locationType: addr.locationType ?? 'residential',
        addressKey: `${addr.cityId}-${addr.streetId}-${addr.houseNumber}`,
        cityName: addr.cityName,
        streetName: addr.streetName,
        houseNumber: addr.houseNumber,
        latitude: addr.latitude,
        longitude: addr.longitude,
        cityId: addr.cityId,
        streetId: addr.streetId,
        isBigCity: true,
      });
      await postNext('SetDeliveryMethodInOrder', jar, { shoppingCartGuid: guid, deliveryMethod: 'delivery' });
      await postNext('SetRestaurantInOrder', jar, {
        shoppingCartGuid: guid,
        isMobileDevice: false,
        restaurantId: Number(input.restaurantId),
        deliveryRuleType: 'Asap',
      });
      await postNext('SetDishListInShoppingCart', jar, {
        shoppingCartGuid: guid,
        dishList: [
          {
            dishId: Number(input.dishId),
            shoppingCartDishId: 1,
            quantity: 1,
            assignedUserId: state.userId,
            choices: [],
            dishNotes: null,
            categoryId: input.categoryId ? Number(input.categoryId) : undefined,
          },
        ],
      });
      await postNext('ChooseAndSetBestDiscountCouponValueInOrder', jar, { shoppingCartGuid: guid, includeUserCoupons: false });

      // Payment: the 10Bis Moneycard (company allowance). VERIFY LIVE: source of
      // cardId — likely from GetPayments after the restaurant is set.
      const payR: any = await postNext('GetPayments', jar, { shoppingCartGuid: guid }).catch(() => ({ Data: [] }));
      const card = (payR.Data ?? []).find((p: any) => p.paymentMethod === 'Moneycard') ?? (payR.Data ?? [])[0];
      if (card) {
        const sum = card.sum ?? undefined;
        if (input.maxTotalNis != null && typeof sum === 'number' && sum > input.maxTotalNis) {
          return { ok: false, errorCode: 'budget_exceeded', errorMessage: `Total ${sum} over budget ${input.maxTotalNis}` };
        }
        await postNext('SetPaymentsInOrder', jar, {
          shoppingCartGuid: guid,
          payments: [{ ...card, assigned: true }],
        });
      }

      const submit: any = await postNext('SubmitOrder', jar, {
        shoppingCartGuid: guid,
        isMobileDevice: false,
        dontWantCutlery: false,
        orderRemarks: '',
      });
      const od = submit.Data?.orderData ?? {};
      // Persist any refreshed cookies/guid back is the caller's job (we mutated jar in place).
      return {
        ok: true,
        orderId: String(od.orderId ?? submit.Data?.orderId ?? ''),
        totalNis: od.shoppingCart?.totalAmount,
        trackerDeepLink: 'https://www.10bis.co.il/next/user-transactions',
      };
    } catch (err) {
      if (err instanceof SessionExpired) return { ok: false, errorCode: 'session_expired' };
      return { ok: false, errorCode: 'unknown', errorMessage: (err as Error).message };
    }
  }
}
