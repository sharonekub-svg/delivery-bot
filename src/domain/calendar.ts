/**
 * Calendar-aware delivery timing. The user can connect a calendar (by pasting an
 * ICS feed URL — the same "paste a link from your account" idea as the 10Bis
 * connect step). We read today's meetings and pick a delivery time that lands in
 * a gap with no meeting, so the food arrives when they can actually eat.
 *
 * Everything here is pure so it can be unit-tested without a network call; the
 * API route (pages/api/calendar.ts) does the fetch and hands the text in.
 */

export interface CalEvent {
  start: Date;
  end: Date;
  summary?: string;
}

export interface BusySlot {
  from: string; // HH:mm
  to: string; // HH:mm
  summary?: string;
}

export interface SlotResult {
  /** A delivery time (HH:mm) inside a meeting-free gap, if one was found. */
  suggestedTime?: string;
  /** Today's meetings that fall inside the ordering window. */
  busy: BusySlot[];
  /** Human-readable note (Hebrew) explaining the suggestion. */
  reason: string;
}

const TIME_RE = /^(\d{2}):(\d{2})$/;

function hhmmToMinutes(hhmm: string): number {
  const m = TIME_RE.exec(hhmm);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToHhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Minimal ICS parser: pulls VEVENTs with a timed DTSTART/DTEND. All-day events
 * (VALUE=DATE, no time) are skipped — they don't block a lunch slot. Times are
 * read as wall-clock; the feed is expected to be in the user's local timezone
 * (Google's "secret address in iCal format" is, when the calendar TZ is local).
 */
export function parseIcs(text: string): CalEvent[] {
  // Unfold folded lines (RFC 5545: continuation lines start with a space/tab).
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: CalEvent[] = [];
  let cur: Partial<CalEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.start && cur.end) events.push(cur as CalEvent);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const rawKey = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const key = rawKey.split(';')[0];

    if (key === 'DTSTART') {
      const d = parseIcsDate(value, rawKey);
      if (d) cur.start = d;
    } else if (key === 'DTEND') {
      const d = parseIcsDate(value, rawKey);
      if (d) cur.end = d;
    } else if (key === 'SUMMARY') {
      cur.summary = value.replace(/\\,/g, ',').replace(/\\n/gi, ' ').trim();
    }
  }
  return events;
}

function parseIcsDate(value: string, rawKey: string): Date | null {
  // All-day: DTSTART;VALUE=DATE:20260625 — no time, not a meeting block.
  if (/VALUE=DATE\b/.test(rawKey) || /^\d{8}$/.test(value)) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

export interface SuggestOptions {
  /** Day to plan for (defaults to now). */
  date?: Date;
  /** How long a gap must be to fit a meal, in minutes. */
  mealMinutes?: number;
}

/**
 * Find a meeting-free delivery time inside the ordering window [from, to].
 * Strategy: collect the day's meetings that overlap the window, then return the
 * start of the first free gap that is at least `mealMinutes` long. If a meeting
 * is in progress at the window start, we suggest right after it ends.
 */
export function suggestDeliverySlot(
  events: CalEvent[],
  window: { from: string; to: string },
  opts: SuggestOptions = {},
): SlotResult {
  const date = opts.date ?? new Date();
  const meal = opts.mealMinutes ?? 30;
  const winStart = hhmmToMinutes(window.from);
  const winEnd = hhmmToMinutes(window.to);

  if (!Number.isFinite(winStart) || !Number.isFinite(winEnd) || winEnd <= winStart) {
    return { busy: [], reason: 'טווח השעות לא תקין.' };
  }

  // Meetings on the target day that intersect the window, clamped to it.
  const intervals = events
    .filter((e) => sameLocalDay(e.start, date) || sameLocalDay(e.end, date))
    .map((e) => ({
      from: Math.max(winStart, localMinutes(e.start)),
      to: Math.min(winEnd, localMinutes(e.end)),
      summary: e.summary,
    }))
    .filter((i) => i.to > i.from && i.from < winEnd && i.to > winStart)
    .sort((a, b) => a.from - b.from);

  const busy: BusySlot[] = intervals.map((i) => ({
    from: minutesToHhmm(i.from),
    to: minutesToHhmm(i.to),
    summary: i.summary,
  }));

  if (intervals.length === 0) {
    return {
      suggestedTime: window.from,
      busy,
      reason: 'אין פגישות בטווח הזה — אפשר להזמין מתי שתרצו.',
    };
  }

  // Walk the gaps between meetings.
  let cursor = winStart;
  for (const iv of intervals) {
    if (iv.from - cursor >= meal) {
      return {
        suggestedTime: minutesToHhmm(cursor),
        busy,
        reason: `מצאנו חלון פנוי ב-${minutesToHhmm(cursor)}, לפני "${iv.summary ?? 'פגישה'}".`,
      };
    }
    cursor = Math.max(cursor, iv.to);
  }

  // Gap after the last meeting until the window closes.
  if (winEnd - cursor >= meal) {
    return {
      suggestedTime: minutesToHhmm(cursor),
      busy,
      reason: `היומן עמוס עד ${minutesToHhmm(cursor)} — נזמין שהאוכל יגיע אחרי הפגישות.`,
    };
  }

  return {
    busy,
    reason: 'היומן מלא לאורך כל הטווח. כדאי להרחיב את טווח השעות או להזמין ידנית.',
  };
}
