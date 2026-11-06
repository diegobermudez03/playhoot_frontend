import type { DraftChange, DraftFileEdit } from '@playhoot/communication';
import { projectChangeFormat } from '@playhoot/protocol';

import { isRecord, readPastedJson, type PastedJsonError } from './pastedJson';

// The change envelope a person pasted from their AI, read strictly as data (`readPastedJson`).

export type PastedChangeError =
  | PastedJsonError
  // JSON, but another format or none.
  | { kind: 'wrong-format'; found: string | null }
  // The envelope's fields are missing or of the wrong type.
  | { kind: 'malformed'; field: string }
  // The same path twice, or written, edited and deleted in more than one way (a path may have
  // several edits).
  | { kind: 'repeated-path'; path: string };

export interface ChangeSummary {
  added: string[];
  modified: string[];
  // Files changed by find/replace edits, with how many edits each, in the order first edited.
  edited: { path: string; edits: number }[];
  deleted: string[];
}

export type PastedChange =
  | { ok: true; change: DraftChange; summary: ChangeSummary }
  | { ok: false; error: PastedChangeError };

// Reads `text` against the paths the draft holds now, which tell added files from modified ones.
export function parsePastedChange(text: string, currentPaths: readonly string[]): PastedChange {
  const read = readPastedJson(text);
  if (!read.ok) return refused(read.error);
  const value = read.value;
  if (value.format !== projectChangeFormat) {
    return refused({
      kind: 'wrong-format',
      found: typeof value.format === 'string' ? value.format : null,
    });
  }
  const base = value.base_revision;
  if (typeof base !== 'number' || !Number.isInteger(base) || base < 0) {
    return refused({ kind: 'malformed', field: 'base_revision' });
  }
  // `files` and `edits` may each be absent; whatever the change holds, the backend refuses an
  // empty one.
  const pastedFiles = value.files ?? [];
  if (!Array.isArray(pastedFiles)) return refused({ kind: 'malformed', field: 'files' });
  const pastedEdits = value.edits ?? [];
  if (!Array.isArray(pastedEdits)) return refused({ kind: 'malformed', field: 'edits' });
  const deleted = value.delete ?? [];
  if (!Array.isArray(deleted) || !deleted.every((path) => typeof path === 'string')) {
    return refused({ kind: 'malformed', field: 'delete' });
  }

  const files: DraftChange['files'] = [];
  for (const file of pastedFiles as unknown[]) {
    if (!isRecord(file) || typeof file.path !== 'string' || typeof file.content !== 'string') {
      return refused({ kind: 'malformed', field: 'files' });
    }
    files.push({ path: file.path, content: file.content });
  }
  const edits: DraftFileEdit[] = [];
  for (const edit of pastedEdits as unknown[]) {
    if (
      !isRecord(edit) ||
      typeof edit.path !== 'string' ||
      typeof edit.find !== 'string' ||
      typeof edit.replace !== 'string' ||
      (edit.all !== undefined && typeof edit.all !== 'boolean')
    ) {
      return refused({ kind: 'malformed', field: 'edits' });
    }
    edits.push({
      path: edit.path,
      find: edit.find,
      replace: edit.replace,
      ...(edit.all === true ? { all: true } : {}),
    });
  }

  const edited = new Map<string, number>();
  for (const edit of edits) edited.set(edit.path, (edited.get(edit.path) ?? 0) + 1);
  const seen = new Set<string>();
  for (const path of [
    ...files.map((file) => file.path),
    ...edited.keys(),
    ...(deleted as string[]),
  ]) {
    if (seen.has(path)) return refused({ kind: 'repeated-path', path });
    seen.add(path);
  }

  const existing = new Set(currentPaths);
  return {
    ok: true,
    change: {
      baseRevision: base,
      files,
      ...(edits.length > 0 ? { edits } : {}),
      delete: deleted as string[],
    },
    summary: {
      added: files.filter((file) => !existing.has(file.path)).map((file) => file.path),
      modified: files.filter((file) => existing.has(file.path)).map((file) => file.path),
      edited: [...edited].map(([path, count]) => ({ path, edits: count })),
      deleted: [...(deleted as string[])],
    },
  };
}

function refused(error: PastedChangeError): PastedChange {
  return { ok: false, error };
}
