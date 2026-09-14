import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UciEngine, parseInfoLine } from '../../src/engine/uciEngine';

/**
 * REAL integration test against the actual Stockfish binary downloaded by
 * scripts/fetch-engine.mjs. Skipped only when the binary is genuinely absent
 * (CI runs `npm run fetch:engine` first — see workflows).
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LINUX_BIN = path.join(ROOT, 'resources', 'engines', 'linux', 'stockfish-x86-64-avx2');
const BIN = existsSync(LINUX_BIN) ? LINUX_BIN : execSync('command -v stockfish || true').toString().trim() || null;
const engine = BIN ? new UciEngine(BIN) : null;

describe('UCI wrapper vs REAL Stockfish subprocess', () => {
  beforeAll(async () => {
    if (!engine) return;
    const id = await engine.start();
    console.log(`[integration] engine id: ${id.name} | ${id.author} | binary: ${BIN}`);
  }, 30000);

  afterAll(async () => { await engine?.quit(); });

  it.skipIf(!engine)('handshake identifies Stockfish', async () => {
    const id = await engine!.start(8000).catch(() => ({ name: 'cached', author: 'cached' }));
    // start() was already done in beforeAll; this assertion re-checks identity availability
    expect(id.name.toLowerCase()).toContain('stockfish');
  }, 30000);

  it.skipIf(!engine)('bestmove for startpos is a legal UCI move', async () => {
    engine!.setPosition('startpos');
    const best = await engine!.go({ movetime: 400 }, 20000);
    expect(best).toMatch(/^[a-h][1-8][a-h][1-8][nbrq]?$/);
    console.log(`[integration] startpos bestmove=${best} @400ms`);
  }, 30000);

  it.skipIf(!engine)('finds mate-in-1 with a mate score (Scholar position)', async () => {
    // White to play Qxf7# (validated by our own rules engine in unit tests)
    engine!.setPosition('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    let sawMate = false;
    engine!.onInfo = (info) => { if (info.scoreMate !== null && info.scoreMate > 0) sawMate = true; };
    const best = await engine!.go({ movetime: 800 }, 20000);
    engine!.onInfo = null;
    expect(best).toBe('h5f7');
    expect(sawMate).toBe(true);
  }, 30000);

  it.skipIf(!engine)('honors skill level option and still returns a move', async () => {
    engine!.setPosition('startpos');
    const best = await engine!.go({ movetime: 200, skill: 1 }, 20000);
    expect(best).toMatch(/^[a-h][1-8][a-h][1-8][nbrq]?$/);
  }, 30000);
});

describe('info line parser (pure)', () => {
  it('parses cp score and pv', () => {
    const info = parseInfoLine('info depth 15 seldepth 21 multipv 1 score cp 34 nodes 123456 nps 1000000 tbhits 0 time 123 pv e2e4 e7e5 g1f3');
    expect(info).not.toBeNull();
    expect(info!.depth).toBe(15);
    expect(info!.scoreCp).toBe(34);
    expect(info!.scoreMate).toBeNull();
    expect(info!.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });
  it('parses mate score', () => {
    const info = parseInfoLine('info depth 12 score mate 3 pv h5f7');
    expect(info!.scoreMate).toBe(3);
    expect(info!.scoreCp).toBeNull();
    expect(info!.pv).toEqual(['h5f7']);
  });
  it('returns null for junk', () => {
    expect(parseInfoLine('info string hello')).toBeNull();
  });
});
