// Every SDK fixture keeps scenarios with expectations under scenarios/. The backend plays them on
// the built fixtures and requires every expectation to hold (its play/session/internal/
// fixturescenarios test); here, without the backend, their shape is checked against the
// playhoot.scenario.v1 rules the platform applies when a project saves them.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = join(repository, 'fixtures/sdk-games');

const ops = new Set(['eq', 'ne', 'exists', 'absent', 'lt', 'lte', 'gt', 'gte', 'in', 'len']);
const pathPattern = /^$|^(\[\d+\])*[^.[\]]+(\[\d+\])*(\.[^.[\]]+(\[\d+\])*)*$/;

// Why a scenario document breaks the shape rules, if it does.
function problems(scenario: Record<string, unknown>): string[] {
  const found: string[] = [];
  const isInt = (value: unknown) => typeof value === 'number' && Number.isInteger(value);
  if (scenario.format !== 'playhoot.scenario.v1') found.push('format');
  if (!isInt(scenario.players)) found.push('players');
  if (!isInt(scenario.duration_ms)) found.push('duration_ms');
  const duration = scenario.duration_ms as number;
  for (const [i, step] of ((scenario.steps ?? []) as Record<string, unknown>[]).entries()) {
    if ((step.command === undefined) === (step.inputs === undefined)) found.push(`steps[${i}]`);
    if (!isInt(step.at_ms) || (step.at_ms as number) > duration) found.push(`steps[${i}].at_ms`);
  }
  for (const [i, hold] of ((scenario.holds ?? []) as Record<string, unknown>[]).entries()) {
    const from = hold.from_ms as number;
    const to = hold.to_ms as number;
    if (!isInt(from) || !isInt(to) || from < 0 || to <= from || to > duration) {
      found.push(`holds[${i}]`);
    }
    if (typeof hold.inputs !== 'object' || hold.inputs === null) found.push(`holds[${i}].inputs`);
  }
  const expectations = (scenario.expect ?? []) as Record<string, unknown>[];
  if (expectations.length === 0) found.push('expect: a fixture scenario states what must hold');
  for (const [i, expectation] of expectations.entries()) {
    const op = expectation.op as string;
    const of = expectation.of ?? 'global';
    if (of !== 'global' && !/^P[1-9]\d*$/.test(String(of))) found.push(`expect[${i}].of`);
    if (typeof expectation.path !== 'string' || !pathPattern.test(expectation.path)) {
      found.push(`expect[${i}].path`);
    }
    if (!ops.has(op)) found.push(`expect[${i}].op`);
    const hasValue = 'value' in expectation;
    if ((op === 'exists' || op === 'absent') === hasValue) found.push(`expect[${i}].value`);
    if (['lt', 'lte', 'gt', 'gte'].includes(op) && typeof expectation.value !== 'number') {
      found.push(`expect[${i}].value`);
    }
    if (op === 'in' && !Array.isArray(expectation.value)) found.push(`expect[${i}].value`);
    if (op === 'len' && !isInt(expectation.value)) found.push(`expect[${i}].value`);
    const at = expectation.at_ms;
    if (at !== undefined && (!isInt(at) || (at as number) < 0 || (at as number) > duration)) {
      found.push(`expect[${i}].at_ms`);
    }
  }
  return found;
}

describe('fixture scenarios', () => {
  it('every fixture keeps scenarios with expectations of a valid shape', async () => {
    const games = await readdir(fixtures, { withFileTypes: true });
    const checked: string[] = [];
    for (const game of games.filter((entry) => entry.isDirectory())) {
      const directory = join(fixtures, game.name, 'scenarios');
      const files = (await readdir(directory).catch(() => [] as string[])).filter((file) =>
        file.endsWith('.json'),
      );
      expect(files.length, `${game.name} keeps at least one scenario`).toBeGreaterThan(0);
      for (const file of files) {
        const scenario = JSON.parse(await readFile(join(directory, file), 'utf8')) as Record<
          string,
          unknown
        >;
        expect(problems(scenario), `${game.name}/scenarios/${file}`).toEqual([]);
        checked.push(`${game.name}/${file}`);
      }
    }
    expect(checked.length).toBeGreaterThanOrEqual(6);
  });

  it('refuses a broken scenario', () => {
    expect(
      problems({
        format: 'x',
        players: 2,
        duration_ms: 100,
        holds: [{ from_ms: 50, to_ms: 50, player: 'P1' }],
        expect: [{ of: 'all', path: 'a..b', op: 'gt', value: 'big' }],
      }),
    ).toEqual([
      'format',
      'holds[0]',
      'holds[0].inputs',
      'expect[0].of',
      'expect[0].path',
      'expect[0].value',
    ]);
  });
});
