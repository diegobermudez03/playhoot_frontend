import { describe, expect, it } from 'vitest';

import { validateBrief } from './brief';
import briefDocument from './testdata/brief-vectors.json';

interface BriefCase {
  name: string;
  brief: unknown;
  valid: boolean;
  fields: string[];
}

const briefs = briefDocument as unknown as { cases: BriefCase[] };

describe('validateBrief', () => {
  // The same vectors run against the backend's gamebrief (../playhoot), so a brief the SDK accepts
  // is one the backend stores; packages/game-tools checks both copies stay identical.
  it.each(briefs.cases.map((vector) => [vector.name, vector] as const))('%s', (_, vector) => {
    const result = validateBrief(vector.brief);
    expect(result.ok).toBe(vector.valid);
    expect(result.ok ? [] : result.problems.map((problem) => problem.field)).toEqual(vector.fields);
  });

  it('answers the phase, brief when none is given', () => {
    expect(validateBrief({ format: 'playhoot.brief.v1' })).toMatchObject({
      ok: true,
      phase: 'brief',
    });
    expect(validateBrief({ format: 'playhoot.brief.v1', phase: 'assets' })).toMatchObject({
      ok: true,
      phase: 'assets',
    });
  });
});
