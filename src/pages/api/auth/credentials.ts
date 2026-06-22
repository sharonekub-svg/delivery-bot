import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { completeLogin, setEmail, startLogin } from '../../../services/auth';

/**
 * 10Bis SMS-OTP login (PRD §3.2 #11 / §4.4). Two actions:
 *  - request: store the email and trigger the SMS code
 *  - verify:  verify the code; only the encrypted session token is then stored.
 * Raw credentials/passwords are never involved (10Bis uses one-time codes).
 */
const Body = z.union([
  z.object({ userId: z.string().uuid(), action: z.literal('request'), email: z.string().email() }),
  z.object({ userId: z.string().uuid(), action: z.literal('verify'), code: z.string().min(3).max(8) }),
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_input' });

  try {
    if (parsed.data.action === 'request') {
      await setEmail(parsed.data.userId, parsed.data.email);
      await startLogin(parsed.data.userId);
      return res.status(200).json({ ok: true, sent: true });
    }
    const ok = await completeLogin(parsed.data.userId, parsed.data.code);
    return res.status(ok ? 200 : 401).json({ ok });
  } catch (err) {
    console.error('auth error', err);
    return res.status(500).json({ ok: false });
  }
}
