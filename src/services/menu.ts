import { getTenbisClient } from '../tenbis';
import { recommend, passesHardFilters } from '../domain/recommendation';
import { topDishPerRestaurant } from '../domain/history';
import type { Preferences } from '../domain/types';
import type { TenbisDish, TenbisSession } from '../tenbis/types';

/**
 * Pull dishes from the live 10Bis menu for an address, then rank them with the
 * recommendation engine against the user's saved profile. Favourite restaurants
 * are checked first; network fan-out is capped so a request stays snappy.
 */
export interface GatheredMenu {
  dishes: TenbisDish[];
  /** restaurantId -> approximate delivery time in minutes. */
  etaByRestaurant: Record<string, number | undefined>;
}

export async function gatherDishes(session: TenbisSession, addressId: string, prefs: Preferences): Promise<GatheredMenu> {
  const tenbis = getTenbisClient();
  const restaurants = (await tenbis.getRestaurants(session, addressId)).filter((r) => r.isOpenNow);
  const favs = (prefs.favoriteRestaurantNames ?? []).map((s) => s.toLowerCase());
  const ranked = [...restaurants].sort((a, b) => favRank(a.name, favs) - favRank(b.name, favs));

  const dishes: TenbisDish[] = [];
  const etaByRestaurant: Record<string, number | undefined> = {};
  for (const r of ranked.slice(0, 6)) {
    etaByRestaurant[r.id] = r.deliveryEtaMinutes;
    try {
      dishes.push(...(await tenbis.getAvailableDishes(session, addressId, r.id)));
    } catch {
      /* skip a restaurant whose menu fails to load */
    }
  }
  return { dishes, etaByRestaurant };
}

function favRank(name: string, favs: string[]): number {
  const n = name.toLowerCase();
  return favs.some((f) => n.includes(f) || f.includes(n)) ? 0 : 1;
}

export interface DishOption {
  dishId: string;
  restaurantId: string;
  categoryId?: string;
  dishName: string;
  restaurantName: string;
  priceNis: number;
  proteinG?: number;
  caloriesKcal?: number;
  description?: string;
  deepLink?: string;
  /** Approximate delivery time in minutes for this dish's restaurant. */
  etaMinutes?: number;
  /** 10Bis signals surfaced to the UI so the user sees everything 10Bis knows. */
  popular?: boolean;
  isGreen?: boolean;
  healthWarnings?: ('sugar' | 'sodium' | 'fat')[];
  imageUrl?: string;
  /** When the pick comes from order history: how many times it was ordered. */
  historyCount?: number;
}

/** What to base today's options on: the user's goals, or their order history. */
export type RecommendBasis = 'goal' | 'history';

function toOption(dish: TenbisDish, etaByRestaurant: Record<string, number | undefined>): DishOption {
  return {
    dishId: dish.id,
    restaurantId: dish.restaurantId,
    categoryId: dish.categoryId,
    dishName: dish.name,
    restaurantName: dish.restaurantName,
    priceNis: dish.priceNis,
    proteinG: dish.proteinG,
    caloriesKcal: dish.caloriesKcal,
    description: dish.description,
    deepLink: dish.deepLink,
    etaMinutes: etaByRestaurant[dish.restaurantId],
    popular: dish.popular,
    isGreen: dish.isGreen,
    healthWarnings: dish.healthWarnings,
    imageUrl: dish.imageUrl,
  };
}

/** Craving keyword → words we look for in a dish name / description / restaurant. */
const CRAVINGS: Record<string, string[]> = {
  sushi: ['סושי', 'sushi', 'poke', 'פוקה', 'אסיאת', 'asian', 'maki', 'ניגירי', 'sashimi'],
  burger: ['המבורגר', 'בורגר', 'burger', 'צ׳יזבורגר'],
  pizza: ['פיצה', 'pizza', 'קלצונה', 'focaccia', 'פוקצ'],
  salad: ['סלט', 'salad', 'bowl', 'קערה', 'greens', 'ירק'],
  meat: ['בשר', 'סטייק', 'steak', 'grill', 'גריל', 'שיפוד', 'אנטריקוט', 'meat'],
};

function matchesCraving(dish: TenbisDish, words: string[]): boolean {
  const hay = `${dish.name} ${dish.description ?? ''} ${dish.restaurantName} ${(dish.tags ?? []).join(' ')}`.toLowerCase();
  return words.some((w) => hay.includes(w.toLowerCase()));
}

export interface RecommendOptions {
  craving?: string;
  /** 'goal' (default) ranks the menu by nutrition/budget; 'history' surfaces the
   *  dishes you order most, one per restaurant, that are orderable today. */
  basis?: RecommendBasis;
}

export async function recommendForUser(
  session: TenbisSession,
  addressId: string,
  prefs: Preferences,
  opts: RecommendOptions = {},
): Promise<DishOption[]> {
  if (opts.basis === 'history') {
    const fromHistory = await historyOptions(session, addressId, prefs);
    if (fromHistory.length > 0) return fromHistory; // else fall back to goal-based
  }

  const { dishes: all, etaByRestaurant } = await gatherDishes(session, addressId, prefs);
  let dishes = all;
  const words = opts.craving ? CRAVINGS[opts.craving] : undefined;
  if (words) {
    const filtered = dishes.filter((d) => matchesCraving(d, words));
    if (filtered.length > 0) dishes = filtered; // fall back to everything if no match
  }
  const history = await getTenbisClient().getHistory(session, 30).catch(() => []);
  return recommend(dishes, prefs, history).map((s) => toOption(s.dish, etaByRestaurant));
}

/**
 * "Order from my previous orders." Takes the most-ordered dish in each restaurant
 * from the last 90 days and matches it against today's live menu so it's actually
 * orderable. If the exact dish is off today, we fall back to that restaurant's top
 * available dish — keeping the variety (one pick per restaurant).
 */
async function historyOptions(session: TenbisSession, addressId: string, prefs: Preferences): Promise<DishOption[]> {
  const history = await getTenbisClient().getHistory(session, 90).catch(() => []);
  if (history.length === 0) return [];

  // Prioritise loading the menus of the restaurants we actually order from.
  const historyRestaurants = [...new Set(history.map((h) => h.restaurantName))];
  const prefsForGather: Preferences = {
    ...prefs,
    favoriteRestaurantNames: [...historyRestaurants, ...(prefs.favoriteRestaurantNames ?? [])],
  };
  const { dishes, etaByRestaurant } = await gatherDishes(session, addressId, prefsForGather);

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const byRestaurant = new Map<string, TenbisDish[]>();
  for (const d of dishes) {
    const key = d.restaurantName.toLowerCase();
    const arr = byRestaurant.get(key);
    if (arr) arr.push(d);
    else byRestaurant.set(key, [d]);
  }

  const out: DishOption[] = [];
  const seenRestaurants = new Set<string>();
  for (const top of topDishPerRestaurant(history, 8)) {
    let dish = byId.get(top.dishId);
    if (dish && !passesHardFilters(dish, prefs)) dish = undefined;
    if (!dish) {
      // Exact dish unavailable today — use this restaurant's first orderable dish.
      dish = (byRestaurant.get(top.restaurantName.toLowerCase()) ?? []).find((d) => passesHardFilters(d, prefs));
    }
    if (!dish || seenRestaurants.has(dish.restaurantId)) continue;
    seenRestaurants.add(dish.restaurantId);
    out.push({ ...toOption(dish, etaByRestaurant), historyCount: top.count });
    if (out.length >= Math.max(prefs.optionCount, 3)) break;
  }
  return out;
}
