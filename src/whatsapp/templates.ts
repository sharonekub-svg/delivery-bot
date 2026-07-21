import type { ScoredDish } from '../domain/recommendation';
import { dayNameHe, type WeeklyPlan } from '../domain/weeklyPlan';
import type { OrderRecord } from '../domain/types';

const TOS_URL = (base: string) => `${base}/terms`;

export function welcome(base: string): string {
  return [
    '👋 היי! אני עוזר הצהריים שלך. בימי העבודה אציע לך צהריים בריאים ואזמין אותם בשבילך ב-10ביס — כדי שלא תפספסו יותר ארוחה.',
    '',
    `לפני שמתחילים: אני רק *מתווך הזמנות* — האחריות על האוכל והמשלוח היא של 10ביס והמסעדה. תנאים: ${TOS_URL(base)}`,
    '',
    'כתבו *התחל* ונגדיר את ההעדפות שלך.',
  ].join('\n');
}

/**
 * The daily prompt. `startIndex` lets "more options" continue the numbering
 * (3, 4, ...) so replies stay unambiguous.
 */
export function dailyPrompt(blurbs: string[], picked: ScoredDish[], startIndex = 0): string {
  const lines = picked.map((p, i) => {
    const n = startIndex + i + 1;
    const why = p.reasons.length ? `\n   💡 ${p.reasons.slice(0, 3).join(' · ')}` : '';
    return `*${n}.* ${blurbs[i]}\n   ₪${p.dish.priceNis}${p.dish.deepLink ? ` · ${p.dish.deepLink}` : ''}${why}`;
  });
  const nums = picked.map((_, i) => startIndex + i + 1);
  return [
    startIndex === 0 ? '🍽️ *הגיע זמן צהריים!* הנה הבחירות של היום:' : '🍽️ עוד אפשרויות בשבילך:',
    '',
    ...lines,
    '',
    `השיבו *${nums.join('* או *')}* כדי להזמין, *עוד* לאפשרויות נוספות, או *דלג* להיום.`,
  ].join('\n');
}

export function autopilotIntent(picked: ScoredDish, executeAtLocal: string): string {
  return [
    `🤖 *טייס אוטומטי:* אזמין לך *${picked.dish.name}* (${picked.dish.restaurantName}, ₪${picked.dish.priceNis}) בשעה ${executeAtLocal}.`,
    picked.reasons.length ? `💡 ${picked.reasons.slice(0, 3).join(' · ')}` : '',
    '',
    'לא בא לך היום? השיבו *בטל* ולא יוזמן כלום.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function orderSuccess(order: OrderRecord, etaMinutes?: number): string {
  return [
    `✅ הוזמן *${order.dishName}* מ-${order.restaurantName} — ₪${order.priceNis}.`,
    etaMinutes ? `⏱️ זמן משלוח משוער: כ-${etaMinutes} דק׳.` : '',
    order.trackerDeepLink ? `מעקב: ${order.trackerDeepLink}` : '',
    '',
    'בתיאבון — ארוחה טובה מחזיקה אחר צהריים חד! 💪',
  ]
    .filter(Boolean)
    .join('\n');
}

export function orderFailure(reason: string, alternative?: string): string {
  return [
    `⚠️ לא הצלחתי להזמין: ${reason}.`,
    alternative ? `\nאפשרות חלופית: ${alternative}` : '\nהשיבו *עוד* לאפשרויות אחרות או *תפריט* לעזרה.',
  ].join('');
}

export function budgetWarning(overByNis: number): string {
  return `האפשרות הזו חורגת ב-₪${overByNis} מהתקציב היומי שלך. השיבו *כן* לאשר את התוספת, או *עוד* לאפשרות חסכונית יותר.`;
}

export function sessionExpired(base: string): string {
  return `🔐 הסשן שלך ב-10ביס פג. היכנסו כאן להתחברות מאובטחת מחדש כדי שאוכל להזמין היום: ${base}/auth`;
}

export function menu(base: string): string {
  return [
    '📋 *מה אפשר לכתוב לי:*',
    '• *עוד* — אפשרויות נוספות להיום',
    '• *שבוע* — תוכנית ארוחות שבועית',
    '• *תקציב* — כמה הוצאת החודש (או *תקציב 50* לעדכון)',
    '• *בלי גלוטן* — הוספת הגבלה תוך כדי שיחה',
    '• *אחרון* — ההזמנה האחרונה שלך',
    '• *הפסק* / *המשך* — השהיית ההצעות היומיות',
    '• *העדפות* — עריכת הפרופיל המלא',
    '• *תמיכה* — בעיה עם הזמנה',
  ].join('\n');
}

export function support(): string {
  return [
    'אני עוזר הזמנות, אז אין לי יכולת לטפל ישירות בבעיות משלוח או אוכל.',
    'להזמנה פעילה — פנו לשירות הלקוחות של 10ביס באפליקציה. השיבו *תפריט* לאפשרויות.',
  ].join('\n');
}

export function weeklyPlanMsg(plan: WeeklyPlan): string {
  if (plan.days.length === 0) return 'לא הצלחתי לבנות תוכנית שבועית כרגע — נסו שוב מאוחר יותר.';
  const lines = plan.days.map(
    (d) => `*${dayNameHe(d.day)}* — ${d.pick.dish.name} (${d.pick.dish.restaurantName}, ₪${d.pick.dish.priceNis})`,
  );
  return [
    '🗓️ *התוכנית השבועית שלך:*',
    '',
    ...lines,
    '',
    `סה״כ משוער: ₪${plan.totalNis}. בכל בוקר אשלח את ההצעה של אותו יום לאישור.`,
  ].join('\n');
}

export function statsMsg(monthSpendNis: number, placedCount: number, dailyBudgetNis: number): string {
  return [
    '📊 *התמונה החודשית שלך:*',
    `• הזמנות דרכי החודש: ${placedCount}`,
    `• סה״כ הוצאה: ₪${monthSpendNis}`,
    `• תקציב יומי מוגדר: ₪${dailyBudgetNis}`,
    '',
    'רוצים לעדכן? כתבו למשל *תקציב 45*.',
  ].join('\n');
}

export function paused(): string {
  return '⏸️ הבנתי, עוצר את ההצעות היומיות. כשתרצו לחזור — כתבו *המשך*.';
}

export function resumed(): string {
  return '▶️ חזרנו! אמשיך להציע צהריים בימי הפעילות שלך.';
}

export function budgetSet(amountNis: number): string {
  return `💰 עודכן — התקציב היומי שלך הוא עכשיו ₪${amountNis}.`;
}

export function exclusionAdded(item: string): string {
  return `🚫 נרשם — לא אציע יותר מנות עם ${item}. אפשר לערוך הכל ב-*העדפות*.`;
}
