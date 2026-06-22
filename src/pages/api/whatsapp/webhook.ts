import type { NextApiRequest, NextApiResponse } from 'next';
import { handleInbound } from '../../../services/inbound';
import { validateSignature } from '../../../whatsapp/twilio';
import { config } from '../../../lib/config';

/**
 * Twilio WhatsApp inbound webhook. Twilio POSTs url-encoded form data with
 * `From` (whatsapp:+972...) and `Body`. We verify the Twilio signature, then
 * process asynchronously and return empty TwiML so Twilio doesn't retry.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const params = req.body as Record<string, string>;
  const signature = (req.headers['x-twilio-signature'] as string) ?? '';
  const url = `${config.appBaseUrl}/api/whatsapp/webhook`;
  if (process.env.NODE_ENV === 'production' && !validateSignature(signature, url, params)) {
    return res.status(403).send('invalid signature');
  }

  const from = (params.From ?? '').replace('whatsapp:', '');
  const body = params.Body ?? '';
  if (!from) return res.status(400).end();

  try {
    await handleInbound(from, body);
  } catch (err) {
    console.error('inbound handler error', err);
  }
  res.setHeader('content-type', 'text/xml');
  return res.status(200).send('<Response></Response>');
}
