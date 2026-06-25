import type { TenbisClient } from './client';
import { cookieStringToJar } from '../lib/curlParse';
import { normalizeHistory, extractMonthlyLimit } from './normalize';
import type {
  LoginChallenge,
  ManualCredentials,
  PlaceOrderInput,
  TenbisAddress,
  TenbisBudget,
  TenbisCoupon,
  TenbisDish,
  TenbisHistoryItem,
  TenbisOrderResult,
  TenbisRestaurant,
  TenbisSession,
  TenbisUserProfile,
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

/** Coerce a possibly-missing API number; returns undefined for null/NaN. */
function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
      throw new Error('לא נמצאה עוגייה בהדבקה. ודאו שהעתקתם בקשת NextApi (למשל GetUser) כ-cURL.');
    }
    // Validate the credentials and grab the user id + ShoppingCartGuid for later.
    // GetUser is the ideal validator, but if it's unavailable on this account we
    // accept any authenticated NextApi call so a good cookie still connects.
    let d: any = {};
    let guid: string | undefined;
    let ok = false;
    let lastErr = '';
    for (const ep of ['GetUser', 'GetUserAddresses']) {
      try {
        const r: any = await postNext(ep, jar, {});
        if (Array.isArray(r.Data)) {
          guid = r.ShoppingCartGuid ?? guid;
        } else {
          d = r.Data ?? d;
          guid = r.ShoppingCartGuid ?? d.shoppingCartGuid ?? guid;
        }
        ok = true;
        break;
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }
    if (!ok) throw new Error(lastErr || 'אימות מול 10bis נכשל.');

    // Many accounts no longer expose a separate catalog bearer — the cookie
    // authenticates the catalog host too. When the user didn't paste a token,
    // bootstrap catalog access from the cookie (best-effort, time-boxed).
    const bearer = input.bearer ?? (await this.bootstrapCatalogToken(jar));

    return pack({
      email: d.email ?? '',
      cookies: jar,
      bearer,
      userToken: d.userToken ?? d.sessionToken,
      userId: d.userId,
      shoppingCartGuid: guid,
    });
  }

  /** Try to obtain catalog auth from the cookie alone. Never throws, time-boxed. */
  private async bootstrapCatalogToken(jar: Record<string, string>): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API}/Authentication/RefreshToken`, {
        method: 'POST',
        headers: { 'x-app-type': 'mobileWeb', cookie: cookieHeader(jar) },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      absorbCookies(res, jar); // refreshed cookies may themselves authenticate the catalog
      if (!res.ok) return undefined;
      const j: any = await res.json().catch(() => null);
      return j?.Data?.token ?? j?.Data?.accessToken ?? j?.token ?? j?.accessToken ?? undefined;
    } catch {
      return undefined;
    }
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

  async getUserProfile(session: TenbisSession): Promise<TenbisUserProfile> {
    // GetUser returns the signed-in user's details (and re-inits the cart).
    try {
      const state = parse(session);
      const r: any = await postNext('GetUser', state.cookies, {});
      const d = r.Data ?? {};
      return {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        companyName: d.companyName ?? d.company?.companyName,
        companyId: numOrUndef(d.companyId),
      };
    } catch {
      return {};
    }
  }

  async getCoupons(session: TenbisSession): Promise<TenbisCoupon[]> {
    // VERIFY LIVE: coupon endpoint/shape isn't certain from the capture; we try
    // GetUserCoupons and map defensively, returning [] if it isn't there.
    try {
      const state = parse(session);
      const r: any = await postNext('GetUserCoupons', state.cookies, {});
      const list: any[] = r.Data?.coupons ?? r.Data ?? [];
      return list
        .map((c) => ({
          code: c.couponCode ?? c.code,
          description: c.description ?? c.title ?? c.couponDescription ?? '',
          amountNis: numOrUndef(c.amount ?? c.discountAmount),
          percent: numOrUndef(c.percent ?? c.discountPercent),
        }))
        .filter((c) => c.description || c.code);
    } catch {
      return [];
    }
  }

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

  async getHistory(session: TenbisSession, sinceDays: number): Promise<TenbisHistoryItem[]> {
    // 10Bis exposes past orders through a "transactions report" endpoint, but the
    // exact name + response shape vary. Rather than hard-code one guess, we try a
    // few known endpoint names and run each response through the defensive
    // normaliser (src/tenbis/normalize.ts), which copes with order-level vs
    // dish-level data, Pascal/camel field names and `/Date(ms)/` dates. The first
    // endpoint that yields any orders wins; empty history is always safe.
    const state = parse(session);
    const now = new Date();
    const from = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);
    // Generous, redundant date fields so an endpoint that requires a range is happy.
    const range = {
      startDate: from.toISOString(),
      endDate: now.toISOString(),
      fromDate: from.toISOString(),
      toDate: now.toISOString(),
      dateBias: 0,
    };
    const endpoints = [
      'GetUserTransactionsReport',
      'UserTransactionsReport',
      'GetUserOrdersHistory',
      'GetOrdersHistory',
      'GetUserReport',
    ];
    for (const ep of endpoints) {
      try {
        const r: any = await postNext(ep, state.cookies, range);
        const items = normalizeHistory(r);
        if (items.length > 0) return items;
      } catch {
        /* try the next candidate endpoint */
      }
    }
    return [];
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
      minOrderNis: numOrUndef(x.minimumOrder ?? x.minimumPriceForOrder),
      deliveryEtaMinutes: numOrUndef(x.deliveryTimeInMinutes ?? x.estimatedDeliveryTime),
      deliveryFeeNis: numOrUndef(x.deliveryPrice ?? x.deliveryFee),
      pickupAvailable: x.isPickupAvailable ?? x.pickupEnabled,
      pooledOrderAvailable: x.isPooledOrderRestaurant ?? x.pooledOrder,
      scheduledDeliveryAvailable: x.isFutureOrderAvailable ?? x.futureOrderAvailable,
      isKosher: x.isKosher,
      logoUrl: x.restaurantLogoUrl ?? x.logoUrl,
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
        const warnings: ('sugar' | 'sodium' | 'fat')[] = [];
        if (dish.hasHighSugar) warnings.push('sugar');
        if (dish.hasHighSodium) warnings.push('sodium');
        if (dish.hasHighSaturatedFat) warnings.push('fat');
        const tags: string[] = [];
        if (dish.hasGreenSymbol) tags.push('healthy');
        if (dish.popular) tags.push('popular');
        out.push({
          id: String(dish.id),
          restaurantId: String(restaurantId),
          restaurantName: data.restaurantName ?? '',
          categoryId: String(cat.id),
          name: dish.name,
          description: dish.description,
          priceNis: Number(dish.price),
          tags,
          proteinG: numOrUndef(dish.proteinG ?? dish.protein),
          caloriesKcal: numOrUndef(dish.calories ?? dish.caloriesKcal),
          popular: !!dish.popular,
          isGreen: !!dish.hasGreenSymbol,
          healthWarnings: warnings.length ? warnings : undefined,
          imageUrl: dish.imageUrl,
          deepLink: `https://www.10bis.co.il/next/restaurants/menu/delivery/${restaurantId}`,
        });
      }
    }
    return out;
  }

  async getBudget(session: TenbisSession): Promise<TenbisBudget> {
    // Two sources: the daily allowance lives on the Moneycard (GetPayments); the
    // employer's *monthly limit* lives in the billing/transactions report. Read
    // both defensively and merge; fall back to {} when nothing is exposed.
    const state = parse(session);
    const out: TenbisBudget = {};

    // Daily allowance / remaining-today from the Moneycard.
    try {
      const r: any = await postNext('GetPayments', state.cookies, { shoppingCartGuid: state.shoppingCartGuid });
      const payments: any[] = r.Data?.payments ?? r.Data ?? [];
      const card =
        payments.find((p) => p.paymentMethod === 'Moneycard') ??
        payments.find((p) => p.isMoneycard || p.companyId) ??
        payments[0];
      if (card) {
        out.monthlyNis = numOrUndef(card.monthlyMaxAmount ?? card.monthlyLimit ?? card.monthlyBudget);
        out.dailyNis = numOrUndef(card.dailyMaxAmount ?? card.dailyLimit ?? card.maxAmount ?? card.dailyBudget);
        out.remainingTodayNis = numOrUndef(card.balance ?? card.remainingAmount ?? card.sum ?? card.availableAmount);
      }
    } catch {
      /* no payments info — fine */
    }

    // The employer-set monthly allowance usually lives right on the user profile
    // (GetUser) — the user "set" it when they joined the company on 10Bis.
    if (out.monthlyNis == null) {
      try {
        const r: any = await postNext('GetUser', state.cookies, {});
        const monthly = extractMonthlyLimit(r);
        if (monthly != null) out.monthlyNis = monthly;
      } catch {
        /* fall through to the report */
      }
    }

    // Last resort: the billing/transactions report.
    if (out.monthlyNis == null) {
      for (const ep of ['GetUserTransactionsReport', 'UserTransactionsReport', 'GetUserReport', 'GetBillingReport']) {
        try {
          const r: any = await postNext(ep, state.cookies, {});
          const monthly = extractMonthlyLimit(r);
          if (monthly != null) { out.monthlyNis = monthly; break; }
        } catch {
          /* try the next candidate */
        }
      }
    }

    return out;
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
      await postNext('SetDeliveryMethodInOrder', jar, {
        shoppingCartGuid: guid,
        deliveryMethod: input.pickup ? 'takeaway' : 'delivery',
      });
      await postNext('SetRestaurantInOrder', jar, {
        shoppingCartGuid: guid,
        isMobileDevice: false,
        restaurantId: Number(input.restaurantId),
        // A future delivery time schedules the order; otherwise it's ASAP.
        deliveryRuleType: input.deliverAt ? 'Future' : 'Asap',
        ...(input.deliverAt ? { orderDeliveryTime: input.deliverAt } : {}),
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
      const couponR: any = await postNext('ChooseAndSetBestDiscountCouponValueInOrder', jar, {
        shoppingCartGuid: guid,
        includeUserCoupons: input.useCoupons ?? false,
      }).catch(() => ({}));
      const discountNis = numOrUndef(couponR.Data?.discountAmount ?? couponR.Data?.couponValue);

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
        dontWantCutlery: input.dontWantCutlery ?? false,
        orderRemarks: input.orderRemarks ?? '',
      });
      const od = submit.Data?.orderData ?? {};
      // Persist any refreshed cookies/guid back is the caller's job (we mutated jar in place).
      return {
        ok: true,
        orderId: String(od.orderId ?? submit.Data?.orderId ?? ''),
        totalNis: od.shoppingCart?.totalAmount,
        discountNis,
        trackerDeepLink: 'https://www.10bis.co.il/next/user-transactions',
      };
    } catch (err) {
      if (err instanceof SessionExpired) return { ok: false, errorCode: 'session_expired' };
      return { ok: false, errorCode: 'unknown', errorMessage: (err as Error).message };
    }
  }
}
