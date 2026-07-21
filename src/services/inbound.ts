import { config } from '../lib/config';
import * as repo from '../lib/repo';
import { parse, type Intent } from '../whatsapp/parser';
import * as tpl from '../whatsapp/templates';
import { sendText } from '../whatsapp/twilio';
import { executeOrder } from './execOrder';
import { awaitingCode, completeLogin } from './auth';
import { checkBudget } from '../domain/budget';
import { recommend } from '../domain/recommendation';
import { buildWeeklyPlan } from '../domain/weeklyPlan';
import { gatherDishes } from './menu';
import { describeOptions, interpretIntent } from '../lib/claude';
import { getTenbisClient } from '../tenbis';
import type { Preferences, User } from '../domain/types';
import type { TenbisSession } from '../tenbis/types';

/**
 * Handles every inbound WhatsApp message. Resolves the user's intent against
 * their current state (pending order, suggested options, onboarding) and
 * replies. Designed to be idempotent-friendly: re-sending "1" twice won't
 * double-order because the suggested order flips to 'placed'/'awaiting'.
 */
export async function handleInbound(phone: string, text: string): Promise<void> {
  const user = await repo.getOrCreateUser(phone);
  const intent = parse(text);

  // Mid-login: a 4–8 digit reply is the 10Bis SMS code.
  if (/^\d{4,8}$/.test(text.trim()) && (await awaitingCode(user.id))) {
    const ok = await completeLogin(user.id, text.trim());
    await sendText(
      phone,
      ok
        ? '✅ מחוברים ל-10ביס! מעכשיו אפשר להזמין.'
        : '❌ הקוד שגוי או שפג תוקפו. כתבו *העדפות* כדי לנסות שוב.',
    );
    return;
  }

  // First contact / explicit start -> onboarding entry.
  if (!user.onboardingComplete && (intent.kind === 'start' || intent.kind === 'unknown')) {
    if (intent.kind === 'start') {
      await sendText(phone, `בואו נגדיר אותך — פתחו את דף ההעדפות המאובטח: ${config.appBaseUrl}/onboarding?u=${user.id}`);
    } else {
      await sendText(phone, tpl.welcome(config.appBaseUrl));
    }
    return;
  }

  await dispatch(user, phone, intent, /* allowNlFallback */ true);
}

async function dispatch(user: User, phone: string, intent: Intent, allowNlFallback: boolean): Promise<void> {
  const prefs = await repo.getPreferences(user.id);

  switch (intent.kind) {
    case 'choose': {
      // Resolve the chosen option (1-based) against today's offered suggestions.
      const options = await repo.todaysSuggestions(user.id);
      const offered = options[intent.option - 1];
      if (!offered) {
        await sendText(phone, 'האפשרות הזו כבר לא זמינה. השיבו *עוד* לאפשרויות חדשות.');
        return;
      }
      // Retire the other suggestions so a later reply can't double-order.
      for (const o of options) {
        if (o.id !== offered.id) await repo.updateOrder(o.id, { status: 'cancelled' });
      }
      const budget = checkBudget(
        { id: offered.dishId, restaurantId: offered.restaurantId, restaurantName: offered.restaurantName, name: offered.dishName, priceNis: offered.priceNis },
        prefs,
      );
      if (!budget.withinBudget) {
        await repo.updateOrder(offered.id, { status: 'awaiting_confirmation' });
        await sendText(phone, tpl.budgetWarning(budget.overByNis));
        return;
      }
      await executeOrder(user, prefs, offered);
      return;
    }
    case 'approve_budget': {
      const pending = await repo.pendingOrderForUser(user.id);
      if (pending) await executeOrder(user, prefs, pending);
      else await sendText(phone, 'אין כרגע הזמנה שמחכה לאישור. השיבו *עוד* לאפשרויות או *תפריט* לעזרה.');
      return;
    }
    case 'cancel': {
      const pending = await repo.pendingOrderForUser(user.id);
      if (pending) {
        await repo.updateOrder(pending.id, { status: 'cancelled' });
        await sendText(phone, '👍 בוטל — אין הזמנה היום. נתראה ביום העבודה הבא.');
      } else {
        await sendText(phone, 'אין מה לבטל כרגע.');
      }
      return;
    }
    case 'skip':
      await sendText(phone, 'אין בעיה — מדלגים על היום. 🙂');
      return;
    case 'alternative':
      await suggestMore(user, prefs, phone);
      return;
    case 'week_plan':
      await sendWeeklyPlan(user, prefs, phone);
      return;
    case 'stats': {
      const stats = await repo.monthStats(user.id);
      await sendText(phone, tpl.statsMsg(stats.spendNis, stats.count, prefs.dailyBudgetNis));
      return;
    }
    case 'pause':
      await repo.savePreferences(user.id, { ...prefs, paused: true });
      await sendText(phone, tpl.paused());
      return;
    case 'resume':
      await repo.savePreferences(user.id, { ...prefs, paused: false });
      await sendText(phone, tpl.resumed());
      return;
    case 'set_budget': {
      await repo.savePreferences(user.id, { ...prefs, dailyBudgetNis: intent.amountNis, budgetIsManual: true });
      await sendText(phone, tpl.budgetSet(intent.amountNis));
      return;
    }
    case 'add_exclusion': {
      const item = intent.item.trim();
      const exclusions = prefs.exclusions.includes(item) ? prefs.exclusions : [...prefs.exclusions, item];
      await repo.savePreferences(user.id, { ...prefs, exclusions });
      await sendText(phone, tpl.exclusionAdded(item));
      return;
    }
    case 'last_order': {
      const last = await repo.lastOrder(user.id);
      await sendText(
        phone,
        last
          ? `ההזמנה האחרונה שלך: ${last.dishName} מ-${last.restaurantName} (₪${last.priceNis}).${last.trackerDeepLink ? ` ${last.trackerDeepLink}` : ''}`
          : 'עדיין אין הזמנות קודמות.',
      );
      return;
    }
    case 'prefs':
      await sendText(phone, `עריכת ההעדפות שלך כאן: ${config.appBaseUrl}/onboarding?u=${user.id}`);
      return;
    case 'support':
      await sendText(phone, tpl.support());
      return;
    case 'unknown': {
      // Free text: let Claude map it to an intent before giving up on the menu.
      if (allowNlFallback) {
        const interpreted = await interpretIntent(intent.raw);
        if (interpreted && interpreted.kind !== 'unknown') {
          await dispatch(user, phone, interpreted, false);
          return;
        }
      }
      await sendText(phone, tpl.menu(config.appBaseUrl));
      return;
    }
    case 'menu':
    case 'start':
    default:
      await sendText(phone, tpl.menu(config.appBaseUrl));
      return;
  }
}

/** Requires a live 10Bis session; tells the user to re-auth otherwise. */
async function liveSession(user: User, phone: string): Promise<TenbisSession | null> {
  const session = await repo.loadSession(user.id);
  if (!session || !(await getTenbisClient().isSessionValid(session))) {
    await sendText(phone, tpl.sessionExpired(config.appBaseUrl));
    return null;
  }
  return session;
}

/** "עוד" — fresh picks beyond what was already offered today, numbering continued. */
async function suggestMore(user: User, prefs: Preferences, phone: string): Promise<void> {
  if (!prefs.primaryAddressId) {
    await sendText(phone, 'עוד לא הוגדרה כתובת משלוח. השיבו *העדפות* כדי להוסיף אחת.');
    return;
  }
  const session = await liveSession(user, phone);
  if (!session) return;

  const offered = await repo.todaysSuggestions(user.id);
  const offeredIds = new Set(offered.map((o) => o.dishId));
  const startIndex = await repo.todaysOfferedCount(user.id);

  const { dishes } = await gatherDishes(session, prefs.primaryAddressId, prefs);
  const history = await getTenbisClient().getHistory(session, 30).catch(() => []);
  const fresh = recommend(dishes.filter((d) => !offeredIds.has(d.id)), prefs, history);
  if (fresh.length === 0) {
    await sendText(phone, 'לא מצאתי עוד אפשרויות שמתאימות להעדפות ולתקציב כרגע. אפשר להרחיב ב-*העדפות*.');
    return;
  }

  const blurbs = await describeOptions(fresh);
  for (const s of fresh) {
    await repo.createOrder({
      userId: user.id,
      dishId: s.dish.id,
      dishName: s.dish.name,
      categoryId: s.dish.categoryId,
      restaurantId: s.dish.restaurantId,
      restaurantName: s.dish.restaurantName,
      priceNis: s.dish.priceNis,
      status: 'suggested',
    });
  }
  await sendText(phone, tpl.dailyPrompt(blurbs, fresh, startIndex));
}

/** "שבוע" — a budget-aware plan across the user's active days. */
async function sendWeeklyPlan(user: User, prefs: Preferences, phone: string): Promise<void> {
  if (!prefs.primaryAddressId) {
    await sendText(phone, 'עוד לא הוגדרה כתובת משלוח. השיבו *העדפות* כדי להוסיף אחת.');
    return;
  }
  const session = await liveSession(user, phone);
  if (!session) return;

  const { dishes } = await gatherDishes(session, prefs.primaryAddressId, prefs);
  const history = await getTenbisClient().getHistory(session, 90).catch(() => []);
  const plan = buildWeeklyPlan(dishes, prefs, history);
  await sendText(phone, tpl.weeklyPlanMsg(plan));
}
