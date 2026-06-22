import twilio from 'twilio';
import { config } from '../lib/config';

let tw: ReturnType<typeof twilio> | null = null;
function client() {
  if (!tw) tw = twilio(config.twilio.accountSid(), config.twilio.authToken());
  return tw;
}

/** E.164 phone -> Twilio WhatsApp address. */
export function toWhatsApp(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
}

export async function sendText(toPhone: string, body: string): Promise<void> {
  await client().messages.create({
    from: config.twilio.from(),
    to: toWhatsApp(toPhone),
    body,
  });
}

/**
 * Proactive (business-initiated) send for the daily nudge. On the Twilio
 * sandbox plain text is fine; for a production sender outside the 24h window
 * Twilio requires an approved template — swap in messagingServiceSid/contentSid
 * here when that's set up.
 */
export async function sendProactive(toPhone: string, body: string): Promise<void> {
  await sendText(toPhone, body);
}

/**
 * Validates an incoming Twilio webhook signature. Twilio signs requests with
 * the auth token; rejecting unsigned requests stops anyone spoofing orders.
 */
export function validateSignature(signature: string, url: string, params: Record<string, string>): boolean {
  return twilio.validateRequest(config.twilio.authToken(), signature, url, params);
}
