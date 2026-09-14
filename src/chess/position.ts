/**
 * Chess Vanguard — core rules engine (proprietary, © 2026 Malek Hassan Ashour).
 * 0x88 mailbox board representation. Fully independent from Stockfish:
 * Stockfish runs ONLY as an external UCI subprocess (see src/engine).
 */

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const WHITE = 0;
export const BLACK = 1;

export type Color = 0 | 1;
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6;

/** piece = type | (color << 3)  → white: 1..6, black: 9..14 */
export function pieceType(p: number): number { return p & 7; }
export function pieceColor(p: number): Color { return ((p >> 3) & 1) as Color; }
export function makePiece(type: number, color: Color): number { return type | (color << 3); }

export const FLAG_NORMAL = 0;
export const FLAG_EP = 1;
export const FLAG_CASTLE_K = 2;
export const FLAG_CASTLE_Q = 3;
export const FLAG_DOUBLE = 4;

export interface Move {
  from: number;
  to: number;
  /** 0 = none, else promotion piece type (KNIGHT..QUEEN) */
  promo: number;
  flags: number;
}

export function moveEq(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && a.promo === b.promo;
}

export const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_OFFSETS = [16, -16, 1, -1, 15, 17, -15, -17];
const BISHOP_DIRS = [15, 17, -15, -17];
const ROOK_DIRS = [16, -16, 1, -1];

/** 0x88 helpers */
export function sq(file: number, rank: number): number { return rank * 16 + file; }
export function fileOf(s: number): number { return s & 15; }
export function rankOf(s: number): number { return s >> 4; }
export function onBoard(s: number): boolean { return (s & 0x88) === 0; }
export function algebraic(s: number): string { return String.fromCharCode(97 + fileOf(s)) + String.fromCharCode(49 + rankOf(s)); }
export function fromAlgebraic(a: string): number {
  const f = a.charCodeAt(0) - 97;
  const r = a.charCodeAt(1) - 49;
  return sq(f, r);
}

const PIECE_CHARS: Record<number, string> = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
const CHAR_PIECES: Record<string, number> = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 };

/** castling-rights mask per square (applied as castling &= mask[from] & mask[to]) */
const CASTLE_MASK = new Int32Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;      // a1
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ); // e1
CASTLE_MASK[7] = 15 & ~CASTLE_WK;      // h1
CASTLE_MASK[112] = 15 & ~CASTLE_BQ;    // a8
CASTLE_MASK[116] = 15 & ~(CASTLE_BK | CASTLE_BQ); // e8
CASTLE_MASK[119] = 15 & ~CASTLE_BK;    // h8

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface HistoryEntry {
  move: Move;
  captured: number;
  capturedSq: number;
  prevCastling: number;
  prevEp: number;
  prevHalfmove: number;
  prevFullmove: number;
  prevKingW: number;
  prevKingB: number;
}

export class Position {
  board = new Int8Array(128);
  turn: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kingSq: [number, number] = [4, 116];
  private history: HistoryEntry[] = [];

  static fromFEN(fen: string): Position {
    const pos = new Position();
    pos.setFEN(fen);
    return pos;
  }

  setFEN(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error(`Invalid FEN (need at least 4 fields): ${fen}`);
    this.board.fill(0);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error(`Invalid FEN board (need 8 ranks): ${fen}`);
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[7 - r]) { // rows[0] is rank 8
        if (ch >= '1' && ch <= '8') { f += Number(ch); continue; }
        const lower = ch.toLowerCase();
        const type = CHAR_PIECES[lower.toUpperCase()];
        if (!type || f > 7) throw new Error(`Invalid FEN square '${ch}' in: ${fen}`);
        this.board[sq(f, r)] = makePiece(type, ch === lower ? BLACK : WHITE);
        f++;
      }
      if (f !== 8) throw new Error(`Invalid FEN rank width in: ${fen}`);
    }
    this.turn = parts[1] === 'w' ? WHITE : parts[1] === 'b' ? BLACK : (() => { throw new Error(`Invalid FEN turn: ${fen}`); })();
    this.castling = 0;
    if (parts[2] !== '-') {
      for (const c of parts[2]) {
        if (c === 'K') this.castling |= CASTLE_WK;
        else if (c === 'Q') this.castling |= CASTLE_WQ;
        else if (c === 'k') this.castling |= CASTLE_BK;
        else if (c === 'q') this.castling |= CASTLE_BQ;
        else throw new Error(`Invalid FEN castling '${c}': ${fen}`);
      }
    }
    this.ep = parts[3] === '-' ? -1 : fromAlgebraic(parts[3]);
    this.halfmove = parts.length > 4 ? Number(parts[4]) || 0 : 0;
    this.fullmove = parts.length > 5 ? Number(parts[5]) || 1 : 1;
    // locate kings
    let wk = -1, bk = -1;
    for (let s = 0; s < 128; s++) {
      if (!onBoard(s)) continue;
      const p = this.board[s];
      if (p === makePiece(KING, WHITE)) wk = s;
      else if (p === makePiece(KING, BLACK)) bk = s;
    }
    if (wk < 0 || bk < 0) throw new Error(`FEN missing a king: ${fen}`);
    this.kingSq = [wk, bk];
    this.history = [];
  }

  toFEN(): string {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[sq(f, r)];
        if (p === 0) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        const ch = PIECE_CHARS[pieceType(p)];
        out += pieceColor(p) === WHITE ? ch : ch.toLowerCase();
      }
      if (empty) out += empty;
      if (r > 0) out += '/';
    }
    out += this.turn === WHITE ? ' w ' : ' b ';
    let c = '';
    if (this.castling & CASTLE_WK) c += 'K';
    if (this.castling & CASTLE_WQ) c += 'Q';
    if (this.castling & CASTLE_BK) c += 'k';
    if (this.castling & CASTLE_BQ) c += 'q';
    out += (c || '-') + ' ';
    out += this.ep >= 0 ? algebraic(this.ep) : '-';
    out += ` ${this.halfmove} ${this.fullmove}`;
    return out;
  }

  /** position identity for repetition detection (ignores clocks) */
  key(): string {
    return this.toFEN().split(' ').slice(0, 4).join(' ');
  }

  clone(): Position {
    const p = new Position();
    p.board = Int8Array.from(this.board);
    p.turn = this.turn;
    p.castling = this.castling;
    p.ep = this.ep;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.kingSq = [this.kingSq[0], this.kingSq[1]];
    return p;
  }

  pieceAt(s: number): number { return this.board[s]; }

  isAttacked(target: number, byColor: Color): boolean {
    const b = this.board;
    // pawns
    if (byColor === WHITE) {
      for (const d of [-15, -17]) {
        const s = target + d;
        if (onBoard(s) && b[s] === makePiece(PAWN, WHITE)) return true;
      }
    } else {
      for (const d of [15, 17]) {
        const s = target + d;
        if (onBoard(s) && b[s] === makePiece(PAWN, BLACK)) return true;
      }
    }
    // knights
    const kn = makePiece(KNIGHT, byColor);
    for (const d of KNIGHT_OFFSETS) {
      const s = target + d;
      if (onBoard(s) && b[s] === kn) return true;
    }
    // king
    const kg = makePiece(KING, byColor);
    for (const d of KING_OFFSETS) {
      const s = target + d;
      if (onBoard(s) && b[s] === kg) return true;
    }
    // rook / queen
    const rk = makePiece(ROOK, byColor), qn = makePiece(QUEEN, byColor);
    for (const d of ROOK_DIRS) {
      let s = target + d;
      while (onBoard(s)) {
        const p = b[s];
        if (p !== 0) { if (p === rk || p === qn) return true; break; }
        s += d;
      }
    }
    // bishop / queen
    const bp = makePiece(BISHOP, byColor);
    for (const d of BISHOP_DIRS) {
      let s = target + d;
      while (onBoard(s)) {
        const p = b[s];
        if (p !== 0) { if (p === bp || p === qn) return true; break; }
        s += d;
      }
    }
    return false;
  }

  inCheck(color: Color = this.turn): boolean {
    return this.isAttacked(this.kingSq[color], (color ^ 1) as Color);
  }

  /** all strictly-legal moves for the side to move */
  generateMoves(): Move[] {
    const res: Move[] = [];
    const mover = this.turn;
    const pseudo = this.generatePseudo();
    for (const m of pseudo) {
      this.make(m);
      if (!this.isAttacked(this.kingSq[mover], (mover ^ 1) as Color)) res.push(m);
      this.unmake();
    }
    return res;
  }

  private generatePseudo(): Move[] {
    const res: Move[] = [];
    const us = this.turn;
    const them = (us ^ 1) as Color;
    const b = this.board;
    for (let s = 0; s < 128; s++) {
      if (!onBoard(s)) continue;
      const p = b[s];
      if (p === 0 || pieceColor(p) !== us) continue;
      const t = pieceType(p);
      if (t === PAWN) {
        const fwd = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const promoRank = us === WHITE ? 7 : 0;
        const one = s + fwd;
        if (onBoard(one) && b[one] === 0) {
          if (rankOf(one) === promoRank) {
            for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) res.push({ from: s, to: one, promo, flags: FLAG_NORMAL });
          } else {
            res.push({ from: s, to: one, promo: 0, flags: FLAG_NORMAL });
            if (rankOf(s) === startRank) {
              const two = s + 2 * fwd;
              if (b[two] === 0) res.push({ from: s, to: two, promo: 0, flags: FLAG_DOUBLE });
            }
          }
        }
        for (const d of (us === WHITE ? [15, 17] : [-15, -17])) {
          const to = s + d;
          if (!onBoard(to)) continue;
          const tp = b[to];
          if (tp !== 0 && pieceColor(tp) === them) {
            if (rankOf(to) === promoRank) {
              for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) res.push({ from: s, to, promo, flags: FLAG_NORMAL });
            } else {
              res.push({ from: s, to, promo: 0, flags: FLAG_NORMAL });
            }
          } else if (tp === 0 && to === this.ep) {
            res.push({ from: s, to, promo: 0, flags: FLAG_EP });
          }
        }
      } else if (t === KNIGHT || t === KING) {
        const offs = t === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (const d of offs) {
          const to = s + d;
          if (!onBoard(to)) continue;
          const tp = b[to];
          if (tp === 0 || pieceColor(tp) === them) res.push({ from: s, to, promo: 0, flags: FLAG_NORMAL });
        }
      } else {
        const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const d of dirs) {
          let to = s + d;
          while (onBoard(to)) {
            const tp = b[to];
            if (tp === 0) { res.push({ from: s, to, promo: 0, flags: FLAG_NORMAL }); }
            else {
              if (pieceColor(tp) === them) res.push({ from: s, to, promo: 0, flags: FLAG_NORMAL });
              break;
            }
            to += d;
          }
        }
      }
    }
    // castling
    if (us === WHITE && b[4] === makePiece(KING, WHITE)) {
      if ((this.castling & CASTLE_WK) && b[5] === 0 && b[6] === 0 && b[7] === makePiece(ROOK, WHITE)
        && !this.isAttacked(4, BLACK) && !this.isAttacked(5, BLACK) && !this.isAttacked(6, BLACK)) {
        res.push({ from: 4, to: 6, promo: 0, flags: FLAG_CASTLE_K });
      }
      if ((this.castling & CASTLE_WQ) && b[3] === 0 && b[2] === 0 && b[1] === 0 && b[0] === makePiece(ROOK, WHITE)
        && !this.isAttacked(4, BLACK) && !this.isAttacked(3, BLACK) && !this.isAttacked(2, BLACK)) {
        res.push({ from: 4, to: 2, promo: 0, flags: FLAG_CASTLE_Q });
      }
    } else if (us === BLACK && b[116] === makePiece(KING, BLACK)) {
      if ((this.castling & CASTLE_BK) && b[117] === 0 && b[118] === 0 && b[119] === makePiece(ROOK, BLACK)
        && !this.isAttacked(116, WHITE) && !this.isAttacked(117, WHITE) && !this.isAttacked(118, WHITE)) {
        res.push({ from: 116, to: 118, promo: 0, flags: FLAG_CASTLE_K });
      }
      if ((this.castling & CASTLE_BQ) && b[115] === 0 && b[114] === 0 && b[113] === 0 && b[112] === makePiece(ROOK, BLACK)
        && !this.isAttacked(116, WHITE) && !this.isAttacked(115, WHITE) && !this.isAttacked(114, WHITE)) {
        res.push({ from: 116, to: 114, promo: 0, flags: FLAG_CASTLE_Q });
      }
    }
    return res;
  }

  make(m: Move): void {
    const us = this.turn;
    const piece = this.board[m.from];
    let captured = this.board[m.to];
    let capturedSq = m.to;
    if (m.flags === FLAG_EP) {
      capturedSq = m.to + (us === WHITE ? -16 : 16);
      captured = this.board[capturedSq];
      this.board[capturedSq] = 0;
    }
    this.history.push({
      move: m, captured, capturedSq,
      prevCastling: this.castling, prevEp: this.ep,
      prevHalfmove: this.halfmove, prevFullmove: this.fullmove,
      prevKingW: this.kingSq[0], prevKingB: this.kingSq[1]
    });
    this.board[m.from] = 0;
    this.board[m.to] = m.promo ? makePiece(m.promo, us) : piece;
    if (m.flags === FLAG_CASTLE_K) {
      const rank0 = us === WHITE ? 0 : 7 * 16;
      this.board[rank0 + 7] = 0;
      this.board[rank0 + 5] = makePiece(ROOK, us);
    } else if (m.flags === FLAG_CASTLE_Q) {
      const rank0 = us === WHITE ? 0 : 7 * 16;
      this.board[rank0 + 0] = 0;
      this.board[rank0 + 3] = makePiece(ROOK, us);
    }
    if (pieceType(piece) === KING) this.kingSq[us] = m.to;
    this.ep = m.flags === FLAG_DOUBLE ? m.from + (us === WHITE ? 16 : -16) : -1;
    this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    this.halfmove = (pieceType(piece) === PAWN || captured !== 0) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = (us ^ 1) as Color;
  }

  unmake(): void {
    const st = this.history.pop();
    if (!st) throw new Error('unmake on empty history');
    const m = st.move;
    this.turn = (this.turn ^ 1) as Color;
    const us = this.turn;
    const moved = this.board[m.to];
    this.board[m.from] = m.promo ? makePiece(PAWN, us) : moved;
    this.board[m.to] = 0;
    if (st.captured !== 0) this.board[st.capturedSq] = st.captured;
    if (m.flags === FLAG_CASTLE_K) {
      const rank0 = us === WHITE ? 0 : 7 * 16;
      this.board[rank0 + 7] = makePiece(ROOK, us);
      this.board[rank0 + 5] = 0;
    } else if (m.flags === FLAG_CASTLE_Q) {
      const rank0 = us === WHITE ? 0 : 7 * 16;
      this.board[rank0 + 0] = makePiece(ROOK, us);
      this.board[rank0 + 3] = 0;
    }
    this.castling = st.prevCastling;
    this.ep = st.prevEp;
    this.halfmove = st.prevHalfmove;
    this.fullmove = st.prevFullmove;
    this.kingSq[0] = st.prevKingW;
    this.kingSq[1] = st.prevKingB;
  }

  /** how many plies have been made on this position object */
  plyCount(): number { return this.history.length; }

  /** undo-all support used by solvers/UI analysis */
  undoAll(): void { while (this.history.length) this.unmake(); }

  perft(depth: number): number {
    if (depth <= 0) return 1;
    const moves = this.generateMoves();
    if (depth === 1) return moves.length;
    let nodes = 0;
    for (const m of moves) {
      this.make(m);
      nodes += this.perft(depth - 1);
      this.unmake();
    }
    return nodes;
  }

  /** per-root-move perft split (debugging aid) */
  perftDivide(depth: number): Array<{ move: string; nodes: number }> {
    const out: Array<{ move: string; nodes: number }> = [];
    for (const m of this.generateMoves()) {
      this.make(m);
      const n = depth <= 1 ? 1 : this.perft(depth - 1);
      this.unmake();
      out.push({ move: moveToUci(m), nodes: n });
    }
    return out;
  }

  insufficientMaterial(): boolean {
    const knights = [0, 0];
    const bishops: Array<{ color: Color; sqColor: number }> = [];
    for (let s = 0; s < 128; s++) {
      if (!onBoard(s)) continue;
      const p = this.board[s];
      if (p === 0) continue;
      const t = pieceType(p);
      if (t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT) knights[pieceColor(p)]++;
      if (t === BISHOP) bishops.push({ color: pieceColor(p), sqColor: (fileOf(s) + rankOf(s)) & 1 });
    }
    const totalMinors = knights[0] + knights[1] + bishops.length;
    if (totalMinors <= 1) return true; // K vs K, K+N vs K, K+B vs K
    if (knights[0] + knights[1] === 0 && bishops.length >= 2 && bishops.every(b => b.sqColor === bishops[0].sqColor)) return true;
    return false;
  }
}

const PROMO_CHARS: Record<number, string> = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };

export function moveToUci(m: Move): string {
  return algebraic(m.from) + algebraic(m.to) + (m.promo ? PROMO_CHARS[m.promo] : '');
}

export function uciToMove(pos: Position, uci: string): Move | null {
  if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(uci)) return null;
  const legal = pos.generateMoves();
  for (const m of legal) if (moveToUci(m) === uci) return m;
  return null;
}
