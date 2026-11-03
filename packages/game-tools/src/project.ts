// The authoring project's layout and its `game.project.json`.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export const projectFormat = 'playhoot.project.v1';

// The logical viewports the backend offers (play_game_versions.aspect_ratio).
export const aspectRatios = ['16:9', '9:16', '4:3', '3:4', '1:1'] as const;
export type AspectRatio = (typeof aspectRatios)[number];

// Where the build reads each part. `shared/` is optional.
export const serverEntry = 'server/game.ts';
export const clientEntry = 'client/Game.tsx';
export const sourceAreas = ['shared', 'server', 'client'] as const;
export type SourceArea = (typeof sourceAreas)[number];

export interface Project {
  root: string;
  aspectRatio: AspectRatio;
  // Source files relative to root, with forward slashes.
  files: string[];
}

export interface Diagnostic {
  stage: 'project' | 'source' | 'types' | 'bundle' | 'runtime';
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
    files: files.sort(),
  };
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
