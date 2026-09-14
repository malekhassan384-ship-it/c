/** Puzzle schema — solvability is machine-proven by tests/unit/content.test.ts via the mate solver. */

export interface Puzzle {
  id: string;
  fen: string;
  mateIn: 1 | 2; // mover (White in all puzzles) mates within this many moves
  theme: 'back-rank' | 'queen' | 'rook' | 'knight' | 'promotion' | 'endgame' | 'tactics';
  difficulty: 1 | 2 | 3;
  /** optional hint square (algebraic) shown in the hint */
  hintSquare?: string;
}
