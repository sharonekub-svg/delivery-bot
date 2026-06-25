import type { NextApiRequest, NextApiResponse } from 'next';
import { recommendForUser } from '../../services/menu';
import { defaultPreferences } from '../../domain/preferences';
import type { Preferences } from '../../domain/types';
import type { TenbisSession } from '../../tenbis/types';

/**
 * Stateless recommendations. The browser sends the session it remembered (from
 * /api/connect) plus the saved profile; we rank the live menu and return picks.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body ?? {};
  const session = body.session as TenbisSession | undefined;
  if (!session?.token) return res.status(401).json({ ok: false, error: 'not_connected' });

  const prefs: Preferences = { ...defaultPreferences(), ...(body.preferences ?? {}) };
  const addressId = String(body.addressId ?? '');
  if (!addressId) return res.status(400).json({ ok: false, error: 'no_address' });
  // Let the chat ask for more options to cycle through.
  const count = Number(body.count);
  if (Number.isFinite(count) && count > 0) prefs.optionCount = Math.min(count, 8);
  const craving = body.craving ? String(body.craving) : undefined;
  const basis = body.basis === 'history' ? 'history' : 'goal';

  try {
    const options = await recommendForUser(session, addressId, prefs, { craving, basis });
    return res.status(200).json({ ok: true, options });
  } catch (err) {
    console.error('recommend error', err);
    return res.status(500).json({ ok: false, error: 'לא הצלחנו לטעון את התפריט. ייתכן שהסשן של 10bis פג — התחברו מחדש ונסו שוב.' });
  }
}
