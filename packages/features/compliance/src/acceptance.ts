import type { AcceptanceText, ComplianceClient } from '@playhoot/communication';
import { acceptanceContexts, registrationTextKinds } from '@playhoot/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';

// One text the person is being asked to accept, at the exact version they are shown.
export interface PendingAcceptance {
  kind: string;
  version: number;
  language: string;
  content: string;
}

export interface AcceptanceStepState {
  // `unknown` until it is known whether anything has to be asked; `none` when nothing has
  // (a guest, an account that already accepted, or no text published yet); `pending` while the
  // person is being asked; `recording` while their answer is being written down.
  status: 'unknown' | 'none' | 'pending' | 'recording';
  texts: readonly PendingAcceptance[];
  // The recording did not go through; the person can try again.
  failed: boolean;
}

export interface AcceptanceStep {
  store: StoreApi<AcceptanceStepState>;
  // Reads the current version of each text a registration needs and keeps those this person has
  // not accepted. Never refuses the way in: a text that cannot be read now is simply not asked
  // for, and the next sign-in asks again.
  load(language: string): Promise<void>;
  // Records one acceptance per kind, each at its own version (P22§3); true once all are in.
  accept(): Promise<boolean>;
}

export interface AcceptanceStepDeps {
  compliance: ComplianceClient;
}

// The step a sign-in inserts when the account has no standing acceptance of the current terms
// and own-data texts — a new account, or a version that changed since (D-037). Guests are never
// asked (C-01): nothing calls this for them.
export function createAcceptanceStep(deps: AcceptanceStepDeps): AcceptanceStep {
  const store = createStore<AcceptanceStepState>(() => ({
    status: 'unknown',
    texts: [],
    failed: false,
  }));

  return {
    store,
    async load(language) {
      const reads = await Promise.all(
        registrationTextKinds.map((kind) => deps.compliance.readText(kind, language)),
      );
      const texts = reads
        .filter((read) => read.ok && !read.value.accepted)
        .map((read) => pendingOf((read as { ok: true; value: AcceptanceText }).value));
      store.setState({ status: texts.length > 0 ? 'pending' : 'none', texts, failed: false });
    },
    async accept() {
      const { texts, status } = store.getState();
      if (status === 'recording') return false;
      store.setState({ status: 'recording', failed: false });
      for (const text of texts) {
        const result = await deps.compliance.recordAcceptance(
          text.kind,
          text.version,
          text.language,
          'accepted',
          acceptanceContexts.registration,
        );
        if (!result.ok) {
          store.setState({ status: 'pending', failed: true });
          return false;
        }
      }
      store.setState({ status: 'none', texts: [], failed: false });
      return true;
    },
  };
}

function pendingOf(text: AcceptanceText): PendingAcceptance {
  return {
    kind: text.kind,
    version: text.version,
    language: text.language,
    content: text.content,
  };
}
