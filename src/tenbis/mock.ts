import type { TenbisClient } from './client';
import type {
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

const DAY = 24 * 60 * 60 * 1000;

const DISHES: TenbisDish[] = [
  { id: 'd1', restaurantId: 'r1', restaurantName: 'Greens & Co', name: 'Grilled Chicken Quinoa Bowl', description: 'Grilled chicken breast, quinoa, roasted veg.', priceNis: 52, tags: ['high-protein', 'popular', 'healthy'], proteinG: 41, caloriesKcal: 610, popular: true, isGreen: true, deepLink: 'https://example/d1' },
  { id: 'd2', restaurantId: 'r1', restaurantName: 'Greens & Co', name: 'Mediterranean Salmon Salad', description: 'Salmon, mixed greens, tahini.', priceNis: 58, tags: ['high-protein', 'omega3', 'healthy'], proteinG: 34, caloriesKcal: 540, isGreen: true, deepLink: 'https://example/d2' },
  { id: 'd3', restaurantId: 'r2', restaurantName: 'Pita Bar', name: 'Chicken Shawarma Plate', description: 'Shawarma, salad, hummus.', priceNis: 49, tags: ['high-protein', 'popular'], proteinG: 38, caloriesKcal: 720, popular: true, healthWarnings: ['sodium', 'fat'], deepLink: 'https://example/d3' },
  { id: 'd4', restaurantId: 'r3', restaurantName: 'Tokyo Express', name: 'Salmon Poke Bowl', description: 'Salmon, rice, edamame, avocado.', priceNis: 56, tags: ['high-protein'], proteinG: 30, caloriesKcal: 580, deepLink: 'https://example/d4' },
  { id: 'd5', restaurantId: 'r2', restaurantName: 'Pita Bar', name: 'Falafel Pita', description: 'Falafel, salad, tahini.', priceNis: 38, tags: ['vegan'], proteinG: 16, caloriesKcal: 650, healthWarnings: ['sugar'], deepLink: 'https://example/d5' },
];

/** Deterministic fake 10Bis used for tests and until live verification. */
export class MockTenbisClient implements TenbisClient {
  async requestLoginCode(): Promise<{ pending: string }> {
    return { pending: JSON.stringify({ mock: true }) };
  }

  async verifyLoginCode(): Promise<TenbisSession> {
    return { token: 'mock-token', expiresAt: Date.now() + 7 * DAY };
  }

  async sessionFromManualInput(): Promise<TenbisSession> {
    // Any non-empty paste "connects" in mock mode so the web flow is testable
    // without a real 10Bis account.
    return { token: 'mock-token', expiresAt: Date.now() + 7 * DAY };
  }

  async refreshSession(): Promise<TenbisSession> {
    return { token: 'mock-token', expiresAt: Date.now() + 7 * DAY };
  }

  async isSessionValid(session: TenbisSession): Promise<boolean> {
    return session.token === 'mock-token' && session.expiresAt > Date.now();
  }

  async getAddresses(): Promise<TenbisAddress[]> {
    return [
      { id: 'a1', label: 'Office - Rothschild 1', raw: 'Rothschild Blvd 1, Tel Aviv', lastUsedAt: new Date().toISOString() },
      { id: 'a2', label: 'Home', raw: 'Dizengoff 100, Tel Aviv' },
    ];
  }

  async getHistory(_session: TenbisSession, sinceDays: number): Promise<TenbisHistoryItem[]> {
    const now = Date.now();
    const out: TenbisHistoryItem[] = [];
    // Chicken bowl ordered often, shawarma occasionally.
    for (let i = 1; i <= Math.min(sinceDays, 60); i += 3) {
      out.push({ dishId: 'd1', dishName: 'Grilled Chicken Quinoa Bowl', restaurantId: 'r1', restaurantName: 'Greens & Co', priceNis: 52, orderedAt: new Date(now - i * DAY).toISOString() });
    }
    out.push({ dishId: 'd3', dishName: 'Chicken Shawarma Plate', restaurantId: 'r2', restaurantName: 'Pita Bar', priceNis: 49, orderedAt: new Date(now - 5 * DAY).toISOString() });
    return out;
  }

  async getUserProfile(): Promise<TenbisUserProfile> {
    return { firstName: 'Dana', lastName: 'Cohen', email: 'dana@example.com', companyName: 'Acme Ltd', companyId: 1234 };
  }

  async getCoupons(): Promise<TenbisCoupon[]> {
    return [
      { code: 'LUNCH10', description: '₪10 הנחה על הזמנה מעל ₪45', amountNis: 10 },
      { code: 'NEWWEEK', description: '15% הנחה ביום ראשון', percent: 15 },
    ];
  }

  async getRestaurants(): Promise<TenbisRestaurant[]> {
    return [
      { id: 'r1', name: 'Greens & Co', isOpenNow: true, deliveryEtaMinutes: 35, minOrderNis: 45, deliveryFeeNis: 0, pickupAvailable: true, pooledOrderAvailable: true, scheduledDeliveryAvailable: true, isKosher: true },
      { id: 'r2', name: 'Pita Bar', isOpenNow: true, deliveryEtaMinutes: 25, minOrderNis: 40, deliveryFeeNis: 5, pickupAvailable: true, isKosher: true },
      { id: 'r3', name: 'Tokyo Express', isOpenNow: true, deliveryEtaMinutes: 40, minOrderNis: 60, deliveryFeeNis: 12, scheduledDeliveryAvailable: true },
    ];
  }

  async getAvailableDishes(_session: TenbisSession, _addressId: string, restaurantId?: string): Promise<TenbisDish[]> {
    return restaurantId ? DISHES.filter((d) => d.restaurantId === restaurantId) : DISHES;
  }

  async getBudget(): Promise<TenbisBudget> {
    return { monthlyNis: 880, dailyNis: 40, remainingTodayNis: 40 };
  }

  async placeOrder(_session: TenbisSession, input: PlaceOrderInput): Promise<TenbisOrderResult> {
    const dish = DISHES.find((d) => d.id === input.dishId);
    if (!dish) return { ok: false, errorCode: 'out_of_stock', errorMessage: 'Dish not found' };
    // A coupon shaves ₪10 off when coupons are enabled and the order qualifies.
    const discountNis = input.useCoupons && dish.priceNis >= 45 ? 10 : 0;
    const totalNis = dish.priceNis - discountNis;
    if (input.maxTotalNis != null && totalNis > input.maxTotalNis) {
      return { ok: false, errorCode: 'budget_exceeded', errorMessage: `Over budget by ${totalNis - input.maxTotalNis} NIS` };
    }
    return {
      ok: true,
      orderId: `mock-${Date.now()}`,
      totalNis,
      discountNis: discountNis || undefined,
      etaMinutes: input.pickup ? 15 : 35,
      trackerDeepLink: 'https://example/track/mock',
    };
  }
}
