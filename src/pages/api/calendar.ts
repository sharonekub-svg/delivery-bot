import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { parseIcs, suggestDeliverySlot } from '../../domain/calendar';

/**
 * Calendar passthrough. The browser sends the user's ICS feed URL (e.g. Google
 * Calendar's "secret address in iCal format") plus the ordering window; we fetch
 * today's meetings and return a meeting-free delivery time. Stateless — the URL
 * is never stored server-side, exactly like the 10Bis session.
 */
const Body = z.object({
  calendarUrl: z.string().url(),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/),
});

export const config = { maxDuration: 30 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'קישור היומן או טווח השעות לא תקינים.' });

  // webcal:// is just https for an ICS feed; normalise it.
  let url = parsed.data.calendarUrl.replace(/^webcal:\/\//i, 'https://');
  if (!/^https:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: 'אפשר לחבר רק קישור https מאובטח ליומן.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, { signal: controller.signal, headers: { accept: 'text/calendar' } });
    clearTimeout(timer);
    if (!resp.ok) {
      return res.status(400).json({ ok: false, error: 'לא הצלחנו לקרוא את היומן מהקישור. ודאו שזה קישור iCal ציבורי.' });
    }
    const text = await resp.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return res.status(400).json({ ok: false, error: 'הקישור לא מחזיר יומן בפורמט iCal.' });
    }
    const events = parseIcs(text);
    const slot = suggestDeliverySlot(events, { from: parsed.data.timeFrom, to: parsed.data.timeTo });
    return res.status(200).json({ ok: true, slot });
  } catch (err) {
    console.error('calendar error', err);
    return res.status(502).json({ ok: false, error: 'תקלה בקריאת היומן. נסו שוב מאוחר יותר.' });
  }
}
