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

const DAY = 24 * 60 * 60 * 1000;

const DISHES: TenbisDish[] = [
  { id: 'd1', restaurantId: 'r1', restaurantName: 'Greens & Co', name: 'Grilled Chicken Quinoa Bowl', description: 'Grilled chicken breast, quinoa, roasted veg.', priceNis: 52, tags: ['high-protein'], proteinG: 41, caloriesKcal: 610, deepLink: 'https://example/d1' },
  { id: 'd2', restaurantId: 'r1', restaurantName: 'Greens & Co', name: 'Mediterranean Salmon Salad', description: 'Salmon, mixed greens, tahini.', priceNis: 58, tags: ['high-protein', 'omega3'], proteinG: 34, caloriesKcal: 540, deepLink: 'https://example/d2' },
  { id: 'd3', restaurantId: 'r2', restaurantName: 'Pita Bar', name: 'Chicken Shawarma Plate', description: 'Shawarma, salad, hummus.', priceNis: 49, tags: ['high-protein'], proteinG: 38, caloriesKcal: 720, deepLink: 'https://example/d3' },
  { id: 'd4', restaurantId: 'r3', restaurantName: 'Tokyo Express', name: 'Salmon Poke Bowl', description: 'Salmon, rice, edamame, avocado.', priceNis: 56, tags: ['high-protein'], proteinG: 30, caloriesKcal: 580, deepLink: 'https://example/d4' },
  { id: 'd5', restaurantId: 'r2', restaurantName: 'Pita Bar', name: 'Falafel Pita', description: 'Falafel, salad, tahini.', priceNis: 38, tags: ['vegan'], proteinG: 16, caloriesKcal: 650, deepLink: 'https://example/d5' },
];

/** Deterministic fake 10Bis used for tests and until live verification. */
export class MockTenbisClient implements TenbisClient {
  async requestLoginCode(): Promise<{ pending: string }> {
    return { pending: JSON.stringify({ mock: true }) };
  }

  async verifyLoginCode(): Promise<TenbisSession> {
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

  async getRestaurants(): Promise<TenbisRestaurant[]> {
    return [
      { id: 'r1', name: 'Greens & Co', isOpenNow: true, deliveryEtaMinutes: 35 },
      { id: 'r2', name: 'Pita Bar', isOpenNow: true, deliveryEtaMinutes: 25 },
      { id: 'r3', name: 'Tokyo Express', isOpenNow: true, deliveryEtaMinutes: 40 },
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
    if (input.maxTotalNis != null && dish.priceNis > input.maxTotalNis) {
      return { ok: false, errorCode: 'budget_exceeded', errorMessage: `Over budget by ${dish.priceNis - input.maxTotalNis} NIS` };
    }
    return {
      ok: true,
      orderId: `mock-${Date.now()}`,
      totalNis: dish.priceNis,
      etaMinutes: 35,
      trackerDeepLink: 'https://example/track/mock',
    };
  }
}
