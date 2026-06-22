import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getTenbisClient } from '../../../tenbis';
import { saveSession } from '../../../lib/repo';

/**
 * Secure credential exchange (PRD §3.2 #11 / §4.4). The browser posts the
 * 10Bis username/password once; we validate them by logging in, then store
 * ONLY the resulting (encrypted) session token. Raw credentials are never
 * written to the database — they exist only for the lifetime of this request.
 */
const Body = z.object({
  userId: z.string().uuid(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_input' });

  const { userId, username, password } = parsed.data;
  try {
    const tenbis = getTenbisClient();
    const session = await tenbis.login({ username, password }); // validates synchronously
    await saveSession(userId, session);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('credential validation failed', err);
    return res.status(401).json({ ok: false, error: 'login_failed' });
  }
}
