import type { ScoredDish } from '../domain/recommendation';
import type { OrderRecord } from '../domain/types';

const TOS_URL = (base: string) => `${base}/terms`;

export function welcome(base: string): string {
  return [
    "👋 Hi! I'm your Lunch Helper. On your work days I'll suggest a healthy lunch and order it for you on 10Bis so you never skip a meal.",
    '',
    `Before we start: I'm only an order *facilitator* — I'm not responsible for food quality or delivery. Terms: ${TOS_URL(base)}`,
    '',
    "Reply *START* and I'll set up your preferences.",
  ].join('\n');
}

export function dailyPrompt(blurbs: string[], picked: ScoredDish[]): string {
  const lines = picked.map((p, i) => `*${i + 1}.* ${blurbs[i]}\n   ₪${p.dish.priceNis}${p.dish.deepLink ? ` · ${p.dish.deepLink}` : ''}`);
  return [
    '🍽️ *Lunch time!* Here are today\'s picks:',
    '',
    ...lines,
    '',
    `Reply with *${picked.map((_, i) => i + 1).join('* or *')}* to order, or *SKIP* for today.`,
  ].join('\n');
}

export function autopilotIntent(picked: ScoredDish, executeAtLocal: string): string {
  return [
    `🤖 *Autopilot:* I'll order *${picked.dish.name}* (${picked.dish.restaurantName}, ₪${picked.dish.priceNis}) at ${executeAtLocal}.`,
    '',
    "Reply *CANCEL* if you don't want it today.",
  ].join('\n');
}

export function orderSuccess(order: OrderRecord, etaMinutes?: number): string {
  return [
    `✅ Ordered *${order.dishName}* from ${order.restaurantName} — ₪${order.priceNis}.`,
    etaMinutes ? `⏱️ ETA ~${etaMinutes} min.` : '',
    order.trackerDeepLink ? `Track it: ${order.trackerDeepLink}` : '',
    '',
    'Enjoy — fueling up keeps the afternoon sharp! 💪',
  ]
    .filter(Boolean)
    .join('\n');
}

export function orderFailure(reason: string, alternative?: string): string {
  return [
    `⚠️ Couldn't place that order: ${reason}.`,
    alternative ? `\nAlternative: ${alternative}` : '\nReply *MENU* to try something else.',
  ].join('');
}

export function budgetWarning(overByNis: number): string {
  return `That option is ₪${overByNis} over your daily budget. Reply *YES* to approve the extra charge, or *ALT* to see a budget-friendly pick.`;
}

export function sessionExpired(base: string): string {
  return `🔐 Your 10Bis session expired. Tap here to securely re-authenticate so I can place today's order: ${base}/auth`;
}

export function menu(base: string): string {
  return [
    '📋 *Menu*',
    '• *PREFS* — change your preferences',
    '• *LAST* — see your last order',
    '• *SUPPORT* — problem with an order',
  ].join('\n');
}

export function support(): string {
  return [
    "I'm an ordering assistant, so I can't fix delivery or food issues directly.",
    'For an active order, contact 10Bis customer service in the app. Reply *MENU* for options.',
  ].join('\n');
}
