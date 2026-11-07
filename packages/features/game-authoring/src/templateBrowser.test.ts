import type { GamesClient, TemplateEntry } from '@playhoot/communication';
import { describe, expect, it, vi } from 'vitest';

import { createGameAuthoring } from './gameAuthoring';
import { createTemplateBrowser } from './templateBrowser';

const quiz: TemplateEntry = {
  gameUUID: 't-1',
  name: 'Quiz',
  description: 'A quiz',
  categories: ['trivia'],
  playersMin: 1,
  playersMax: 30,
  languages: ['es'],
  featured: true,
};

describe('createTemplateBrowser', () => {
  it('loads the featured templates, searches and inspects one', async () => {
    const games = {
      browseTemplates: vi.fn(async () => ({
        ok: true as const,
        value: { featured: [quiz], categories: [{ name: 'trivia', templates: 1 }] },
      })),
      searchTemplates: vi.fn(async () => ({
        ok: true as const,
        value: { page: 1, templates: [quiz], more: false },
      })),
      inspectTemplate: vi.fn(async () => ({
        ok: true as const,
        value: {
          gameUUID: 't-1',
          name: 'Quiz',
          description: '',
          featured: true,
          revision: 9,
          brief: { goal: 'Answer right' },
          players: { min: 1, max: 30 },
          commands: ['answer'],
          configurable: [],
          files: [],
        },
      })),
    } as unknown as GamesClient;
    const browser = createTemplateBrowser({ games });

    await browser.load();
    expect(browser.store.getState()).toMatchObject({ status: 'ready', featured: [quiz] });
    await browser.search({ text: 'quiz', page: 1 });
    expect(browser.store.getState().search).toMatchObject({
      status: 'done',
      page: { templates: [quiz] },
    });
    await browser.inspect('t-1');
    expect(browser.store.getState().inspected).toMatchObject({
      status: 'done',
      details: { commands: ['answer'] },
    });
    browser.closeInspection();
    expect(browser.store.getState().inspected).toBeNull();
  });

  it('answers an empty catalog as ready, with nothing to show', async () => {
    const games = {
      browseTemplates: vi.fn(async () => ({
        ok: true as const,
        value: { featured: [], categories: [] },
      })),
    } as unknown as GamesClient;
    const browser = createTemplateBrowser({ games });
    await browser.load();
    expect(browser.store.getState()).toMatchObject({
      status: 'ready',
      featured: [],
      categories: [],
    });
  });
});

describe('useTemplate on a draft', () => {
  it('switches the current revision to the template, with one key per attempt', async () => {
    const draft = {
      gameUUID: 'g-1',
      versionUUID: 'v-1',
      status: 'DRAFT',
      currentRevision: 3,
      revision: 3,
      files: [],
      assets: [],
      assetDiagnostics: [],
      attempts: [],
      build: null,
      lastSuccessfulBuild: null,
    };
    const useTemplate = vi.fn(async () => ({
      ok: true as const,
      value: { outcome: 'applied', revision: 4, buildStatus: 'QUEUED', asset: null },
    }));
    const games = {
      readDraft: vi.fn(async () => ({ ok: true as const, value: draft })),
      readBuild: vi.fn(async () => ({ ok: false as const, error: { kind: 'not-found' as const } })),
      useTemplate,
    } as unknown as GamesClient;
    const authoring = createGameAuthoring({ games, gameUUID: 'g-1', newKey: () => 'k-1' });
    await authoring.reload();

    const result = await authoring.useTemplate('t-1');

    expect(useTemplate).toHaveBeenCalledWith('g-1', 't-1', 3, 'k-1');
    expect(result).toEqual({ action: 'template', kind: 'applied', revision: 4 });
  });
});
