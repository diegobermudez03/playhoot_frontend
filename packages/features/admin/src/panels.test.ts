import type { AdminClient, HttpFailure, SecondFactorClient } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createBudgetPanel } from './budgetPanel';
import { createEmailPanel } from './emailPanel';
import { createEnrollment } from './enrollment';
import { adminFailure } from './failures';
import { createMarketsPanel } from './marketsPanel';
import { createQueuesPanel } from './queuesPanel';
import { createTextsPanel } from './textsPanel';

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const httpError = (
  status: number,
  code?: string,
  retryAfterSeconds?: number,
): { ok: false; error: HttpFailure } => ({
  ok: false,
  error: { kind: 'http', status, code, message: '', retryAfterSeconds },
});

const deadTask = (taskUUID: string) => ({
  domain: 'notifications',
  task_uuid: taskUUID,
  type: 'send-email',
  attempts: 5,
  last_error: 'provider refused',
  admin_retries: 0,
  created_at: '2026-11-16T10:00:00Z',
  died_at: '2026-11-16T10:05:00Z',
});

const budgetStatus = {
  ladder: {
    level: 'normal',
    paused_categories: [],
    reopen_closed: [],
    reason: '',
    actor: '',
  },
  caps: [],
  rates: [],
  usage: [],
  active_reservations: 0,
  last_hour_usd: 0,
  hours_to_month_cap: null,
  rate_missing: [],
};

function adminClient(overrides: Partial<AdminClient> = {}): AdminClient {
  return {
    deadTasks: vi.fn(async () => ok({ tasks: [], unavailable: [] })),
    retryDeadTask: vi.fn(async () => ok('retried')),
    cancelDeadTask: vi.fn(async () => ok('cancelled')),
    budget: vi.fn(async () => ok(budgetStatus)),
    setControls: vi.fn(async () => ok('applied')),
    cutoff: vi.fn(async () => ok('shut_down')),
    reopen: vi.fn(async () => ok('reopened')),
    email: vi.fn(async () =>
      ok({ mode: 'automatic', mode_since: '', mode_reason: '', deliveries_30d: {} }),
    ),
    setEmailMode: vi.fn(async () => ok('changed')),
    markets: vi.fn(async () => ok({ current: [], scheduled: [], history: [] })),
    setMarketRule: vi.fn(async () => ok('recorded')),
    texts: vi.fn(async () => ok({ texts: [] })),
    publishText: vi.fn(async () =>
      ok({ kind: 'terms', language: 'en', version: 1, published_at: '' }),
    ),
    ...overrides,
  } as AdminClient;
}

function secondFactor(overrides: Partial<SecondFactorClient> = {}): SecondFactorClient {
  return {
    enroll: vi.fn(async () =>
      ok({ secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/x', expires_at: '' }),
    ),
    confirm: vi.fn(async () => ok(undefined)),
    adminToken: vi.fn(),
    stepUpProof: vi.fn(async () =>
      ok({ purpose: 'step_up', step_up_proof: 'proof', expires_at: '' }),
    ),
    ...overrides,
  } as SecondFactorClient;
}

describe('adminFailure', () => {
  it.each([
    [httpError(401, 'token_invalid'), 'signed-out'],
    [httpError(403, 'step_up_required'), 'step-up-required'],
    [httpError(403, 'not_admin'), 'not-admin'],
    [httpError(429, 'locked', 900), 'locked'],
    [httpError(400, 'invalid_code'), 'invalid-code'],
    [httpError(409, 'no_pending_enrollment'), 'no-pending-enrollment'],
    [httpError(404, 'task_not_found'), 'not-found'],
    [httpError(503), 'unavailable'],
    [httpError(400), 'invalid'],
  ])('reads %o as its kind', (failure, kind) => {
    expect(adminFailure(failure.error).kind).toBe(kind);
  });

  it('carries the wait of a lockout', () => {
    expect(adminFailure(httpError(429, 'locked', 900).error)).toEqual({
      kind: 'locked',
      retryAfterSeconds: 900,
    });
  });

  it('keeps a conflict this build does not know as a conflict', () => {
    expect(adminFailure(httpError(409, 'something_new').error)).toEqual({
      kind: 'conflict',
      code: 'something_new',
    });
  });
});

describe('createQueuesPanel', () => {
  it('lists dead tasks and the domains that could not be read', async () => {
    const panel = createQueuesPanel({
      admin: adminClient({
        deadTasks: async () => ok({ tasks: [deadTask('t1')], unavailable: ['play'] }),
      }),
    });
    await panel.refresh();
    expect(panel.store.getState().status).toBe('ready');
    expect(panel.store.getState().tasks).toHaveLength(1);
    expect(panel.store.getState().unavailable).toEqual(['play']);
  });

  it('treats a task that is no longer dead as a notice, not a failure, and reads the list again', async () => {
    const deadTasks = vi.fn(async () => ok({ tasks: [], unavailable: [] }));
    const panel = createQueuesPanel({
      admin: adminClient({ deadTasks, retryDeadTask: async () => ok('not_dead') }),
    });
    await panel.retry('t1');
    expect(panel.store.getState().result).toBe('not-dead');
    expect(panel.store.getState().error).toBeNull();
    expect(deadTasks).toHaveBeenCalledTimes(1);
  });

  it('reports a task that is gone and refreshes', async () => {
    const panel = createQueuesPanel({
      admin: adminClient({ cancelDeadTask: async () => httpError(404, 'task_not_found') }),
    });
    await panel.cancel('t1');
    expect(panel.store.getState().result).toBe('gone');
    expect(panel.store.getState().error).toBeNull();
  });
});

describe('createBudgetPanel', () => {
  it('spends a fresh code as the proof of one action', async () => {
    const cutoff = vi.fn(async () => ok('shut_down'));
    const stepUpProof = vi.fn(async () =>
      ok({ purpose: 'step_up', step_up_proof: 'proof-1', expires_at: '' }),
    );
    const panel = createBudgetPanel({
      admin: adminClient({ cutoff }),
      secondFactor: secondFactor({ stepUpProof }),
    });
    await expect(panel.cutoff('123456', 'runaway retries')).resolves.toBe(true);
    expect(stepUpProof).toHaveBeenCalledWith('123456');
    expect(cutoff).toHaveBeenCalledWith({ reason: 'runaway retries', step_up_proof: 'proof-1' });
    expect(panel.store.getState().result).toEqual({ action: 'cutoff', outcome: 'shut_down' });
  });

  it('asks for another code when the proof is refused', async () => {
    const panel = createBudgetPanel({
      admin: adminClient({ cutoff: async () => httpError(403, 'step_up_required') }),
      secondFactor: secondFactor(),
    });
    await expect(panel.cutoff('123456', 'why')).resolves.toBe(false);
    expect(panel.store.getState().actionError).toEqual({ kind: 'step-up-required' });
  });

  it('sends no categories on the first step out of shutdown', async () => {
    const reopen = vi.fn(async () => ok('reopened'));
    const panel = createBudgetPanel({
      admin: adminClient({ reopen }),
      secondFactor: secondFactor(),
    });
    await panel.reopen('123456', [], 'reviewed');
    expect(reopen).toHaveBeenCalledWith({ reason: 'reviewed', step_up_proof: 'proof' });
    await panel.reopen('123456', ['ai'], 'open ai');
    expect(reopen).toHaveBeenLastCalledWith({
      categories: ['ai'],
      reason: 'open ai',
      step_up_proof: 'proof',
    });
  });

  it('stops at a wrong code without calling the action', async () => {
    const cutoff = vi.fn();
    const panel = createBudgetPanel({
      admin: adminClient({ cutoff }),
      secondFactor: secondFactor({ stepUpProof: async () => httpError(400, 'invalid_code') }),
    });
    await expect(panel.cutoff('000000', 'why')).resolves.toBe(false);
    expect(cutoff).not.toHaveBeenCalled();
    expect(panel.store.getState().actionError).toEqual({ kind: 'invalid-code' });
  });
});

describe('createEmailPanel', () => {
  it('changes the mode with its reason and reads the status again', async () => {
    const setEmailMode = vi.fn(async () => ok('changed'));
    const email = vi.fn(async () =>
      ok({ mode: 'ses-only', mode_since: '', mode_reason: 'quota', deliveries_30d: { sent: 3 } }),
    );
    const panel = createEmailPanel({ admin: adminClient({ setEmailMode, email }) });
    await expect(panel.setMode('ses-only', 'quota')).resolves.toBe(true);
    expect(setEmailMode).toHaveBeenCalledWith({ mode: 'ses-only', reason: 'quota' });
    expect(panel.store.getState().email?.mode).toBe('ses-only');
    expect(panel.store.getState().result).toBe('changed');
  });

  it('keeps a refused mode out of the panel', async () => {
    const panel = createEmailPanel({
      admin: adminClient({ setEmailMode: async () => httpError(400, 'invalid') }),
    });
    await expect(panel.setMode('nonsense', 'why')).resolves.toBe(false);
    expect(panel.store.getState().actionError).toEqual({ kind: 'invalid' });
  });
});

describe('createMarketsPanel', () => {
  const rule: Parameters<ReturnType<typeof createMarketsPanel>['appendRule']>[0] = {
    country: 'CO',
    subdivision: '',
    function: 'create-games',
    enabled: true,
    min_age: 18,
    conditions_note: '',
    reason: 'launch',
  };

  it('reads the matrix again after appending a rule', async () => {
    const setMarketRule = vi.fn(async () => ok('recorded'));
    const markets = vi.fn(async () => ok({ current: [], scheduled: [], history: [] }));
    const panel = createMarketsPanel({ admin: adminClient({ setMarketRule, markets }) });
    await expect(panel.appendRule(rule)).resolves.toBe(true);
    expect(setMarketRule).toHaveBeenCalledWith(rule);
    expect(markets).toHaveBeenCalledTimes(1);
    expect(panel.store.getState().result).toBe('recorded');
  });

  it('keeps conditions_pending as a conflict the admin must clear first', async () => {
    const panel = createMarketsPanel({
      admin: adminClient({
        setMarketRule: async () => httpError(409, 'conditions_pending'),
      }),
    });
    await expect(panel.appendRule(rule)).resolves.toBe(false);
    expect(panel.store.getState().actionError).toEqual({
      kind: 'conflict',
      code: 'conditions_pending',
    });
  });
});

describe('createTextsPanel', () => {
  it('reads the catalog again after publishing a version', async () => {
    const publishText = vi.fn(async () =>
      ok({ kind: 'terms', language: 'en', version: 2, published_at: '2026-11-16T10:00:00Z' }),
    );
    const texts = vi.fn(async () => ok({ texts: [] }));
    const panel = createTextsPanel({ admin: adminClient({ publishText, texts }) });
    await expect(
      panel.publish({ kind: 'terms', language: 'en', content: 'The terms.' }),
    ).resolves.toBe(true);
    expect(publishText).toHaveBeenCalledWith({
      kind: 'terms',
      language: 'en',
      content: 'The terms.',
    });
    expect(texts).toHaveBeenCalledTimes(1);
    expect(panel.store.getState().result?.version).toBe(2);
  });

  it('keeps an invalid publication out of the catalog', async () => {
    const panel = createTextsPanel({
      admin: adminClient({ publishText: async () => httpError(400, 'invalid') }),
    });
    await expect(panel.publish({ kind: 'terms', language: 'en', content: '' })).resolves.toBe(
      false,
    );
    expect(panel.store.getState().actionError).toEqual({ kind: 'invalid' });
  });
});

describe('createEnrollment', () => {
  it('shows the secret once and confirms it with the first code', async () => {
    const enrollment = createEnrollment({ secondFactor: secondFactor() });
    await enrollment.start();
    expect(enrollment.store.getState().step).toBe('pending');
    expect(enrollment.store.getState().pending?.secret).toBe('JBSWY3DPEHPK3PXP');
    await enrollment.confirm('123456');
    expect(enrollment.store.getState().step).toBe('confirmed');
    expect(enrollment.store.getState().pending).toBeNull();
  });

  it('asks for a current code when a credential is already in use', async () => {
    const enroll = vi.fn(async () => httpError(400, 'current_code_required'));
    const enrollment = createEnrollment({ secondFactor: secondFactor({ enroll }) });
    await expect(enrollment.start()).resolves.toBe(false);
    expect(enrollment.store.getState().error).toEqual({ kind: 'current-code-required' });
  });

  it('takes the secret away when the pending enrollment lapsed', async () => {
    const enrollment = createEnrollment({
      secondFactor: secondFactor({ confirm: async () => httpError(409, 'no_pending_enrollment') }),
    });
    await enrollment.start();
    await enrollment.confirm('123456');
    expect(enrollment.store.getState().step).toBe('idle');
    expect(enrollment.store.getState().pending).toBeNull();
    expect(enrollment.store.getState().error).toEqual({ kind: 'no-pending-enrollment' });
  });
});
