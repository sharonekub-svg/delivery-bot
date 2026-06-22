import type { NextApiRequest, NextApiResponse } from 'next';
import { handleInbound } from '../../../services/inbound';
import { parseIncoming, validateSignature, verifyWebhook } from '../../../whatsapp/meta';

// Meta signs the raw body, so we must read it unparsed.
export const config = { api: { bodyParser: false } };

async function readRaw(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Meta WhatsApp Cloud API webhook.
 *  - GET: verification handshake (echo hub.challenge).
 *  - POST: inbound messages; verify X-Hub-Signature-256 then dispatch.
 * Always 200 quickly so Meta doesn't retry.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const challenge = verifyWebhook(req.query as Record<string, unknown>);
    if (challenge !== null) return res.status(200).send(challenge);
    return res.status(403).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  const raw = await readRaw(req);
  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  if (process.env.NODE_ENV === 'production' && !validateSignature(sig, raw)) {
    return res.status(403).send('invalid signature');
  }

  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  const msg = parseIncoming(body);
  if (msg?.from) {
    try {
      await handleInbound(msg.from, msg.text);
    } catch (err) {
      console.error('inbound handler error', err);
    }
  }
  return res.status(200).json({ received: true });
}
