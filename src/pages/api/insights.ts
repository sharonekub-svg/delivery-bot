import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenbisClient } from '../../tenbis';
import { summarizeHistory } from '../../domain/history';
import type { TenbisSession } from '../../tenbis/types';

/**
 * Stateless account + order-history insights for the profile page. The browser
 * sends the session it remembered from /api/connect; we read everything 10Bis
 * exposes about the user — history, employer budget, name/company, and the
 * coupons on the account — and return it. All derived from real 10Bis data.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = (req.body ?? {}).session as TenbisSession | undefined;
  if (!session?.token) return res.status(401).json({ ok: false, error: 'not_connected' });

  try {
    const tenbis = getTenbisClient();
    const [history, budget, profile, coupons] = await Promise.all([
      tenbis.getHistory(session, 90).catch(() => []),
      tenbis.getBudget(session).catch(() => undefined),
      tenbis.getUserProfile(session).catch(() => ({})),
      tenbis.getCoupons(session).catch(() => []),
    ]);
    return res.status(200).json({
      ok: true,
      insights: summarizeHistory(history, budget),
      profile,
      coupons,
    });
  } catch (err) {
    console.error('insights error', err);
    return res.status(500).json({ ok: false, error: 'לא הצלחנו לטעון את הנתונים. ייתכן שהסשן פג — התחברו מחדש.' });
  }
}
