import type { AcceptanceText, ComplianceClient, ComplianceFailure } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createAcceptanceStep } from './acceptance';
import { createDeclarationForm } from './declaration';

const text = (kind: string, accepted: boolean, version = 3): AcceptanceText => ({
  kind,
  version,
  language: 'en',
  content: `the ${kind}`,
  publishedAt: '2026-11-16T00:00:00Z',
  accepted,
});

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = (error: ComplianceFailure) => ({ ok: false as const, error });

function client(overrides: Partial<ComplianceClient> = {}): ComplianceClient {
  return {
    readText: vi.fn(async (kind: string) => ok(text(kind, false))),
    textDownloadUrl: (kind: string) => `/v1/compliance/texts/${kind}?download=1`,
    recordAcceptance: vi.fn(async () => ok('recorded')),
    recordDeclaration: vi.fn(async () => ok({ outcome: 'recorded', thresholdAge: 18 })),
    ...overrides,
  };
}

describe('createAcceptanceStep', () => {
  it('asks only for the texts this person has not accepted, at the version read', async () => {
    const compliance = client({
      readText: vi.fn(async (kind: string) => ok(text(kind, kind === 'terms'))),
    });
    const step = createAcceptanceStep({ compliance });

    await step.load('en');

    expect(step.store.getState()).toMatchObject({
      status: 'pending',
      texts: [{ kind: 'own-data', version: 3, language: 'en' }],
    });
  });

  it('asks for nothing when every text already stands accepted', async () => {
    const compliance = client({ readText: vi.fn(async (kind: string) => ok(text(kind, true))) });
    const step = createAcceptanceStep({ compliance });

    await step.load('en');

    expect(step.store.getState()).toMatchObject({ status: 'none', texts: [] });
  });

  it('never holds the way in when a text cannot be read or is not published yet', async () => {
    const compliance = client({ readText: vi.fn(async () => err({ kind: 'not-published' })) });
    const step = createAcceptanceStep({ compliance });

    await step.load('en');

    expect(step.store.getState()).toMatchObject({ status: 'none', texts: [] });
  });

  it('records one acceptance per kind, each at its own version', async () => {
    const compliance = client();
    const step = createAcceptanceStep({ compliance });
    await step.load('pt');

    expect(await step.accept()).toBe(true);

    expect(compliance.recordAcceptance).toHaveBeenCalledTimes(2);
    expect(compliance.recordAcceptance).toHaveBeenCalledWith(
      'terms',
      3,
      'en',
      'accepted',
      'registration',
    );
    expect(step.store.getState().status).toBe('none');
  });

  it('keeps asking when recording did not go through', async () => {
    const compliance = client({
      recordAcceptance: vi.fn(async () =>
        err({ kind: 'unavailable', failure: { kind: 'network', message: 'down' } }),
      ),
    });
    const step = createAcceptanceStep({ compliance });
    await step.load('en');

    expect(await step.accept()).toBe(false);

    expect(step.store.getState()).toMatchObject({ status: 'pending', failed: true });
  });
});

describe('createDeclarationForm', () => {
  it('records the declaration and keeps the age the place asked for', async () => {
    const compliance = client();
    const form = createDeclarationForm({ compliance });

    expect(await form.submit('CO', '', true)).toBe(true);

    expect(compliance.recordDeclaration).toHaveBeenCalledWith('CO', '', true);
    expect(form.store.getState()).toMatchObject({
      status: 'recorded',
      recorded: { meetsAge: true, thresholdAge: 18 },
    });
  });

  it('asks for a state or province once the backend refuses the place', async () => {
    const compliance = client({
      recordDeclaration: vi.fn(async () => err({ kind: 'invalid-place' })),
    });
    const form = createDeclarationForm({ compliance });

    expect(await form.submit('US', '', true)).toBe(false);

    expect(form.store.getState()).toMatchObject({
      needsSubdivision: true,
      error: { kind: 'place-invalid' },
    });
  });

  it('reports a declaration that contradicts one already recorded', async () => {
    const compliance = client({ recordDeclaration: vi.fn(async () => err({ kind: 'conflict' })) });
    const form = createDeclarationForm({ compliance });

    expect(await form.submit('CO', '', true)).toBe(false);

    expect(form.store.getState().error).toEqual({ kind: 'conflict' });
  });

  it('does not ask the backend without a country', async () => {
    const compliance = client();
    const form = createDeclarationForm({ compliance });

    expect(await form.submit('', '', true)).toBe(false);

    expect(compliance.recordDeclaration).not.toHaveBeenCalled();
    expect(form.store.getState().error).toEqual({ kind: 'place-missing' });
  });

  it('records a declaration below the threshold as the standing one', async () => {
    const compliance = client({
      recordDeclaration: vi.fn(async () => ok({ outcome: 'recorded', thresholdAge: 21 })),
    });
    const form = createDeclarationForm({ compliance });

    expect(await form.submit('US', 'CA', false)).toBe(true);

    expect(form.store.getState().recorded).toEqual({ meetsAge: false, thresholdAge: 21 });
  });
});
