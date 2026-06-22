import crypto from 'node:crypto';
import { config } from '../lib/config';

/**
 * WhatsApp messaging via Meta (Facebook) Graph / Cloud API — free tier.
 * Sending is plain HTTPS to graph.facebook.com; no SDK needed.
 */
function graph(path: string): string {
  return `https://graph.facebook.com/${config.whatsapp.graphVersion}/${path}`;
}

/** Meta expects digits only, with country code, no '+'. */
export function normalizeTo(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Free-form text. Deliverable only inside the 24h customer-service window
 * (i.e. within 24h of the user's last inbound message). For cold-start
 * proactive messages use sendTemplate.
 */
export async function sendText(toPhone: string, body: string): Promise<void> {
  const res = await fetch(graph(`${config.whatsapp.phoneNumberId()}/messages`), {
    method: 'POST',
    headers: { authorization: `Bearer ${config.whatsapp.accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizeTo(toPhone),
      type: 'text',
      text: { preview_url: true, body },
    }),
  });
  if (!res.ok) console.error('WA sendText failed', res.status, await res.text());
}

/**
 * Pre-approved template message (for business-initiated / cold-start). The
 * template should have a single body parameter {{1}} that carries the text.
 */
export async function sendTemplate(toPhone: string, templateName: string, bodyParam: string): Promise<void> {
  const res = await fetch(graph(`${config.whatsapp.phoneNumberId()}/messages`), {
    method: 'POST',
    headers: { authorization: `Bearer ${config.whatsapp.accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeTo(toPhone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: config.whatsapp.templateLang },
        components: [{ type: 'body', parameters: [{ type: 'text', text: bodyParam }] }],
      },
    }),
  });
  if (!res.ok) console.error('WA sendTemplate failed', res.status, await res.text());
}

/**
 * Proactive (business-initiated) send for the daily nudge. Meta requires an
 * approved template outside the 24h window; if one is configured we use it,
 * otherwise we fall back to free-form text (works if the user messaged within
 * the last 24h — common once she's replying daily).
 */
export async function sendProactive(toPhone: string, body: string): Promise<void> {
  const template = config.whatsapp.dailyTemplate;
  if (template) return sendTemplate(toPhone, template, body);
  return sendText(toPhone, body);
}

/** Webhook GET handshake: echo hub.challenge when the verify token matches. */
export function verifyWebhook(query: Record<string, unknown>): string | null {
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === config.whatsapp.verifyToken()) {
    return String(query['hub.challenge'] ?? '');
  }
  return null;
}

/** Verify Meta's X-Hub-Signature-256 over the raw request body. */
export function validateSignature(signatureHeader: string | undefined, rawBody: Buffer): boolean {
  const secret = config.whatsapp.appSecret();
  if (!secret) return true; // not configured -> skip (dev)
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader ?? ''));
  } catch {
    return false;
  }
}

export interface IncomingMessage {
  from: string;
  text: string;
}

/** Pull the first user message out of a Meta webhook payload. */
export function parseIncoming(body: any): IncomingMessage | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg?.from) return null;
  let text = '';
  if (msg.type === 'text') text = msg.text?.body ?? '';
  else if (msg.type === 'interactive')
    text = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? msg.interactive?.button_reply?.title ?? '';
  return { from: msg.from, text };
}
