/**
 * Deterministic puzzle generator — every emitted puzzle is PROVEN by the
 * exact mate solver (src/chess/solver.ts) before it is written to JSON.
 * Run: npm run gen:puzzles (wrapper scripts/generate-puzzles.mjs)
 * Output: src/puzzles/puzzles.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Position, onBoard, KING, QUEEN, ROOK, makePiece, WHITE, BLACK, moveToUci } from '../src/chess/position';
import { mateInMoves } from '../src/chess/solver';
import type { Puzzle } from '../src/puzzles/puzzle';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260824);
const rint = (n: number) => Math.floor(rnd() * n);
const ALL_SQUARES: number[] = [];
for (let s = 0; s < 128; s++) if (onBoard(s)) ALL_SQUARES.push(s);

function chebyshev(a: number, b: number): number {
  return Math.max(Math.abs((a & 15) - (b & 15)), Math.abs((a >> 4) - (b >> 4)));
}

/** Hand-crafted thematic candidates; each is solver-verified before acceptance. */
const THEMATIC_M1: Array<{ fen: string; theme: Puzzle['theme'] }> = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', theme: 'back-rank' },
  { fen: '6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1', theme: 'queen' },
  { fen: '7k/8/6QK/8/8/8/8/8 w - - 0 1', theme: 'queen' },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', theme: 'tactics' },
  { fen: '7k/8/8/8/8/8/6R1/K5R1 w - - 0 1', theme: 'rook' },
  { fen: '6rk/6pp/7N/8/8/8/8/K7 w - - 0 1', theme: 'knight' },
  { fen: '8/8/8/8/8/2k5/R7/1R4K1 w - - 0 1', theme: 'endgame' },
  { fen: '5k2/8/8/8/8/8/8/K2Q4 w - - 0 1', theme: 'queen' }
];

function buildKXvK(white2nd: typeof QUEEN | typeof ROOK): Position | null {
  const pos = new Position();
  pos.board.fill(0);
  const bK = ALL_SQUARES[rint(ALL_SQUARES.length)];
  // white king close to black king (mating net)
  const wKCandidates = ALL_SQUARES.filter(s => chebyshev(s, bK) <= 2 && s !== bK && chebyshev(s, bK) >= 1);
  if (!wKCandidates.length) return null;
  const wK = wKCandidates[rint(wKCandidates.length)];
  const pieceSq = ALL_SQUARES[rint(ALL_SQUARES.length)];
  if (pieceSq === bK || pieceSq === wK) return null;
  pos.board[bK] = makePiece(KING, BLACK);
  pos.board[wK] = makePiece(KING, WHITE);
  pos.board[pieceSq] = makePiece(white2nd, WHITE);
  pos.castling = 0;
  pos.ep = -1;
  pos.halfmove = 0;
  pos.fullmove = 1;
  pos.turn = WHITE;
  pos.kingSq = [wK, bK];
  // legality for "white to move": black king must not be in check already
  if (pos.isAttacked(bK, WHITE)) return null;
  // white king can never be in check here (black has only a king)
  return pos;
}

function main(): void {
  const m1: Puzzle[] = [];
  const m2: Puzzle[] = [];
  const seenFen = new Set<string>();

  for (const t of THEMATIC_M1) {
    let pos: Position;
    try { pos = Position.fromFEN(t.fen); } catch { continue; }
    const sols = mateInMoves(pos, 1);
    if (sols.length === 1) {
      if (seenFen.has(t.fen)) continue;
      seenFen.add(t.fen);
      m1.push({ id: `m1-thematic-${m1.length + 1}`, fen: t.fen, mateIn: 1, theme: t.theme, difficulty: 1, hintSquare: moveToUci(sols[0]).slice(0, 2) });
    } else {
      console.log(`[gen] dropped thematic (solutions=${sols.length}): ${t.fen}`);
    }
  }

  const WANT_M1 = 16, WANT_M2 = 8;
  let tries = 0;
  while ((m1.length < WANT_M1 || m2.length < WANT_M2) && tries < 60000) {
    tries++;
    const useQueen = tries % 2 === 0;
    const pos = buildKXvK(useQueen ? QUEEN : ROOK);
    if (!pos) continue;
    const fen = pos.toFEN();
    if (seenFen.has(fen)) continue;
    const s1 = mateInMoves(pos, 1);
    if (s1.length === 1 && m1.length < WANT_M1) {
      seenFen.add(fen);
      m1.push({ id: `m1-${String(m1.length + 1).padStart(3, '0')}`, fen, mateIn: 1, theme: useQueen ? 'queen' : 'rook', difficulty: 1, hintSquare: moveToUci(s1[0]).slice(0, 2) });
      continue;
    }
    if (s1.length === 0 && m2.length < WANT_M2) {
      const s2 = mateInMoves(pos, 2);
      if (s2.length === 1) {
        seenFen.add(fen);
        m2.push({ id: `m2-${String(m2.length + 1).padStart(3, '0')}`, fen, mateIn: 2, theme: useQueen ? 'endgame' : 'endgame', difficulty: 2, hintSquare: moveToUci(s2[0]).slice(0, 2) });
      }
    }
  }
  if (m1.length < WANT_M1 || m2.length < WANT_M2) {
    throw new Error(`quota not met after ${tries} tries: m1=${m1.length}/${WANT_M1} m2=${m2.length}/${WANT_M2}`);
  }
  const all = [...m1, ...m2];
  const out = join(process.cwd(), 'src', 'puzzles', 'puzzles.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedBy: 'scripts/generate-puzzles.mjs (solver-proven)', count: all.length, puzzles: all }, null, 2));
  console.log(`[gen] wrote ${all.length} puzzles (${m1.length} mate-in-1, ${m2.length} mate-in-2) after ${tries} random tries -> ${out}`);
}

main();
