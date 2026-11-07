// The SDK guide for AI agents (apps/web/public/docs/sdk/v1) must never drift from the SDK: every
// TypeScript example is a file, or part of a file, of a fixture project the tools build here, and
// every JSON example parses.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sdkVersion } from '@playhoot/game-core';

import { build } from './build.ts';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const guide = join(repository, 'apps/web/public/docs/sdk/v1');
const exampleProjects = [
  'fixtures/sdk-games/tap-race',
  'fixtures/sdk-games/number-guess',
  'fixtures/sdk-games/pairs',
  'fixtures/sdk-games/drift',
  'fixtures/sdk-games/quiz',
  'fixtures/sdk-games/know-me',
];

interface CodeBlock {
  page: string;
  language: string;
  content: string;
  example?: string;
}

async function pages(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await pages(path)));
    else if (entry.name.endsWith('.md')) found.push(path);
  }
  return found;
}

function codeBlocks(page: string, text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const opening = /^```(\w*)$/.exec(lines[i] ?? '');
    if (!opening) continue;
    const end = lines.indexOf('```', i + 1);
    if (end < 0) throw new Error(`${page}: unclosed code block at line ${i + 1}`);
    const marker = /^<!-- example: (\S+) -->$/.exec(lines[i - 1] ?? '');
    blocks.push({
      page,
      language: opening[1] ?? '',
      content: lines.slice(i + 1, end).join('\n'),
      ...(marker?.[1] !== undefined && { example: marker[1] }),
    });
    i = end;
  }
  return blocks;
}

// Building the fixtures is a real build each, several seconds under a loaded machine.
describe('the SDK guide', { timeout: 60_000 }, async () => {
  const files = await pages(guide);
  const texts = new Map(
    await Promise.all(
      files.map(
        async (file) =>
          [relative(guide, file).split(sep).join('/'), await readFile(file, 'utf8')] as const,
      ),
    ),
  );
  const blocks = [...texts].flatMap(([page, text]) => codeBlocks(page, text));

  it('quotes every TypeScript example from a fixture project, exactly', async () => {
    for (const block of blocks) {
      if (block.language === 'ts' || block.language === 'tsx' || block.example !== undefined) {
        expect(
          block.example,
          `${block.page}: a ${block.language} block needs an example marker`,
        ).toBeDefined();
        expect(exampleProjects.some((project) => block.example?.startsWith(project + '/'))).toBe(
          true,
        );
        const source = (await readFile(join(repository, block.example ?? ''), 'utf8')).replace(
          /\r\n/g,
          '\n',
        );
        expect(source, `${block.page} quotes ${block.example}`).toContain(block.content);
      }
    }
  });

  it('serves every page as finished text, without template placeholders', () => {
    for (const [page, text] of texts) {
      expect(text, `${page} holds an unresolved placeholder`).not.toMatch(/\{\{\s*slice:/);
    }
  });

  it('writes only valid JSON in JSON examples', () => {
    for (const block of blocks.filter((b) => b.language === 'json')) {
      expect(() => JSON.parse(block.content), `${block.page}: invalid JSON`).not.toThrow();
    }
  });

  it('lists every page in its index, and every listed page exists', () => {
    const index = texts.get('index.md') ?? '';
    for (const page of texts.keys()) {
      if (page !== 'index.md') expect(index, `index.md lists ${page}`).toContain('`' + page + '`');
    }
    for (const [, listed] of index.matchAll(/^- `([^`]+\.md)`/gm)) {
      expect(texts.has(listed ?? ''), `index.md lists ${listed}`).toBe(true);
    }
  });

  it('names the SDK version it describes, and indexes only pages that exist', () => {
    const capabilities = texts.get('capabilities.md') ?? '';
    expect(capabilities).toContain(`SDK version ${sdkVersion}.`);
    expect(texts.get('index.md')).toContain(`(SDK ${sdkVersion})`);
    for (const [, cited] of capabilities.matchAll(/`([\w/-]+\.md)`/g)) {
      expect(texts.has(cited ?? ''), `capabilities.md cites ${cited}`).toBe(true);
    }
  });

  it('marks rules only with the three labels index.md defines', () => {
    for (const [page, text] of texts) {
      for (const [, label] of text.matchAll(/\*\*([A-Z][a-z]+(?: [a-z]+)*)(?:,[^*]*)?:\*\*/g)) {
        expect(['Required', 'Recommended', 'Escape hatch'], `${page}: **${label}:**`).toContain(
          label,
        );
      }
    }
  });

  it.each(exampleProjects)('builds the example project %s', async (project) => {
    const result = await build(join(repository, project));
    expect(result.ok ? [] : result.diagnostics).toEqual([]);
  });
});
