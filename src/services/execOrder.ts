import { config } from '../lib/config';
import { loadSession } from '../lib/repo';
import * as repo from '../lib/repo';
import { getTenbisClient } from '../tenbis';
import * as tpl from '../whatsapp/templates';
import { sendText } from '../whatsapp/twilio';
import type { OrderRecord, Preferences, User } from '../domain/types';

const FAIL_REASONS: Record<string, string> = {
  restaurant_closed: 'the restaurant is closed',
  out_of_stock: 'the item is out of stock',
  budget_exceeded: 'it exceeds your daily budget',
  session_expired: 'your 10Bis session expired',
  unknown: 'an unknown error occurred',
};

/**
 * Places a single order on 10Bis and notifies the user. Centralises budget
 * enforcement (hard ceiling = daily budget) and session-expiry handling so
 * both the interactive and autopilot paths behave identically.
 */
export async function executeOrder(user: User, prefs: Preferences, order: OrderRecord): Promise<boolean> {
  const session = await loadSession(user.id);
  if (!session) {
    await sendText(user.whatsappPhone, tpl.sessionExpired(config.appBaseUrl));
    await repo.updateOrder(order.id, { status: 'failed' });
    return false;
  }

  const tenbis = getTenbisClient();
  if (!(await tenbis.isSessionValid(session))) {
    await sendText(user.whatsappPhone, tpl.sessionExpired(config.appBaseUrl));
    await repo.updateOrder(order.id, { status: 'failed' });
    return false;
  }

  if (!prefs.primaryAddressId) {
    await sendText(user.whatsappPhone, 'No delivery address set. Reply *PREFS* to add one.');
    return false;
  }

  const result = await tenbis.placeOrder(session, {
    dishId: order.dishId,
    restaurantId: order.restaurantId,
    addressId: prefs.primaryAddressId,
    includeBeverage: prefs.includeBeverage,
    maxTotalNis: prefs.dailyBudgetNis,
  });

  if (!result.ok) {
    await repo.updateOrder(order.id, { status: 'failed' });
    if (result.errorCode === 'session_expired') {
      await sendText(user.whatsappPhone, tpl.sessionExpired(config.appBaseUrl));
    } else {
      await sendText(user.whatsappPhone, tpl.orderFailure(FAIL_REASONS[result.errorCode ?? 'unknown']));
    }
    return false;
  }

  await repo.updateOrder(order.id, {
    status: 'placed',
    tenbisOrderId: result.orderId,
    trackerDeepLink: result.trackerDeepLink,
  });
  await sendText(user.whatsappPhone, tpl.orderSuccess({ ...order, trackerDeepLink: result.trackerDeepLink }, result.etaMinutes));
  return true;
}
