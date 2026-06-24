import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { parseCredentials } from '../../lib/curlParse';
import { getTenbisClient } from '../../tenbis';

/**
 * Validate the 10Bis credentials the user pasted from DevTools. We extract the
 * cookie + bearer, confirm they work, and hand the resulting session back to
 * the browser, which remembers it locally. No password, no key, no database.
 */
const Body = z.object({ raw: z.string().min(10) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Paste the data you copied from DevTools.' });

  const creds = parseCredentials(parsed.data.raw);
  if (!creds.cookie && !creds.bearer) {
    return res.status(400).json({ ok: false, error: "Couldn't find a cookie or authorization token in that paste. Make sure you copied a 10Bis request." });
  }

  try {
    const tenbis = getTenbisClient();
    const session = await tenbis.sessionFromManualInput(creds);
    const addresses = await tenbis.getAddresses(session).catch(() => []);
    return res.status(200).json({
      ok: true,
      session,
      addresses: addresses.map((a) => ({ id: a.id, label: a.label })),
    });
  } catch (err) {
    console.error('connect error', err);
    return res.status(401).json({ ok: false, error: 'Those credentials did not work — they may be expired. Grab a fresh copy and try again.' });
  }
}
