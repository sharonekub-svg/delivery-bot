/** Interprets a free-text WhatsApp reply into an intent. */
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
  | { kind: 'unknown'; raw: string };

export function parse(raw: string): Intent {
  const t = raw.trim().toLowerCase();
  if (/^\d+$/.test(t)) return { kind: 'choose', option: parseInt(t, 10) };
  if (['start', 'begin', 'setup'].includes(t)) return { kind: 'start' };
  if (['skip', 'no', 'not today'].includes(t)) return { kind: 'skip' };
  if (['cancel', 'stop'].includes(t)) return { kind: 'cancel' };
  if (['yes', 'y', 'approve'].includes(t)) return { kind: 'approve_budget' };
  if (['alt', 'alternative', 'other'].includes(t)) return { kind: 'alternative' };
  if (['menu', 'help', '?'].includes(t)) return { kind: 'menu' };
  if (['prefs', 'preferences', 'settings'].includes(t)) return { kind: 'prefs' };
  if (['last', 'last order'].includes(t)) return { kind: 'last_order' };
  if (['support', 'problem', 'issue'].includes(t)) return { kind: 'support' };
  return { kind: 'unknown', raw };
}
