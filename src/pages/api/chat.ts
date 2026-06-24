import type { NextApiRequest, NextApiResponse } from 'next';
import { readSession } from '../../lib/webSession';
import { runChatTurn } from '../../lib/agent';
import { defaultPreferences } from '../../domain/preferences';
import type { Preferences } from '../../domain/types';

/**
 * One turn of the chatbot. Stateless: the browser sends the full Anthropic
 * message array + current preferences; we read the 10Bis session from the
 * encrypted cookie, run the agent (which may browse the menu / place an order),
 * and send the updated state back.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = readSession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'not_connected' });

  const body = req.body ?? {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ ok: false, error: 'messages required' });
  }
  const preferences: Preferences = { ...defaultPreferences(), ...(body.preferences ?? {}) };
  const addressId: string = String(body.addressId ?? '');

  try {
    const result = await runChatTurn({ messages: body.messages, preferences, addressId, session });
    return res.status(200).json({
      ok: true,
      messages: result.messages,
      reply: result.reply,
      preferences: result.preferences,
      artifacts: result.artifacts,
    });
  } catch (err) {
    console.error('chat error', err);
    return res.status(500).json({ ok: false, error: 'The assistant hit an error. Please try again.' });
  }
}
