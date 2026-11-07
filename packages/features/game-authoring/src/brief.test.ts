import { describe, expect, it } from 'vitest';

import { draftBrief } from './brief';

const file = (path: string, content: string | null) => ({ path, sha256: 'h', size: 1, content });

describe('draftBrief', () => {
  it('reads the brief and its phase', () => {
    const brief = { format: 'playhoot.brief.v1', phase: 'testing', goal: 'Tap fast' };
    expect(
      draftBrief([file('notes.md', '# n'), file('brief.json', JSON.stringify(brief))]),
    ).toEqual({
      status: 'valid',
      brief,
      phase: 'testing',
    });
  });

  it('tells a missing brief from one that is not valid', () => {
    expect(draftBrief([file('notes.md', '# n')])).toEqual({ status: 'absent' });
    expect(draftBrief([file('brief.json', null)])).toEqual({ status: 'absent' });
    expect(draftBrief([file('brief.json', '{')])).toEqual({ status: 'invalid' });
    expect(draftBrief([file('brief.json', '{"format":"x"}')])).toEqual({ status: 'invalid' });
  });
});
