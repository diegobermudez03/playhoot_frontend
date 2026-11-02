import type { DraftChange } from '@playhoot/communication';
import { projectChangeFormat } from '@playhoot/protocol';

// What a person pasted from their AI, read strictly as data: the change envelope as JSON, or that
// JSON inside ONE wrapping code fence (how chats show it). Code is never guessed out of free text
// and truncated JSON is never repaired: either the whole text is an envelope or it is refused.

export type PastedChangeError =
  // Nothing was pasted.
  | { kind: 'empty' }
  // Text around or between code fences, or more than one fence.
  | { kind: 'not-an-envelope' }
  // Not valid JSON (often a reply cut off before its end).
  | { kind: 'not-json' }
  // JSON, but another format or none.
  | { kind: 'wrong-format'; found: string | null }
  // The envelope's fields are missing or of the wrong type.
  | { kind: 'malformed'; field: string }
  // The same path twice, or written and deleted at once.
  | { kind: 'repeated-path'; path: string };

export interface ChangeSummary {
  added: string[];
  modified: string[];
  deleted: string[];
}

export type PastedChange =
  | { ok: true; change: DraftChange; summary: ChangeSummary }
  | { ok: false; error: PastedChangeError };

const singleFence = /^```[\w.+-]*[ \t]*\r?\n([\s\S]*?)\r?\n```$/;

// Reads `text` against the paths the draft holds now, which tell added files from modified ones.
export function parsePastedChange(text: string, currentPaths: readonly string[]): PastedChange {
  const trimmed = text.trim();
  if (trimmed === '') return refused({ kind: 'empty' });

  let json = trimmed;
  if (trimmed.startsWith('```')) {
    const fenced = singleFence.exec(trimmed);
    if (!fenced || fenced[1]!.includes('```')) return refused({ kind: 'not-an-envelope' });
    json = fenced[1]!;
  } else if (trimmed.includes('```')) {
    return refused({ kind: 'not-an-envelope' });
  }

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return refused({ kind: 'not-json' });
  }
  if (!isRecord(value)) return refused({ kind: 'not-an-envelope' });
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
  if (!Array.isArray(value.files)) return refused({ kind: 'malformed', field: 'files' });
  const deleted = value.delete ?? [];
  if (!Array.isArray(deleted) || !deleted.every((path) => typeof path === 'string')) {
    return refused({ kind: 'malformed', field: 'delete' });
  }

  const files: DraftChange['files'] = [];
  for (const file of value.files as unknown[]) {
    if (!isRecord(file) || typeof file.path !== 'string' || typeof file.content !== 'string') {
      return refused({ kind: 'malformed', field: 'files' });
    }
    files.push({ path: file.path, content: file.content });
  }

  const seen = new Set<string>();
  for (const path of [...files.map((file) => file.path), ...(deleted as string[])]) {
    if (seen.has(path)) return refused({ kind: 'repeated-path', path });
    seen.add(path);
  }

  const existing = new Set(currentPaths);
  return {
    ok: true,
    change: { baseRevision: base, files, delete: deleted as string[] },
    summary: {
      added: files.filter((file) => !existing.has(file.path)).map((file) => file.path),
      modified: files.filter((file) => existing.has(file.path)).map((file) => file.path),
      deleted: [...(deleted as string[])],
    },
  };
}

function refused(error: PastedChangeError): PastedChange {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
