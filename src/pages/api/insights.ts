import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenbisClient } from '../../tenbis';
import { summarizeHistory } from '../../domain/history';
import type { TenbisSession } from '../../tenbis/types';

/**
 * Stateless order-history insights for the profile page. The browser sends the
 * session it remembered from /api/connect; we read the user's 10Bis history +
 * employer budget and return a summary (recent orders, favourites, rarely-
 * ordered, monthly allowance). Everything is derived from real 10Bis data.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = (req.body ?? {}).session as TenbisSession | undefined;
  if (!session?.token) return res.status(401).json({ ok: false, error: 'not_connected' });

  try {
    const tenbis = getTenbisClient();
    const [history, budget] = await Promise.all([
      tenbis.getHistory(session, 90).catch(() => []),
      tenbis.getBudget(session).catch(() => undefined),
    ]);
    return res.status(200).json({ ok: true, insights: summarizeHistory(history, budget) });
  } catch (err) {
    console.error('insights error', err);
    return res.status(500).json({ ok: false, error: 'לא הצלחנו לטעון את ההיסטוריה. ייתכן שהסשן פג — התחברו מחדש.' });
  }
}
