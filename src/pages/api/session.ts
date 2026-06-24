import type { NextApiRequest, NextApiResponse } from 'next';
import { clearSession, readSession } from '../../lib/webSession';
import { getTenbisClient } from '../../tenbis';

/**
 * Connection status for the web client. GET reports whether a valid 10Bis
 * session is present (and the user's addresses); DELETE disconnects.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    clearSession(res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const session = readSession(req);
  if (!session) return res.status(200).json({ connected: false });

  try {
    const addresses = await getTenbisClient().getAddresses(session).catch(() => []);
    return res.status(200).json({
      connected: true,
      addresses: addresses.map((a) => ({ id: a.id, label: a.label })),
    });
  } catch {
    return res.status(200).json({ connected: true, addresses: [] });
  }
}
