// Builds an authoring project into what the backend stores for a game version: the backend script,
// the frontend HTML, the runtime manifest and the build record. Responsibility and boundaries: see
// ../README.md.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { checkSource } from './check.ts';
import { buildClient } from './client.ts';
import { loadProject, ProjectError, type Diagnostic, type Project } from './project.ts';
import { buildServer, smokeTest } from './server.ts';
import { typecheck } from './typecheck.ts';

export { checkSource } from './check.ts';
export type { Diagnostic } from './project.ts';

// The backend scriptcheck profile the script is built for.
export const compileProfile = 'sdk-v1';
export const buildFormat = 'playhoot.build.v1';

export interface Artifact {
  sha256: string;
  bytes: number;
}

export interface BuildRecord {
  format: typeof buildFormat;
  profile: typeof compileProfile;
  aspectRatio: string;
  server: Artifact;
  client: Artifact;
}

export type BuildResult =
  | {
      ok: true;
      record: BuildRecord;
      server: string;
      client: string;
      manifest: unknown;
    }
  | { ok: false; diagnostics: Diagnostic[] };

export async function build(root: string): Promise<BuildResult> {
  let project: Project;
  try {
    project = await loadProject(root);
  } catch (error) {
    if (error instanceof ProjectError) return { ok: false, diagnostics: error.diagnostics };
    throw error;
  }

  const sourceDiagnostics: Diagnostic[] = [];
  for (const file of project.files) {
    sourceDiagnostics.push(...checkSource(file, await readFile(join(root, file), 'utf8')));
  }
  const diagnostics = [...sourceDiagnostics, ...typecheck(project)];
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  let server;
  let client;
  try {
    [server, client] = await Promise.all([buildServer(project), buildClient(project)]);
  } catch (error) {
    return { ok: false, diagnostics: [{ stage: 'bundle', message: (error as Error).message }] };
  }
  const players = (server.manifest as { players: { min: number } }).players.min;
  const runtime = smokeTest(server.script, players);
  if (runtime.length > 0) return { ok: false, diagnostics: runtime };

  return {
    ok: true,
    server: server.script,
    client,
    manifest: server.manifest,
    record: {
      format: buildFormat,
      profile: compileProfile,
      aspectRatio: project.aspectRatio,
      server: artifact(server.script),
      client: artifact(client),
    },
  };
}

// Writes a successful build as server.js, client.html, manifest.json and build.json.
export async function writeBuild(result: Extract<BuildResult, { ok: true }>, out: string) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'server.js'), result.server);
  await writeFile(join(out, 'client.html'), result.client);
  await writeFile(join(out, 'manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  await writeFile(join(out, 'build.json'), JSON.stringify(result.record, null, 2) + '\n');
}

function artifact(content: string): Artifact {
  const bytes = Buffer.from(content, 'utf8');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}
