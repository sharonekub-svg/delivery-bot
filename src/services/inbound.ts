import { config } from '../lib/config';
import * as repo from '../lib/repo';
import { parse } from '../whatsapp/parser';
import * as tpl from '../whatsapp/templates';
import { sendText } from '../whatsapp/twilio';
import { executeOrder } from './execOrder';
import { checkBudget } from '../domain/budget';

/**
 * Handles every inbound WhatsApp message. Resolves the user's intent against
 * their current state (pending order, suggested options, onboarding) and
 * replies. Designed to be idempotent-friendly: re-sending "1" twice won't
 * double-order because the suggested order flips to 'placed'/'awaiting'.
 */
export async function handleInbound(phone: string, text: string): Promise<void> {
  const user = await repo.getOrCreateUser(phone);
  const intent = parse(text);

  // First contact / explicit start -> onboarding entry.
  if (!user.onboardingComplete && (intent.kind === 'start' || intent.kind === 'unknown')) {
    if (intent.kind === 'start') {
      await sendText(phone, `Let's set you up — open your secure preferences page: ${config.appBaseUrl}/onboarding?u=${user.id}`);
    } else {
      await sendText(phone, tpl.welcome(config.appBaseUrl));
    }
    return;
  }

  const prefs = await repo.getPreferences(user.id);

  switch (intent.kind) {
    case 'choose': {
      // Resolve the chosen option (1-based) against today's offered suggestions.
      const options = await repo.todaysSuggestions(user.id);
      const offered = options[intent.option - 1];
      if (!offered) {
        await sendText(phone, "That option isn't available. Reply *MENU* for options.");
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
      else await sendText(phone, 'Nothing pending to approve. Reply *MENU* for options.');
      return;
    }
    case 'cancel': {
      const pending = await repo.pendingOrderForUser(user.id);
      if (pending) {
        await repo.updateOrder(pending.id, { status: 'cancelled' });
        await sendText(phone, "👍 Cancelled — no order today. I'll check in again next work day.");
      } else {
        await sendText(phone, 'Nothing to cancel.');
      }
      return;
    }
    case 'skip':
      await sendText(phone, "No problem — skipping today. 🙂");
      return;
    case 'last_order': {
      const last = await repo.lastOrder(user.id);
      await sendText(phone, last ? `Your last order: ${last.dishName} from ${last.restaurantName} (₪${last.priceNis}).${last.trackerDeepLink ? ` ${last.trackerDeepLink}` : ''}` : 'No past orders yet.');
      return;
    }
    case 'prefs':
      await sendText(phone, `Edit your preferences here: ${config.appBaseUrl}/onboarding?u=${user.id}`);
      return;
    case 'support':
      await sendText(phone, tpl.support());
      return;
    case 'menu':
    default:
      await sendText(phone, tpl.menu(config.appBaseUrl));
      return;
  }
}
