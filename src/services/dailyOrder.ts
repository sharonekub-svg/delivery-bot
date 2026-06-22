import { recommend, type ScoredDish } from '../domain/recommendation';
import { isActiveDay } from '../domain/preferences';
import { config } from '../lib/config';
import { describeOptions } from '../lib/claude';
import { getPreferences, loadSession, getUserByPhone } from '../lib/repo';
import * as repo from '../lib/repo';
import { getTenbisClient } from '../tenbis';
import * as tpl from '../whatsapp/templates';
import { sendProactive, sendText } from '../whatsapp/twilio';
import { scheduleAutopilot } from './autopilot';
import type { User } from '../domain/types';

/**
 * Runs at the user's trigger time on active days. Builds recommendations and
 * either asks the user to choose (ask mode) or schedules an autopilot order
 * with a cancel window (autopilot mode).
 */
export async function runDailyForUser(user: User, now = new Date()): Promise<void> {
  const prefs = await getPreferences(user.id);
  if (!user.onboardingComplete) return;
  if (!isActiveDay(prefs, now, config.timezone)) return;
  if (!prefs.primaryAddressId) return;

  const session = await loadSession(user.id);
  if (!session) {
    await sendText(user.whatsappPhone, tpl.sessionExpired(config.appBaseUrl));
    return;
  }

  const tenbis = getTenbisClient();
  if (!(await tenbis.isSessionValid(session))) {
    await sendText(user.whatsappPhone, tpl.sessionExpired(config.appBaseUrl));
    return;
  }

  const [dishes, history] = await Promise.all([
    tenbis.getAvailableDishes(session, prefs.primaryAddressId),
    tenbis.getHistory(session, 90),
  ]);

  const picked = recommend(dishes, prefs, history, now);
  if (picked.length === 0) {
    await sendText(user.whatsappPhone, "I couldn't find anything matching your preferences and budget right now. Reply *PREFS* to adjust.");
    return;
  }

  if (prefs.mode === 'autopilot') {
    await scheduleAutopilot(user, prefs, picked[0], now);
    return;
  }

  await sendAskPrompt(user, picked);
}

async function sendAskPrompt(user: User, picked: ScoredDish[]): Promise<void> {
  const blurbs = await describeOptions(picked);
  // Persist the offered options so a reply of "1"/"2" can be resolved later.
  for (let i = 0; i < picked.length; i++) {
    await repo.createOrder({
      userId: user.id,
      dishId: picked[i].dish.id,
      dishName: picked[i].dish.name,
      categoryId: picked[i].dish.categoryId,
      restaurantId: picked[i].dish.restaurantId,
      restaurantName: picked[i].dish.restaurantName,
      priceNis: picked[i].dish.priceNis,
      status: 'suggested',
    });
  }
  await sendProactive(user.whatsappPhone, tpl.dailyPrompt(blurbs, picked));
}

export async function runDailyForPhone(phone: string): Promise<void> {
  const user = await getUserByPhone(phone);
  if (user) await runDailyForUser(user);
}
