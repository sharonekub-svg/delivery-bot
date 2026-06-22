import type { NextApiRequest, NextApiResponse } from 'next';
import { processDueAutopilotOrders } from '../../../services/autopilot';
import { authorizeCron } from '../../../lib/cronAuth';

/** Runs frequently; places autopilot orders whose cancel window has elapsed. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!authorizeCron(req)) return res.status(401).end();
  const placed = await processDueAutopilotOrders();
  return res.status(200).json({ ok: true, placed });
}
