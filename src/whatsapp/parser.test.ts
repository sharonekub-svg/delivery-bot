import { describe, expect, it } from 'vitest';
import { parse } from './parser';

describe('whatsapp intent parser', () => {
  it('parses numeric choices', () => {
    expect(parse('1')).toEqual({ kind: 'choose', option: 1 });
    expect(parse(' 2 ')).toEqual({ kind: 'choose', option: 2 });
  });

  it('understands Hebrew confirmations', () => {
    for (const word of ['כן', 'יאללה', 'סבבה', 'אישור', 'בסדר']) {
      expect(parse(word).kind).toBe('approve_budget');
    }
  });

  it('understands Hebrew skip/cancel', () => {
    expect(parse('דלג').kind).toBe('skip');
    expect(parse('לא היום').kind).toBe('skip');
    expect(parse('בטל').kind).toBe('cancel');
    expect(parse('ביטול').kind).toBe('cancel');
  });

  it('understands more-options in both languages', () => {
    expect(parse('עוד').kind).toBe('alternative');
    expect(parse('משהו אחר').kind).toBe('alternative');
    expect(parse('more').kind).toBe('alternative');
  });

  it('understands the weekly plan command', () => {
    expect(parse('שבוע').kind).toBe('week_plan');
    expect(parse('תוכנית שבועית').kind).toBe('week_plan');
    expect(parse('plan').kind).toBe('week_plan');
  });

  it('understands stats and inline budget setting', () => {
    expect(parse('כמה הוצאתי').kind).toBe('stats');
    expect(parse('תקציב').kind).toBe('stats');
    expect(parse('תקציב 55')).toEqual({ kind: 'set_budget', amountNis: 55 });
    expect(parse('budget 45 nis')).toEqual({ kind: 'set_budget', amountNis: 45 });
  });

  it('understands on-the-fly exclusions but keeps bare "no" as skip', () => {
    expect(parse('בלי גלוטן')).toEqual({ kind: 'add_exclusion', item: 'גלוטן' });
    expect(parse('no nuts')).toEqual({ kind: 'add_exclusion', item: 'nuts' });
    expect(parse('no').kind).toBe('skip');
    expect(parse('לא היום').kind).toBe('skip');
  });

  it('understands pause/resume', () => {
    expect(parse('הפסק').kind).toBe('pause');
    expect(parse('המשך').kind).toBe('resume');
  });

  it('trims trailing punctuation', () => {
    expect(parse('כן!').kind).toBe('approve_budget');
  });

  it('falls back to unknown for free text', () => {
    expect(parse('בא לי משהו אסייתי היום').kind).toBe('unknown');
  });
});
