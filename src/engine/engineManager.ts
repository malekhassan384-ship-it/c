/**
 * EngineManager (main process): resolves the bundled Stockfish binaries from
 * resources (fixed paths — NEVER from user input), probes them in preference
 * order (AVX2 first, baseline fallback), and serializes analysis requests.
 */
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { UciEngine, EngineInfoLine, GoOptions } from './uciEngine';

export interface EngineIdentity { name: string; author: string; binary: string; }

export interface AnalyzeRequest {
  fen: string | 'startpos';
  moves: string[];
  go: GoOptions;
  token: number; // stale-response guard
}

export interface AnalyzeResult { token: number; bestmove: string; lastInfo: EngineInfoLine | null; }

export class EngineManager {
  private engine: UciEngine | null = null;
  private identity: EngineIdentity | null = null;
  private chain: Promise<unknown> = Promise.resolve(); // request serialization
  private currentToken = 0;
  private lastInfo: EngineInfoLine | null = null;

  onInfo: ((token: number, info: EngineInfoLine) => void) | null = null;

  get info(): EngineIdentity | null { return this.identity; }

  /** fixed candidate paths — no user input involved */
  private candidatePaths(): string[] {
    const base = app.isPackaged
      ? path.join(process.resourcesPath, 'engines')
      : path.join(app.getAppPath(), 'resources', 'engines');
    const plat = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
    let order: string[] = [];
    const manifestFile = path.join(base, 'manifest.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf-8')) as { preference?: string[] };
      if (manifest.preference?.length) order = manifest.preference.map(n => path.join(base, plat, n));
    } catch { /* fall back to conventional names */ }
    const ext = process.platform === 'win32' ? '.exe' : '';
    const conventional = [
      path.join(base, plat, `stockfish-x86-64-avx2${ext}`),
      path.join(base, plat, `stockfish-x86-64${ext}`)
    ];
    return [...order, ...conventional].filter((p, i, arr) => arr.indexOf(p) === i).filter(p => existsSync(p));
  }

  async ensureStarted(): Promise<EngineIdentity> {
    if (this.engine?.running && this.identity) return this.identity;
    await this.shutdown();
    const candidates = this.candidatePaths();
    if (!candidates.length) throw new Error('no engine binaries found in resources');
    let lastErr: unknown = null;
    for (const bin of candidates) {
      const e = new UciEngine(bin);
      try {
        const id = await e.start(6000);
        e.onInfo = info => { this.lastInfo = info; if (this.onInfo) this.onInfo(this.currentToken, info); };
        this.engine = e;
        this.identity = { ...id, binary: path.basename(bin) };
        e.newGame();
        return this.identity;
      } catch (err) {
        lastErr = err;
        await e.quit().catch(() => e.kill());
      }
    }
    throw new Error(`all engine candidates failed to start: ${String(lastErr)}`);
  }

  /** Queued analysis; stale tokens are ignored by the caller. */
  analyze(req: AnalyzeRequest, timeoutMs = 30000): Promise<AnalyzeResult> {
    const run = async (): Promise<AnalyzeResult> => {
      await this.ensureStarted();
      const engine = this.engine!;
      this.currentToken = req.token;
      this.lastInfo = null;
      engine.setPosition(req.fen, req.moves);
      const bestmove = await engine.go(req.go, timeoutMs);
      const token = this.currentToken;
      return { token, bestmove, lastInfo: this.lastInfo };
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  stop(): void { this.engine?.stop(); }

  async shutdown(): Promise<void> {
    if (this.engine) {
      await this.engine.quit().catch(() => this.engine?.kill());
      this.engine = null;
      this.identity = null;
    }
  }
}
