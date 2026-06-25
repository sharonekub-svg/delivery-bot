import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenbisClient } from '../../tenbis';
import type { TenbisSession } from '../../tenbis/types';

/**
 * List the delivery addresses on the connected 10Bis account (home, work, …) so
 * the browser can ask "where should it go?" before scheduling an order.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = (req.body ?? {}).session as TenbisSession | undefined;
  if (!session?.token) return res.status(401).json({ ok: false, error: 'not_connected' });

  try {
    const addresses = await getTenbisClient().getAddresses(session);
    return res.status(200).json({
      ok: true,
      addresses: addresses.map((a) => ({ id: a.id, label: a.label, raw: a.raw })),
    });
  } catch (err) {
    console.error('addresses error', err);
    return res.status(500).json({ ok: false, error: 'לא הצלחנו לטעון את הכתובות.' });
  }
}
