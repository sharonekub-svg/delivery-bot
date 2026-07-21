/**
 * Interprets a free-text WhatsApp reply into an intent. Hebrew-first with full
 * English fallback, so "כן", "דלג" and "עוד" work exactly like "yes", "skip"
 * and "more". Anything unmatched flows to the Claude interpreter (lib/claude).
 */
export type Intent =
  | { kind: 'start' }
  | { kind: 'choose'; option: number }
  | { kind: 'skip' }
  | { kind: 'cancel' }
  | { kind: 'approve_budget' }
  | { kind: 'alternative' }
  | { kind: 'menu' }
  | { kind: 'prefs' }
  | { kind: 'last_order' }
  | { kind: 'support' }
  | { kind: 'week_plan' }
  | { kind: 'stats' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'set_budget'; amountNis: number }
  | { kind: 'add_exclusion'; item: string }
  | { kind: 'unknown'; raw: string };

const EXACT: Record<string, Intent> = {};
function map(words: string[], intent: Intent) {
  for (const w of words) EXACT[w] = intent;
}

map(['start', 'begin', 'setup', 'התחל', 'התחלה', 'להתחיל', 'בואו נתחיל'], { kind: 'start' });
map(['skip', 'no', 'not today', 'דלג', 'לדלג', 'לא היום', 'לא רוצה', 'בלי היום'], { kind: 'skip' });
map(['cancel', 'stop', 'בטל', 'ביטול', 'לבטל', 'עצור', 'תעצור'], { kind: 'cancel' });
map(
  ['yes', 'y', 'approve', 'ok', 'okay', 'כן', 'אשר', 'מאשר', 'מאשרת', 'אישור', 'יאללה', 'בסדר', 'סבבה', 'אוקיי', 'אוקי', 'בטח'],
  { kind: 'approve_budget' },
);
map(
  ['alt', 'alternative', 'other', 'more', 'עוד', 'אחר', 'משהו אחר', 'עוד אפשרויות', 'אפשרות אחרת', 'תציע עוד', 'הצע עוד'],
  { kind: 'alternative' },
);
map(['menu', 'help', '?', 'תפריט', 'עזרה', 'מה אפשר'], { kind: 'menu' });
map(['prefs', 'preferences', 'settings', 'העדפות', 'הגדרות', 'פרופיל'], { kind: 'prefs' });
map(['last', 'last order', 'אחרון', 'הזמנה אחרונה', 'מה הזמנתי'], { kind: 'last_order' });
map(['support', 'problem', 'issue', 'תמיכה', 'בעיה', 'תקלה'], { kind: 'support' });
map(
  ['week', 'weekly', 'plan', 'שבוע', 'תוכנית', 'תכנית', 'תוכנית שבועית', 'תכנון שבועי', 'מה השבוע'],
  { kind: 'week_plan' },
);
map(
  ['stats', 'spend', 'balance', 'תקציב', 'יתרה', 'הוצאות', 'כמה הוצאתי', 'כמה נשאר'],
  { kind: 'stats' },
);
map(['pause', 'הפסק', 'תפסיק', 'הפסקה', 'די בינתיים'], { kind: 'pause' });
map(['resume', 'continue', 'המשך', 'תמשיך', 'תחזור', 'חזרנו'], { kind: 'resume' });

export function parse(raw: string): Intent {
  const t = raw.trim().toLowerCase().replace(/[.!،]+$/u, '').trim();
  if (/^\d+$/.test(t)) return { kind: 'choose', option: parseInt(t, 10) };

  const exact = EXACT[t];
  if (exact) return exact;

  // "תקציב 55" / "budget 55" — set the daily budget inline.
  const budget = t.match(/^(?:budget|תקציב)\s+(\d{1,4})(?:\s*(?:nis|₪|שח|ש"ח))?$/u);
  if (budget) return { kind: 'set_budget', amountNis: parseInt(budget[1], 10) };

  // "בלי גלוטן" / "no nuts" / "without dairy" — add an exclusion on the fly.
  const exclusion = t.match(/^(?:בלי|without|no)\s+(.{2,40})$/u);
  if (exclusion && !EXACT[t]) return { kind: 'add_exclusion', item: exclusion[1].trim() };

  return { kind: 'unknown', raw };
}
