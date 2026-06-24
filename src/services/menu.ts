import { getTenbisClient } from '../tenbis';
import { recommend } from '../domain/recommendation';
import type { Preferences } from '../domain/types';
import type { TenbisDish, TenbisSession } from '../tenbis/types';

/**
 * Pull dishes from the live 10Bis menu for an address, then rank them with the
 * recommendation engine against the user's saved profile. Favourite restaurants
 * are checked first; network fan-out is capped so a request stays snappy.
 */
export async function gatherDishes(session: TenbisSession, addressId: string, prefs: Preferences): Promise<TenbisDish[]> {
  const tenbis = getTenbisClient();
  const restaurants = (await tenbis.getRestaurants(session, addressId)).filter((r) => r.isOpenNow);
  const favs = (prefs.favoriteRestaurantNames ?? []).map((s) => s.toLowerCase());
  const ranked = [...restaurants].sort((a, b) => favRank(a.name, favs) - favRank(b.name, favs));

  const dishes: TenbisDish[] = [];
  for (const r of ranked.slice(0, 6)) {
    try {
      dishes.push(...(await tenbis.getAvailableDishes(session, addressId, r.id)));
    } catch {
      /* skip a restaurant whose menu fails to load */
    }
  }
  return dishes;
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
  description?: string;
  deepLink?: string;
}

export async function recommendForUser(session: TenbisSession, addressId: string, prefs: Preferences): Promise<DishOption[]> {
  const dishes = await gatherDishes(session, addressId, prefs);
  const history = await getTenbisClient().getHistory(session, 30).catch(() => []);
  return recommend(dishes, prefs, history).map((s) => ({
    dishId: s.dish.id,
    restaurantId: s.dish.restaurantId,
    categoryId: s.dish.categoryId,
    dishName: s.dish.name,
    restaurantName: s.dish.restaurantName,
    priceNis: s.dish.priceNis,
    proteinG: s.dish.proteinG,
    description: s.dish.description,
    deepLink: s.dish.deepLink,
  }));
}
