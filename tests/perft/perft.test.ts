import { describe, it, expect } from 'vitest';
import { Position } from '../../src/chess/position';

/**
 * Perft — the numeric proof that the rules engine is correct.
 * Reference values: standard perft suite (chessprogramming.org "Perft Results").
 * ANY mismatch is a hard failure. No test may be skipped or weakened.
 */

interface PerftCase {
  name: string;
  fen: string;
  depths: Array<[number, number]>;
}

const CASES: PerftCase[] = [
  {
    name: 'initial position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depths: [[1, 20], [2, 400], [3, 8902], [4, 197281], [5, 4865609]]
  },
  {
    name: 'kiwipete (castling/discovered/pin heavy)',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depths: [[1, 48], [2, 2039], [3, 97862], [4, 4085603]]
  },
  {
    name: 'position 3 (en-passant heavy)',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depths: [[1, 14], [2, 191], [3, 2812], [4, 43238], [5, 674624]]
  },
  {
    name: 'position 4 (promotions)',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depths: [[1, 6], [2, 264], [3, 9467], [4, 422333]]
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depths: [[1, 44], [2, 1486], [3, 62379], [4, 2103487]]
  },
  {
    name: 'position 6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    depths: [[1, 46], [2, 2079], [3, 89890], [4, 3894594]]
  }
];

describe('perft correctness suite', () => {
  for (const c of CASES) {
    it(`${c.name}: ${c.fen}`, () => {
      const pos = Position.fromFEN(c.fen);
      // FEN round-trip sanity
      expect(pos.toFEN()).toBe(c.fen);
      for (const [depth, expected] of c.depths) {
        const pos2 = Position.fromFEN(c.fen);
        const t0 = Date.now();
        const nodes = pos2.perft(depth);
        const ms = Date.now() - t0;
        console.log(`perft(${depth}) ${c.name} = ${nodes} (expected ${expected}) [${ms} ms]`);
        expect(nodes, `${c.name} depth ${depth}`).toBe(expected);
      }
    });
  }

  it('state integrity: make/unmake leaves identical FEN through full search', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const pos = Position.fromFEN(fen);
    pos.perft(3);
    expect(pos.toFEN()).toBe(fen);
    expect(pos.plyCount()).toBe(0);
  });
});
