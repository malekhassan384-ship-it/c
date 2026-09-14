import { Position, Move, START_FEN, uciToMove, pieceColor, Color } from './position';
import { moveToSan } from './san';

export type GameResult = 'white' | 'black' | 'draw' | null;

export interface GameOutcome {
  over: boolean;
  winner: GameResult; // 'white' | 'black' | 'draw' when over
  reason: 'checkmate' | 'stalemate' | 'fifty-move' | 'threefold' | 'insufficient-material' | null;
}

/** High-level game controller used by UI: SAN history, undo, result detection. */
export class Game {
  readonly startFen: string;
  position: Position;
  uciMoves: string[] = [];
  sanMoves: string[] = [];
  private keys: string[] = [];

  constructor(fen: string = START_FEN) {
    this.startFen = fen;
    this.position = Position.fromFEN(fen);
    this.keys.push(this.position.key());
  }

  legalMoves(): Move[] { return this.position.generateMoves(); }

  isLegal(uci: string): boolean { return uciToMove(this.position, uci) !== null; }

  /** apply a move; returns {uci, san} or null if illegal */
  playUci(uci: string): { uci: string; san: string } | null {
    const m = uciToMove(this.position, uci);
    if (!m) return null;
    const san = moveToSan(this.position, m);
    this.position.make(m);
    this.uciMoves.push(uci);
    this.sanMoves.push(san);
    this.keys.push(this.position.key());
    return { uci, san };
  }

  /** undo one ply; returns the uci of the undone move, or null */
  undo(): string | null {
    if (!this.uciMoves.length) return null;
    const uci = this.uciMoves[this.uciMoves.length - 1];
    this.position.unmake();
    this.uciMoves.pop();
    this.sanMoves.pop();
    this.keys.pop();
    return uci;
  }

  repetitions(): number {
    const k = this.position.key();
    return this.keys.filter(x => x === k).length;
  }

  outcome(): GameOutcome {
    const moves = this.legalMoves();
    if (moves.length === 0) {
      if (this.position.inCheck()) {
        return { over: true, winner: this.position.turn === 0 ? 'black' : 'white', reason: 'checkmate' };
      }
      return { over: true, winner: 'draw', reason: 'stalemate' };
    }
    if (this.position.halfmove >= 100) return { over: true, winner: 'draw', reason: 'fifty-move' };
    if (this.repetitions() >= 3) return { over: true, winner: 'draw', reason: 'threefold' };
    if (this.position.insufficientMaterial()) return { over: true, winner: 'draw', reason: 'insufficient-material' };
    return { over: false, winner: null, reason: null };
  }
}

export { moveToSan, pieceColor };
export type { Color, Move };
