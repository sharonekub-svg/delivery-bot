import type { NextApiRequest } from 'next';
import { config } from './config';

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Reject anything
 * else so the order-triggering endpoints can't be hit by the public.
 */
export function authorizeCron(req: NextApiRequest): boolean {
  if (!config.cronSecret) return process.env.NODE_ENV !== 'production';
  return req.headers.authorization === `Bearer ${config.cronSecret}`;
}
