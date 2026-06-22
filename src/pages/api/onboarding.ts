import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getPreferences, savePreferences, markOnboarded } from '../../lib/repo';

/** Persists the preference profile from the onboarding webview. */
const Body = z.object({
  userId: z.string().uuid(),
  preferences: z.record(z.any()),
  complete: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false });

  const { userId, preferences, complete } = parsed.data;
  const current = await getPreferences(userId);
  await savePreferences(userId, { ...current, ...preferences });
  if (complete) await markOnboarded(userId);
  return res.status(200).json({ ok: true });
}
