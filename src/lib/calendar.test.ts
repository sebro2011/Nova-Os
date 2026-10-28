import { describe, expect, it } from 'vitest';
import { getCalendarDays, isValidDateKey } from './calendar';

describe('calendar utilities', () => {
  it('creates a stable six-week local calendar grid', () => {
    const days = getCalendarDays(new Date(2026, 9, 1));
    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.inCurrentMonth)).toHaveLength(31);
    expect(days[0].date.getDay()).toBe(0);
  });

  it('validates real local dates rather than rollover dates', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
  });
});
