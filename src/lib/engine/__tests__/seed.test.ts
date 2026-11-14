import { describe, expect, it } from 'vitest';
import { ritaDayNow } from '../../seed';

describe("Rita's demo on the real clock", () => {
  it('at 11:46 the day shifts so her meeting has just ended and pickup moves with it', () => {
    const day = ritaDayNow('2026-11-14', 11 * 60 + 46)!;
    const meeting = day.find((s) => s.id === 's_meeting')!;
    expect(meeting.start + meeting.duration).toBeLessThanOrEqual(11 * 60 + 46);
    expect(day.find((s) => s.id === 's_pickup')!.start).toBe(12 * 60 + 30 + 95);
  });
  it('late at night it falls back (null) instead of running past midnight', () => {
    expect(ritaDayNow('2026-11-14', 22 * 60)).toBeNull();
  });
});
