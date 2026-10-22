import type { PlayerViewMessage } from '@playhoot/protocol';
import { describe, expect, it } from 'vitest';

import { applyViewPatch, createViewTracker } from './viewState';

function view(fields: Partial<PlayerViewMessage>): PlayerViewMessage {
  return {
    type: 'player_view',
    participant_id: 'P1',
    full: false,
    revision: 1,
    state: {},
    consumed_through_sample_sequence: 0,
    ...fields,
  };
}

describe('applyViewPatch', () => {
  it('patches objects field by field, recursively', () => {
    const current = { score: 1, me: { x: 1, y: 2 }, tags: ['a'] };
    expect(applyViewPatch(current, { me: { x: 5 } })).toEqual({
      score: 1,
      me: { x: 5, y: 2 },
      tags: ['a'],
    });
  });

  it('replaces arrays, scalars and null whole, and never removes fields', () => {
    const current = { tags: ['a', 'b'], n: 1, maybe: { a: 1 } };
    expect(applyViewPatch(current, { tags: ['c'], n: null, maybe: null })).toEqual({
      tags: ['c'],
      n: null,
      maybe: null,
    });
  });

  it('replaces a non-object with an object whole', () => {
    expect(applyViewPatch({ slot: 3 }, { slot: { card: 'A' } })).toEqual({ slot: { card: 'A' } });
  });

  it('does not mutate the current state', () => {
    const current = { me: { x: 1 } };
    applyViewPatch(current, { me: { x: 2 } });
    expect(current).toEqual({ me: { x: 1 } });
  });
});

describe('createViewTracker', () => {
  it('starts from a FULL view and applies the following patches', () => {
    const tracker = createViewTracker();
    expect(
      tracker.receive(view({ full: true, revision: 1, state: { a: 1, b: { c: 1 } } })),
    ).toMatchObject({
      kind: 'state',
      full: true,
      state: { a: 1, b: { c: 1 } },
    });
    expect(
      tracker.receive(
        view({ revision: 2, state: { b: { c: 2 } }, consumed_through_sample_sequence: 4 }),
      ),
    ).toEqual({
      kind: 'state',
      full: false,
      state: { a: 1, b: { c: 2 } },
      revision: 2,
      ack: 4,
      events: [],
      errors: [],
    });
  });

  it('treats a repeated revision as ack, events and errors only', () => {
    const tracker = createViewTracker();
    tracker.receive(view({ full: true, revision: 3, state: { a: 1 } }));
    expect(
      tracker.receive(
        view({ revision: 3, state: {}, consumed_through_sample_sequence: 9, events: ['boom'] }),
      ),
    ).toEqual({
      kind: 'ack',
      state: { a: 1 },
      revision: 3,
      ack: 9,
      events: ['boom'],
      errors: [],
    });
  });

  it('reports a gap, keeps delivering events, and recovers with the next FULL view', () => {
    const tracker = createViewTracker();
    tracker.receive(view({ full: true, revision: 1, state: { a: 1 } }));
    expect(tracker.receive(view({ revision: 3, state: { a: 3 }, errors: ['NOPE'] }))).toEqual({
      kind: 'gap',
      ack: 0,
      events: [],
      errors: ['NOPE'],
    });
    expect(tracker.state).toBeUndefined();
    expect(tracker.receive(view({ revision: 4, state: { a: 4 } })).kind).toBe('gap');
    expect(tracker.receive(view({ full: true, revision: 5, state: { a: 5 } })).kind).toBe('state');
    expect(tracker.state).toEqual({ a: 5 });
  });

  it('takes a FULL view mid-stream (the server collapsing a lagging connection) as the new baseline', () => {
    const tracker = createViewTracker();
    tracker.receive(view({ full: true, revision: 1, state: { a: 1, b: 1 } }));
    tracker.receive(view({ revision: 2, state: { b: 2 } }));
    expect(tracker.receive(view({ full: true, revision: 9, state: { a: 9 } }))).toMatchObject({
      kind: 'state',
      full: true,
      state: { a: 9 },
    });
    expect(tracker.receive(view({ revision: 10, state: { b: 10 } }))).toMatchObject({
      kind: 'state',
      state: { a: 9, b: 10 },
    });
  });

  it('cannot apply a patch before any FULL view', () => {
    expect(createViewTracker().receive(view({ revision: 1, state: { a: 1 } })).kind).toBe('gap');
  });
});
