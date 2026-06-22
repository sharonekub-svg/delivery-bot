import { config } from '../lib/config';
import { getPreferences } from '../lib/repo';
import * as repo from '../lib/repo';
import { executeOrder } from './execOrder';
import * as tpl from '../whatsapp/templates';
import { sendText } from '../whatsapp/twilio';
import type { ScoredDish } from '../domain/recommendation';
import type { Preferences, User } from '../domain/types';

/** Minutes between the 09:00 "intent" message and the actual order. PRD §4.2. */
export const AUTOPILOT_DELAY_MINUTES = 90;

/**
 * Autopilot safety mechanism (PRD §4.2): instead of ordering silently, send an
 * "Intent to Order" now and actually place it after a cancel window, so a user
 * who is sick / out of office can stop it.
 */
export async function scheduleAutopilot(user: User, _prefs: Preferences, picked: ScoredDish, now = new Date()): Promise<void> {
  const executeAt = new Date(now.getTime() + AUTOPILOT_DELAY_MINUTES * 60 * 1000);
  await repo.createOrder({
    userId: user.id,
    dishId: picked.dish.id,
    dishName: picked.dish.name,
    restaurantId: picked.dish.restaurantId,
    restaurantName: picked.dish.restaurantName,
    priceNis: picked.dish.priceNis,
    status: 'autopilot_pending',
    executeAt: executeAt.toISOString(),
  });
  const localTime = executeAt.toLocaleTimeString('en-GB', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit' });
  await sendText(user.whatsappPhone, tpl.autopilotIntent(picked, localTime));
}

/** Called every few minutes by cron: execute autopilot orders whose window passed. */
export async function processDueAutopilotOrders(now = new Date()): Promise<number> {
  const due = await repo.duePendingOrders(now);
  let placed = 0;
  for (const order of due) {
    const user = await repo.getUserById(order.userId);
    if (!user) continue;
    const prefs = await getPreferences(user.id);
    const ok = await executeOrder(user, prefs, order);
    if (ok) placed++;
  }
  return placed;
}
