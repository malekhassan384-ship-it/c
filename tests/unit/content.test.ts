import { describe, it, expect } from 'vitest';
import puzzlesJson from '../../src/puzzles/puzzles.json';
import { Position, uciToMove, moveToUci } from '../../src/chess/position';
import { mateInMoves } from '../../src/chess/solver';
import { LESSONS } from '../../src/academy/lessons';
import { localeParity } from '../../src/localization/i18n';
import type { Puzzle } from '../../src/puzzles/puzzle';

const DATA = puzzlesJson as { count: number; puzzles: Puzzle[] };

describe('puzzle content is solver-proven', () => {
  it('count metadata matches', () => {
    expect(DATA.puzzles.length).toBe(DATA.count);
    expect(DATA.puzzles.length).toBeGreaterThanOrEqual(24);
  });

  it('unique ids and valid FENs', () => {
    const ids = new Set<string>();
    for (const p of DATA.puzzles) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(() => Position.fromFEN(p.fen)).not.toThrow();
    }
  });

  it('every mate-in-1 puzzle has EXACTLY ONE solution and no faster ambiguity', () => {
    for (const p of DATA.puzzles.filter(x => x.mateIn === 1)) {
      const pos = Position.fromFEN(p.fen);
      const sols = mateInMoves(pos, 1);
      expect(sols.length, `${p.id} should have exactly 1 mating move`).toBe(1);
    }
  });

  it('every mate-in-2 puzzle: no mate-in-1 exists, exactly ONE key move forces mate in 2', () => {
    for (const p of DATA.puzzles.filter(x => x.mateIn === 2)) {
      const pos = Position.fromFEN(p.fen);
      expect(mateInMoves(pos, 1).length, `${p.id} must NOT be mate-in-1`).toBe(0);
      const sols = mateInMoves(pos, 2);
      expect(sols.length, `${p.id} should have exactly 1 key move`).toBe(1);
    }
  });

  it('hint square is a valid algebraic square', () => {
    for (const p of DATA.puzzles) {
      expect(p.hintSquare ?? '').toMatch(/^[a-h][1-8]$/);
    }
  });
});

describe('academy lessons are valid', () => {
  it('16 lessons, unique ids, unique order, 3 tracks', () => {
    expect(LESSONS.length).toBe(16);
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(16);
    expect(new Set(LESSONS.map(l => l.order)).size).toBe(16);
    expect(new Set(LESSONS.map(l => l.track))).toEqual(new Set(['basics', 'tactics', 'patterns']));
  });

  it('every accepted move in every step is legal in its FEN', () => {
    for (const l of LESSONS) {
      for (const [i, step] of l.steps.entries()) {
        if (step.kind !== 'move') continue;
        const pos = Position.fromFEN(step.fen);
        expect(pos.generateMoves().length, `${l.id} step ${i} should have legal moves`).toBeGreaterThan(0);
        for (const uci of step.accept) {
          const m = uciToMove(pos, uci);
          expect(m, `${l.id} step ${i}: accepted move ${uci} must be legal`).not.toBeNull();
        }
      }
    }
  });

  it('every step with goal=mate actually contains a mate-in-1 for the mover', () => {
    for (const l of LESSONS) {
      for (const [i, step] of l.steps.entries()) {
        if (step.kind !== 'move' || step.goal !== 'mate') continue;
        const pos = Position.fromFEN(step.fen);
        const sols = mateInMoves(pos, 1);
        expect(sols.length, `${l.id} step ${i} must contain at least one mating move`).toBeGreaterThanOrEqual(1);
        if (step.accept.length) {
          const acceptUcis = new Set(step.accept);
          for (const m of sols) expect(acceptUcis.has(moveToUci(m)), `${l.id}: mate ${moveToUci(m)} should be in accept list`).toBe(true);
        }
      }
    }
  });

  it('non-mate steps declare at least one accepted move', () => {
    for (const l of LESSONS) {
      for (const step of l.steps) {
        if (step.kind === 'move' && step.goal !== 'mate') {
          expect(step.accept.length, `${l.id} must accept something`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('localization parity', () => {
  it('ar.json and en.json have identical key sets', () => {
    expect(localeParity()).toEqual([]);
  });
});
