import type { NextApiRequest, NextApiResponse } from 'next';
import { getOnboardedUsers } from '../../../lib/repo';
import { runDailyForUser } from '../../../services/dailyOrder';
import { authorizeCron } from '../../../lib/cronAuth';

/**
 * Vercel Cron hits this (see vercel.json). Fans out the daily suggestion to
 * each onboarded user. Each user's own trigger-time/active-day check happens
 * inside runDailyForUser, so running hourly or once is both safe.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!authorizeCron(req)) return res.status(401).end();
  const users = await getOnboardedUsers();
  let triggered = 0;
  for (const u of users) {
    try {
      await runDailyForUser(u);
      triggered++;
    } catch (err) {
      console.error('daily run failed for', u.id, err);
    }
  }
  return res.status(200).json({ ok: true, users: users.length, triggered });
}
