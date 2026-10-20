import type { PlayerViewMessage } from '@playhoot/protocol';

// Applies a view patch the way the backend computes it (backend `viewpatch`): where both sides
// are objects the patch is applied field by field, recursively; anything else in the patch (a
// scalar, an array, null, or an object replacing a non-object) replaces the old value whole.
// Fields never disappear: a removal arrives as a FULL view instead.
export function applyViewPatch(current: unknown, patch: unknown): unknown {
  if (!isPlainObject(current) || !isPlainObject(patch)) return patch;
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    next[key] =
      isPlainObject(value) && isPlainObject(current[key])
        ? applyViewPatch(current[key], value)
        : value;
  }
  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// What a received view means for the player's state.
export type ViewUpdate =
  // The state was replaced (FULL) or patched; `state` is the whole current state.
  | {
      kind: 'state';
      full: boolean;
      state: unknown;
      revision: number;
      ack: number;
      events: unknown[];
      errors: unknown[];
    }
  // Same revision: only the ack and/or transient errors and events are new.
  | {
      kind: 'ack';
      state: unknown;
      revision: number;
      ack: number;
      events: unknown[];
      errors: unknown[];
    }
  // The patch does not follow the last applied revision (or there is no baseline yet): the state
  // cannot be trusted until a FULL view arrives. Events and errors are still delivered: they are
  // sent once and do not depend on the state.
  | { kind: 'gap'; ack: number; events: unknown[]; errors: unknown[] };

// Keeps the player's state from the views of ONE connection (revisions are per connection).
export interface ViewTracker {
  receive(view: PlayerViewMessage): ViewUpdate;
  // The last trustworthy state, or undefined before the first FULL view or after a gap.
  readonly state: unknown;
}

export function createViewTracker(): ViewTracker {
  let state: unknown = undefined;
  let revision: number | null = null;

  return {
    get state() {
      return revision === null ? undefined : state;
    },
    receive(view) {
      const common = {
        ack: view.consumed_through_sample_sequence,
        events: view.events ?? [],
        errors: view.errors ?? [],
      };
      if (view.full) {
        state = view.state;
        revision = view.revision;
        return { kind: 'state', full: true, state, revision, ...common };
      }
      if (revision !== null && view.revision === revision) {
        return { kind: 'ack', state, revision, ...common };
      }
      if (revision !== null && view.revision === revision + 1) {
        state = applyViewPatch(state, view.state);
        revision = view.revision;
        return { kind: 'state', full: false, state, revision, ...common };
      }
      revision = null;
      return { kind: 'gap', ...common };
    },
  };
}
