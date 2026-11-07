// The authoring project's layout and its `game.project.json`.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { gameLanguages, type GameLanguage } from '@playhoot/game-core';

import { configFile, loadConfig, type Config } from './config.ts';

export const projectFormat = 'playhoot.project.v1';

// The logical viewports the backend offers (play_game_versions.aspect_ratio).
export const aspectRatios = ['16:9', '9:16', '4:3', '3:4', '1:1'] as const;
export type AspectRatio = (typeof aspectRatios)[number];

// Where the build reads each part. `shared/` is optional.
export const serverEntry = 'server/game.ts';
export const clientEntry = 'client/Game.tsx';
export const sourceAreas = ['shared', 'server', 'client'] as const;
export type SourceArea = (typeof sourceAreas)[number];

// The asset types the backend stores (gameversion in ../playhoot) and the key pattern it accepts.
export const assetTypes = ['image', 'audio', 'video'] as const;
export type AssetType = (typeof assetTypes)[number];
const assetKeyPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const maxAssetDescriptionLength = 300;

// One asset game.project.json declares; the client reaches it through `@playhoot/assets`.
export interface DeclaredAsset {
  type: AssetType;
  optional: boolean;
}

export interface Project {
  root: string;
  aspectRatio: AspectRatio;
  // The languages the game is written in, its main one first.
  languages: [GameLanguage, ...GameLanguage[]];
  // Declared assets by key, in key order.
  assets: Record<string, DeclaredAsset>;
  // The configurable values: their declaration and the values the game is built with.
  config: Config;
  // Source files relative to root, with forward slashes.
  files: string[];
}

export interface Diagnostic {
  stage: 'project' | 'source' | 'types' | 'bundle' | 'manifest' | 'runtime';
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export class ProjectError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join('\n'));
    this.diagnostics = diagnostics;
  }
}

export function areaOf(file: string): SourceArea | null {
  const top = file.split('/')[0];
  return (sourceAreas as readonly string[]).includes(top ?? '') ? (top as SourceArea) : null;
}

export async function loadProject(root: string): Promise<Project> {
  const problems: Diagnostic[] = [];
  const problem = (message: string, file = 'game.project.json') =>
    problems.push({ stage: 'project', message, file });

  let declared: Record<string, unknown> = {};
  try {
    declared = JSON.parse(await readFile(join(root, 'game.project.json'), 'utf8'));
  } catch (error) {
    problem(`game.project.json is missing or is not JSON: ${(error as Error).message}`);
  }
  if (declared.format !== projectFormat) problem(`"format" must be "${projectFormat}"`);
  const aspectRatio = declared.aspectRatio ?? '16:9';
  if (!(aspectRatios as readonly unknown[]).includes(aspectRatio)) {
    problem(`"aspectRatio" must be one of ${aspectRatios.join(', ')}`);
  }

  const languages = declaredLanguages(declared.languages, problem);
  const assets = declaredAssets(declared.assets, problem);
  let valuesText: string | null = null;
  try {
    valuesText = await readFile(join(root, configFile), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const config = loadConfig(declared.config, valuesText, languages, problem);

  const files: string[] = [];
  for (const area of sourceAreas) {
    for (const file of await listFiles(join(root, area))) {
      const path = relative(root, file).split(sep).join('/');
      if (/\.(ts|tsx)$/.test(path)) files.push(path);
      else problem('only .ts and .tsx files are allowed in source folders', path);
    }
  }
  for (const entry of [serverEntry, clientEntry]) {
    if (!files.includes(entry)) problem(`${entry} is required`, entry);
  }
  if (problems.length > 0) throw new ProjectError(problems);
  return {
    root,
    aspectRatio: aspectRatio as AspectRatio,
    languages: languages as [GameLanguage, ...GameLanguage[]],
    assets,
    config,
    files: files.sort(),
  };
}

// The "languages" declaration, checked with the backend's rules (draftsources in ../playhoot): one
// or more of Playhoot's languages, without repeats, the main one first.
function declaredLanguages(declared: unknown, problem: (message: string) => void): GameLanguage[] {
  const message = `"languages" lists the languages the game is written in, its main one first: one or more of ${gameLanguages.join(', ')}`;
  if (!Array.isArray(declared) || declared.length === 0) {
    problem(message);
    return [];
  }
  const languages: GameLanguage[] = [];
  for (const language of declared) {
    if (!(gameLanguages as readonly unknown[]).includes(language)) {
      problem(`${message}; "${String(language)}" is not one of them`);
    } else if (languages.includes(language as GameLanguage)) {
      problem(`${message}; "${String(language)}" is listed twice`);
    } else {
      languages.push(language as GameLanguage);
    }
  }
  return languages;
}

// The "assets" declaration, checked with the backend's rules (draftsources in ../playhoot).
function declaredAssets(
  declared: unknown,
  problem: (message: string) => void,
): Record<string, DeclaredAsset> {
  const assets: Record<string, DeclaredAsset> = {};
  if (declared === undefined) return assets;
  if (typeof declared !== 'object' || declared === null || Array.isArray(declared)) {
    problem('"assets" is an object of asset keys');
    return assets;
  }
  for (const key of Object.keys(declared).sort()) {
    const asset = (declared as Record<string, unknown>)[key];
    if (!assetKeyPattern.test(key)) {
      problem(
        `asset "${key}": keys start with a letter and hold up to 64 letters, digits or underscores`,
      );
      continue;
    }
    if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) {
      problem(`asset "${key}": each asset is an object {"type", "description", "optional"}`);
      continue;
    }
    const { type, description, optional } = asset as Record<string, unknown>;
    if (!(assetTypes as readonly unknown[]).includes(type)) {
      problem(`asset "${key}": "type" is image, audio or video`);
      continue;
    }
    const text = typeof description === 'string' ? description.trim() : '';
    if (text === '' || text.length > maxAssetDescriptionLength) {
      problem(
        `asset "${key}": "description" says what to upload, in 1 to ${maxAssetDescriptionLength} characters`,
      );
      continue;
    }
    if (optional !== undefined && typeof optional !== 'boolean') {
      problem(`asset "${key}": "optional" is true or false`);
      continue;
    }
    assets[key] = { type: type as AssetType, optional: optional === true };
  }
  return assets;
}

// The module `@playhoot/project` the client imports: the languages the game is written in.
export function projectModule(project: Project, typed: boolean): string {
  return `export const languages = ${JSON.stringify(project.languages)}${typed ? ' as const' : ''};
`;
}

// The module `@playhoot/assets` the client imports: one handle per declared asset. typed says
// whether it is the type-checked TypeScript or the bundled JavaScript.
export function assetsModule(project: Project, typed: boolean): string {
  const handles: Record<string, { key: string; type: AssetType; optional: boolean }> = {};
  for (const [key, asset] of Object.entries(project.assets)) {
    handles[key] = { key, type: asset.type, optional: asset.optional };
  }
  return `export const assets = ${JSON.stringify(handles)}${typed ? ' as const' : ''};\n`;
}

async function listFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}
