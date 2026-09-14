import { Position, Move } from './position';

/**
 * Exact small mate solver (used for puzzle validation/generation and runtime
 * puzzle answer checking). Pure search over the internal rules engine —
 * independent from Stockfish.
 */

/** Returns ALL first moves that force mate in exactly <= n moves (n white/black moves). */
export function mateInMoves(pos: Position, n: number): Move[] {
  const solvers: Move[] = [];
  for (const m of pos.generateMoves()) {
    if (moveForcesMate(pos, m, n)) solvers.push(m);
  }
  return solvers;
}

function moveForcesMate(pos: Position, m: Move, n: number): boolean {
  pos.make(m);
  try {
    const replies = pos.generateMoves();
    if (replies.length === 0) {
      // immediate mate counts only if n >= 1 and it IS mate (check)
      return pos.inCheck() && n >= 1;
    }
    if (n <= 1) return false; // opponent still has moves, cannot mate within n
    // every opponent reply must be answerable by forced mate in n-1
    for (const r of replies) {
      pos.make(r);
      let answered = false;
      for (const m2 of pos.generateMoves()) {
        if (moveForcesMate(pos, m2, n - 1)) { answered = true; break; }
      }
      pos.unmake();
      if (!answered) return false;
    }
    return true;
  } finally {
    pos.unmake();
  }
}
