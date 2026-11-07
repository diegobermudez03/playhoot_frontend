import type { DraftFile } from '@playhoot/communication';
import { validateBrief, type Brief, type BriefPhase } from '@playhoot/game-core/brief';

// The draft's brief.json as the workspace shows it: the agreed game and the phase of the work.
export type DraftBrief =
  | { status: 'absent' }
  // Only a brief written before the backend checked it can be invalid: shown as such, not read.
  | { status: 'invalid' }
  | { status: 'valid'; brief: Brief; phase: BriefPhase };

export const briefPath = 'brief.json';

// Reads the brief among the draft's files (read with their content).
export function draftBrief(files: readonly DraftFile[]): DraftBrief {
  const file = files.find((candidate) => candidate.path === briefPath);
  if (!file || file.content === null) return { status: 'absent' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return { status: 'invalid' };
  }
  const checked = validateBrief(parsed);
  return checked.ok
    ? { status: 'valid', brief: checked.brief, phase: checked.phase }
    : { status: 'invalid' };
}
