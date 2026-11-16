import type { ComplianceClient } from '@playhoot/communication';
import { createStore, type StoreApi } from 'zustand/vanilla';

// Why the declaration was not recorded. Presentation turns each into text.
export type DeclarationError =
  // No country was chosen, or no state or province where one is needed.
  | { kind: 'place-missing' }
  // The backend does not accept that country, or needs a state or province for it.
  | { kind: 'place-invalid' }
  // A different declaration is already recorded: a correction goes through support (P19§3).
  | { kind: 'conflict' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | undefined }
  | { kind: 'unavailable' };

export interface DeclarationFormState {
  status: 'idle' | 'recording' | 'recorded';
  error: DeclarationError | null;
  // Set once a declaration stands: what was declared, and the age that place asked for.
  recorded: { meetsAge: boolean; thresholdAge: number } | null;
  // The backend refused the place and may be asking for a state or province the screen did not
  // offer: it shows the field for any country from then on.
  needsSubdivision: boolean;
}

export interface DeclarationForm {
  store: StoreApi<DeclarationFormState>;
  // Records where the person lives and whether they have the age that place asks for. `true`
  // when a declaration now stands, whichever way it was answered.
  submit(country: string, subdivision: string, meetsAge: boolean): Promise<boolean>;
}

export interface DeclarationFormDeps {
  compliance: ComplianceClient;
}

// The residence-and-age declaration a gated function asks for (P19§1, D-038). It is a
// declaration and never a verification: no date of birth, no documents (P19§2). Answering below
// the threshold is recorded and binding, and the function stays restricted (P19§3).
export function createDeclarationForm(deps: DeclarationFormDeps): DeclarationForm {
  const store = createStore<DeclarationFormState>(() => ({
    status: 'idle',
    error: null,
    recorded: null,
    needsSubdivision: false,
  }));

  const fail = (error: DeclarationError) => {
    store.setState({ status: 'idle', error });
    return false as const;
  };

  return {
    store,
    async submit(country, subdivision, meetsAge) {
      if (!country) return fail({ kind: 'place-missing' });
      store.setState({ status: 'recording', error: null });
      const result = await deps.compliance.recordDeclaration(country, subdivision, meetsAge);
      if (!result.ok) {
        const failure = result.error;
        if (failure.kind === 'invalid-place') {
          store.setState({ needsSubdivision: true });
          return fail({ kind: 'place-invalid' });
        }
        if (failure.kind === 'conflict') return fail({ kind: 'conflict' });
        if (failure.kind === 'rate-limited') {
          return fail({ kind: 'rate-limited', retryAfterSeconds: failure.retryAfterSeconds });
        }
        return fail({ kind: 'unavailable' });
      }
      store.setState({
        status: 'recorded',
        error: null,
        recorded: { meetsAge, thresholdAge: result.value.thresholdAge },
      });
      return true;
    },
  };
}
