/**
 * When to schedule a future delivery. The website doesn't run a server cron, but
 * 10Bis itself accepts a future `deliverAt` on an order — so "order on the days
 * and times I set, not now" is satisfied by placing a real order today whose
 * delivery is scheduled for the next active day inside the preferred window.
 *
 * Pure + timezone-free: call it client-side so `now` is the user's wall clock.
 */

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function dayNameHe(day: number): string {
  return DAY_NAMES_HE[day] ?? '';
}

export interface DeliverySlot {
  /** ISO 8601 with local offset (not UTC), so 10Bis receives wall-clock time. */
  iso: string;
  /** Day of week of the delivery (0=Sun..6=Sat). */
  day: number;
  /** HH:mm of the delivery. */
  time: string;
  /** 0=today, 1=tomorrow, … — how far out the slot is. */
  daysAhead: number;
}

function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * The soonest delivery slot on one of the user's active days at `time` (HH:mm).
 * Picks today only if it's an active day and `time` hasn't already passed;
 * otherwise the next upcoming active day. Returns null if nothing fits a week.
 */
export function nextDeliverySlot(
  activeDays: number[],
  time: string,
  now: Date = new Date(),
): DeliverySlot | null {
  const days = [...new Set(activeDays)].filter((d) => d >= 0 && d <= 6);
  if (days.length === 0) return null;
  const mins = hhmmToMinutes(time);
  if (!Number.isFinite(mins)) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (let ahead = 0; ahead <= 7; ahead++) {
    const d = new Date(now);
    d.setDate(now.getDate() + ahead);
    if (!days.includes(d.getDay())) continue;
    if (ahead === 0 && mins <= nowMins) continue; // today's window already passed
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return { iso: localIso(d), day: d.getDay(), time, daysAhead: ahead };
  }
  return null;
}

/** Human label like "מחר (שני) ב-12:30" / "ביום שלישי ב-12:30". */
export function describeSlot(slot: DeliverySlot): string {
  const day = `יום ${dayNameHe(slot.day)}`;
  if (slot.daysAhead === 0) return `היום (${day}) ב-${slot.time}`;
  if (slot.daysAhead === 1) return `מחר (${day}) ב-${slot.time}`;
  return `ב${day} ב-${slot.time}`;
}
