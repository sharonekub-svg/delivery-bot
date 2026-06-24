// Core app domain. Mirrors the Supabase schema in supabase/migrations.

export type PlanningHorizon = 'daily' | 'weekly';
export type RecommendationMode = 'ask' | 'autopilot';

/** The 11 preference attributes from the PRD (§3.2). */
export interface Preferences {
  // 1. Nutritional target
  weeklyProteinTargetG?: number;
  macroFocus?: 'balanced' | 'high_protein' | 'low_carb';
  // 2. Allergens / important ingredients
  exclusions: string[]; // e.g. ["gluten", "nuts"]
  inclusions: string[];
  // 3. Beverage
  includeBeverage: boolean;
  // 4. Favourite dishes (derived from history, manually overridable)
  favoriteDishIds: string[];
  favoritesRefreshedAt?: string; // ISO; re-derive every ~3 months
  /** Restaurant/dish names the user calls out in chat — biases recommendations. */
  favoriteRestaurantNames?: string[];
  // 5. Daily budget (NIS)
  dailyBudgetNis: number;
  budgetIsManual: boolean;
  // 6. Active days (0=Sun..6=Sat). Default Sun–Thu.
  activeDays: number[];
  // 7. Planning horizon
  planningHorizon: PlanningHorizon;
  // 8. Daily trigger time (local HH:mm)
  triggerTime: string;
  // 9. Recommendation variety + autopilot
  optionCount: number;
  mode: RecommendationMode;
  // 10. Delivery address
  primaryAddressId?: string;
}

export interface User {
  id: string;
  whatsappPhone: string; // E.164, primary unique ID
  displayName?: string;
  onboardingComplete: boolean;
  createdAt: string;
}

export type OrderStatus =
  | 'suggested'
  | 'awaiting_confirmation'
  | 'autopilot_pending'
  | 'placed'
  | 'failed'
  | 'cancelled';

export interface OrderRecord {
  id: string;
  userId: string;
  dishId: string;
  dishName: string;
  categoryId?: string;
  restaurantId: string;
  restaurantName: string;
  priceNis: number;
  status: OrderStatus;
  tenbisOrderId?: string;
  trackerDeepLink?: string;
  /** For autopilot: when the cancel window closes and we actually order. */
  executeAt?: string;
  createdAt: string;
}
