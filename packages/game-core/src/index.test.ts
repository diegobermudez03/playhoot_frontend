import { describe, expect, it } from 'vitest';

import {
  addPoints,
  defaultValues,
  ranking,
  validateValues,
  type Field,
  type Fields,
} from './index';
import vectorsDocument from './testdata/field-vectors.json';

interface VectorCase {
  name: string;
  field: Field;
  valid: boolean;
  value?: unknown;
  absent?: boolean;
  payload?: unknown;
  canonical?: unknown;
}

const vectors = vectorsDocument as unknown as { cases: VectorCase[] };

describe('validateValues', () => {
  // The same vectors run against the backend's validation (../playhoot), so both decide alike;
  // packages/game-tools checks both copies stay identical.
  it.each(vectors.cases.map((vector) => [vector.name, vector] as const))('%s', (_, vector) => {
    const fields: Fields = { f: vector.field };
    const given = 'payload' in vector ? vector.payload : vector.absent ? {} : { f: vector.value };
    const result = validateValues(fields, given);
    expect(result.ok).toBe(vector.valid);
    if (result.ok) expect(result.value).toEqual({ f: vector.canonical });
  });

  it('reports every broken field by name', () => {
    const result = validateValues({ a: 'number', b: 'boolean' }, { a: 'x', b: 1, c: true });
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'c', message: 'is not declared' },
        { field: 'a', message: 'must be a finite number' },
        { field: 'b', message: 'must be a boolean' },
      ],
    });
  });
});

describe('defaultValues', () => {
  it('fills every field with its default', () => {
    expect(
      defaultValues({
        move: 'vector2',
        boost: 'boolean',
        speed: { type: 'number', default: 2 },
        mode: ['walk', 'run'],
        note: { type: 'string', nullable: true },
      }),
    ).toEqual({ move: [0, 0], boost: false, speed: 2, mode: 'walk', note: null });
  });
});

describe('ranking', () => {
  it('orders by points, ties sharing a rank and the next one skipped', () => {
    expect(ranking({ A: 2, B: 5, C: 2, D: 1 })).toEqual([
      { player: 'B', points: 5, rank: 1 },
      { player: 'A', points: 2, rank: 2 },
      { player: 'C', points: 2, rank: 2 },
      { player: 'D', points: 1, rank: 4 },
    ]);
  });

  it('counts listed players without points as 0, keeping their order on ties', () => {
    const scores = {};
    addPoints(scores, 'P2', 1);
    addPoints(scores, 'P2', -1);
    expect(ranking(scores, ['P1', 'P2', 'P3'])).toEqual([
      { player: 'P1', points: 0, rank: 1 },
      { player: 'P2', points: 0, rank: 1 },
      { player: 'P3', points: 0, rank: 1 },
    ]);
  });
});
