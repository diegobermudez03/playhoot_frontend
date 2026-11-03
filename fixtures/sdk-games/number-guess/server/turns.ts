// Turn order helpers. Plain functions over plain data: the only kind of top-level code allowed.

export const TURN_MS = 15000;

export type Turns = { order: string[]; current: number; endsAt: number };

export function firstTurn(players: string[]): Turns {
  return { order: [...players], current: 0, endsAt: TURN_MS };
}

export function playerToMove(turns: Turns): string | null {
  return turns.order[turns.current] ?? null;
}

// Moves to the next player and restarts the turn clock from `now`.
export function advance(turns: Turns, now: number): void {
  turns.current = turns.order.length === 0 ? 0 : (turns.current + 1) % turns.order.length;
  turns.endsAt = now + TURN_MS;
}

// Takes a player out of the order, keeping the turn with whoever was next.
export function remove(turns: Turns, player: string): void {
  const index = turns.order.indexOf(player);
  if (index < 0) return;
  turns.order.splice(index, 1);
  if (index < turns.current) turns.current -= 1;
  if (turns.current >= turns.order.length) turns.current = 0;
}
