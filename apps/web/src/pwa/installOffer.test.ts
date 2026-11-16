import { describe, expect, it } from 'vitest';

import { countVisit, hintIsDue, isAppleBrowser, noVisits, settle, today } from './installOffer';

describe('the install hint (V-08)', () => {
  it('is not due on a first visit', () => {
    expect(hintIsDue(countVisit(noVisits, '2026-11-15'))).toBe(false);
  });

  it('is not due after several visits on the same day', () => {
    let visits = countVisit(noVisits, '2026-11-15');
    visits = countVisit(visits, '2026-11-15');
    visits = countVisit(visits, '2026-11-15');
    expect(visits.days).toBe(1);
    expect(hintIsDue(visits)).toBe(false);
  });

  it('is due on a second visit on a different day', () => {
    const visits = countVisit(countVisit(noVisits, '2026-11-15'), '2026-11-16');
    expect(hintIsDue(visits)).toBe(true);
  });

  it('is never due again once it has been shown or dismissed', () => {
    let visits = settle(countVisit(countVisit(noVisits, '2026-11-15'), '2026-11-16'));
    expect(hintIsDue(visits)).toBe(false);
    visits = countVisit(visits, '2026-12-01');
    expect(hintIsDue(visits)).toBe(false);
  });
});

describe('today', () => {
  it('names the day in the local time zone, not in UTC', () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('isAppleBrowser', () => {
  it('recognises an iPhone', () => {
    expect(isAppleBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
  });

  it('recognises an iPad asking for a desktop site', () => {
    expect(isAppleBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('does not take a desktop Mac for one', () => {
    expect(isAppleBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });

  it('does not take an Android phone for one', () => {
    expect(isAppleBrowser('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});
