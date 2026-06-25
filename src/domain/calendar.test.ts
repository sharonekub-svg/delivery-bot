import { describe, expect, it } from 'vitest';
import { parseIcs, suggestDeliverySlot, type CalEvent } from './calendar';

// A fixed planning day so wall-clock minutes are deterministic.
const DAY = new Date(2026, 5, 25, 9, 0, 0); // 25 Jun 2026, local

function ev(fromH: number, fromM: number, toH: number, toM: number, summary?: string): CalEvent {
  return {
    start: new Date(2026, 5, 25, fromH, fromM, 0),
    end: new Date(2026, 5, 25, toH, toM, 0),
    summary,
  };
}

describe('suggestDeliverySlot', () => {
  const win = { from: '12:30', to: '15:00' };

  it('suggests the window start when there are no meetings', () => {
    const r = suggestDeliverySlot([], win, { date: DAY });
    expect(r.suggestedTime).toBe('12:30');
    expect(r.busy).toHaveLength(0);
  });

  it('suggests a gap before the first meeting', () => {
    const r = suggestDeliverySlot([ev(13, 30, 14, 30, 'Standup')], win, { date: DAY });
    // 12:30–13:30 is a free 60-min gap → deliver at 12:30.
    expect(r.suggestedTime).toBe('12:30');
    expect(r.busy).toEqual([{ from: '13:30', to: '14:30', summary: 'Standup' }]);
  });

  it('suggests after a meeting that blocks the window start', () => {
    const r = suggestDeliverySlot([ev(12, 0, 13, 15, 'Long call')], win, { date: DAY });
    // Meeting runs past window start; first free gap begins at 13:15.
    expect(r.suggestedTime).toBe('13:15');
  });

  it('skips a too-short gap and uses the next one', () => {
    const r = suggestDeliverySlot(
      [ev(12, 30, 12, 50), ev(13, 0, 14, 0)], // only 10 min between the two
      win,
      { date: DAY, mealMinutes: 30 },
    );
    // 12:50–13:00 is 10 min (too short); next free gap is after 14:00.
    expect(r.suggestedTime).toBe('14:00');
  });

  it('returns no time when the whole window is booked', () => {
    const r = suggestDeliverySlot([ev(12, 0, 15, 30, 'All-hands')], win, { date: DAY });
    expect(r.suggestedTime).toBeUndefined();
    expect(r.reason).toContain('מלא');
  });

  it('ignores meetings on a different day', () => {
    const other: CalEvent = {
      start: new Date(2026, 5, 26, 13, 0, 0),
      end: new Date(2026, 5, 26, 14, 0, 0),
    };
    const r = suggestDeliverySlot([other], win, { date: DAY });
    expect(r.busy).toHaveLength(0);
    expect(r.suggestedTime).toBe('12:30');
  });
});

describe('parseIcs', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Team sync',
    'DTSTART:20260625T130000',
    'DTEND:20260625T140000',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:All day offsite',
    'DTSTART;VALUE=DATE:20260625',
    'DTEND;VALUE=DATE:20260626',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('parses timed events and skips all-day events', () => {
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Team sync');
    expect(events[0].start.getHours()).toBe(13);
    expect(events[0].end.getHours()).toBe(14);
  });

  it('unfolds folded summary lines', () => {
    const folded = [
      'BEGIN:VEVENT',
      'SUMMARY:Quarterly planning ',
      ' with the whole team',
      'DTSTART:20260625T100000',
      'DTEND:20260625T110000',
      'END:VEVENT',
    ].join('\r\n');
    const events = parseIcs(folded);
    expect(events[0].summary).toBe('Quarterly planning with the whole team');
  });
});
