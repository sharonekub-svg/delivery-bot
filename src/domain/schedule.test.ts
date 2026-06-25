import { describe, expect, it } from 'vitest';
import { nextDeliverySlot, describeSlot, dayNameHe } from './schedule';

// A fixed reference time: Wednesday 2026-06-24, 10:00 local.
// (June 24 2026 is a Wednesday; getDay() === 3.)
const WED_10AM = new Date(2026, 5, 24, 10, 0, 0);

describe('nextDeliverySlot', () => {
  it('schedules today when today is active and the time is still ahead', () => {
    const slot = nextDeliverySlot([3], '12:30', WED_10AM);
    expect(slot).not.toBeNull();
    expect(slot!.daysAhead).toBe(0);
    expect(slot!.day).toBe(3);
    expect(slot!.time).toBe('12:30');
  });

  it("rolls to the next active day when today's window already passed", () => {
    const slot = nextDeliverySlot([3], '09:00', WED_10AM); // 09:00 < 10:00 now
    expect(slot!.daysAhead).toBe(7); // next Wednesday
    expect(slot!.day).toBe(3);
  });

  it('picks the soonest upcoming active day', () => {
    // Active Sun(0) and Thu(4); from Wed it should be Thu (tomorrow).
    const slot = nextDeliverySlot([0, 4], '12:30', WED_10AM);
    expect(slot!.day).toBe(4);
    expect(slot!.daysAhead).toBe(1);
  });

  it('encodes the local time in the ISO (not UTC Z)', () => {
    const slot = nextDeliverySlot([3], '12:30', WED_10AM);
    expect(slot!.iso).toMatch(/^2026-06-24T12:30:00[+-]\d{2}:\d{2}$/);
  });

  it('returns null when no active days are given', () => {
    expect(nextDeliverySlot([], '12:30', WED_10AM)).toBeNull();
  });

  it('returns null for an invalid time', () => {
    expect(nextDeliverySlot([3], 'nope', WED_10AM)).toBeNull();
  });
});

describe('describeSlot', () => {
  it('says today / tomorrow / a named day', () => {
    expect(describeSlot({ iso: '', day: 3, time: '12:30', daysAhead: 0 })).toContain('היום');
    expect(describeSlot({ iso: '', day: 4, time: '12:30', daysAhead: 1 })).toContain('מחר');
    expect(describeSlot({ iso: '', day: 0, time: '12:30', daysAhead: 4 })).toContain(dayNameHe(0));
  });
});
