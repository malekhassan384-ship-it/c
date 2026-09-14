import { describe, it, expect } from 'vitest';
import { Position, Game, START_FEN } from '../../src/chess';
import { moveToSan } from '../../src/chess/san';

describe('FEN round-trip', () => {
  it('start position', () => {
    expect(Position.fromFEN(START_FEN).toFEN()).toBe(START_FEN);
  });
  it('rejects broken FENs', () => {
    expect(() => Position.fromFEN('not a fen')).toThrow();
    expect(() => Position.fromFEN('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow(); // no kings
  });
});

describe('specific rules', () => {
  it('castling both sides executed and rook relocation correct', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(g.playUci('e1g1')!.san).toBe('O-O');
    expect(g.playUci('e8c8')!.san).toBe('O-O-O');
    expect(g.position.pieceAt(5)).not.toBe(0); // white rook f1
    expect(g.position.pieceAt(112 + 3)).not.toBe(0); // black rook d8
  });
  it('castling forbidden through attacked square', () => {
    // black rook on f-file prevents white O-O (f1 attacked)
    const g = new Game('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');
    expect(g.isLegal('e1g1')).toBe(false);
    expect(g.isLegal('e1c1')).toBe(true);
  });
  it('en passant capture removes the bypassed pawn', () => {
    const g = new Game('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
    const r = g.playUci('e5d6');
    expect(r).not.toBeNull();
    expect(g.position.pieceAt(67)).toBe(0); // d5 pawn gone (sq 64+3=67)
  });
  it('promotion including underpromotion counts 4 moves', () => {
    const pos = Position.fromFEN('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const promoMoves = pos.generateMoves().filter(m => m.promo !== 0);
    expect(promoMoves.length).toBe(4);
    const g = new Game('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.playUci('a7a8n')).not.toBeNull();
  });
  it('checkmate detection: fool\'s mate', () => {
    const g = new Game();
    g.playUci('f2f3'); g.playUci('e7e5'); g.playUci('g2g4'); g.playUci('d8h4');
    const out = g.outcome();
    expect(out.over).toBe(true);
    expect(out.reason).toBe('checkmate');
    expect(out.winner).toBe('black');
    expect(g.sanMoves[3]).toBe('Qh4#');
  });
  it('stalemate detection', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    const out = g.outcome();
    expect(out.over).toBe(true);
    expect(out.reason).toBe('stalemate');
  });
  it('SAN disambiguation: two knights to same square', () => {
    // knights on c3 (sq 34) and e3 (38) both reach d5 (67)
    const pos = Position.fromFEN('4k3/8/8/8/8/2N1N3/8/4K3 w - - 0 1');
    const san1 = moveToSan(pos, { from: 34, to: 67, promo: 0, flags: 0 });
    const san2 = moveToSan(pos, { from: 36, to: 67, promo: 0, flags: 0 }); // e3 = 4 + 2*16 = 36
    expect(san1).toBe('Ncd5');
    expect(san2).toBe('Ned5');
  });
  it('insufficient material draw: K+B vs K', () => {
    expect(Position.fromFEN('8/8/8/8/8/8/2B5/K1k5 w - - 0 1').insufficientMaterial()).toBe(true);
    expect(Position.fromFEN('8/8/8/8/8/8/2P5/K1k5 w - - 0 1').insufficientMaterial()).toBe(false);
  });
});
