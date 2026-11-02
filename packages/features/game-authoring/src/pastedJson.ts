// What a person pasted from their AI, read strictly as data: one JSON object, or that JSON inside
// ONE wrapping code fence (how chats show it). Code is never guessed out of free text and truncated
// JSON is never repaired: either the whole text is the document or it is refused.

export type PastedJsonError =
  // Nothing was pasted.
  | { kind: 'empty' }
  // Text around or between code fences, more than one fence, or JSON that is not an object.
  | { kind: 'not-an-envelope' }
  // Not valid JSON (often a reply cut off before its end).
  | { kind: 'not-json' };

export type PastedJson =
  { ok: true; value: Record<string, unknown> } | { ok: false; error: PastedJsonError };

const singleFence = /^```[\w.+-]*[ \t]*\r?\n([\s\S]*?)\r?\n```$/;

export function readPastedJson(text: string): PastedJson {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: { kind: 'empty' } };

  let json = trimmed;
  if (trimmed.startsWith('```')) {
    const fenced = singleFence.exec(trimmed);
    if (!fenced || fenced[1]!.includes('```')) {
      return { ok: false, error: { kind: 'not-an-envelope' } };
    }
    json = fenced[1]!;
  } else if (trimmed.includes('```')) {
    return { ok: false, error: { kind: 'not-an-envelope' } };
  }

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: { kind: 'not-json' } };
  }
  if (!isRecord(value)) return { ok: false, error: { kind: 'not-an-envelope' } };
  return { ok: true, value };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
