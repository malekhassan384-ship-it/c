/**
 * UCI protocol wrapper around an EXTERNAL Stockfish subprocess.
 * Communication is strictly line-based over stdin/stdout — the engine binary
 * is never linked into this process (GPL compliance, see THIRD_PARTY_LICENSES.md).
 */
import { spawn, ChildProcess } from 'node:child_process';

export interface EngineInfoLine {
  depth: number;
  multipv: number;
  scoreCp: number | null;   // centipawns, side-to-move POV
  scoreMate: number | null; // mate in N, side-to-move POV
  pv: string[];
}

export interface GoOptions {
  movetime?: number;
  depth?: number;
  skill?: number; // 0..20 (UCI_Skill)
}

export class UciEngineError extends Error {}

enum State { Idle, WaitUciok, WaitReadyok, Searching }

export class UciEngine {
  private proc: ChildProcess | null = null;
  private state: State = State.Idle;
  private buffer = '';
  private readonly name = 'unknown';

  private resolvers: {
    uciok?: () => void;
    readyok?: () => void;
    bestmove?: (m: string) => void;
  } = {};
  private rejecters: { uciok?: (e: Error) => void; readyok?: (e: Error) => void; bestmove?: (e: Error) => void } = {};

  onInfo: ((info: EngineInfoLine) => void) | null = null;
  onExit: ((code: number | null) => void) | null = null;

  constructor(private readonly binaryPath: string) {}

  async start(timeoutMs = 8000): Promise<{ name: string; author: string }> {
    this.proc = spawn(this.binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let name = 'unknown', author = 'unknown';
    const identify = (line: string) => {
      if (line.startsWith('id name ')) name = line.slice(8).trim();
      if (line.startsWith('id author ')) author = line.slice(10).trim();
    };
    this.proc.stdout!.setEncoding('utf-8');
    this.proc.stdout!.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        identify(line);
        this.handleLine(line);
      }
    });
    this.proc.stderr!.setEncoding('utf-8');
    this.proc.stderr!.on('data', () => { /* engine chatter on stderr is ignored */ });
    this.proc.on('exit', (code) => {
      this.state = State.Idle;
      const err = new UciEngineError(`engine exited with code ${code}`);
      this.rejecters.uciok?.(err);
      this.rejecters.readyok?.(err);
      this.rejecters.bestmove?.(err);
      this.onExit?.(code);
    });
    this.proc.on('error', (err) => {
      const e = new UciEngineError(`engine spawn error: ${err.message}`);
      this.rejecters.uciok?.(e);
      this.rejecters.readyok?.(e);
      this.rejecters.bestmove?.(e);
    });

    // handshake: create the uciok promise BEFORE sending 'uci'
    const uciok = new Promise<void>((resolve, reject) => {
      this.resolvers.uciok = resolve;
      this.rejecters.uciok = reject;
      setTimeout(() => reject(new UciEngineError('uciok timeout')), timeoutMs).unref?.();
    });
    this.send('uci');
    await uciok;
    this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 64');
    await this.isReady(5000);
    return { name, author };
  }

  private handleLine(line: string): void {
    if (line === 'uciok') { this.resolvers.uciok?.(); this.rejecters.uciok = undefined; return; }
    if (line === 'readyok') { this.resolvers.readyok?.(); this.rejecters.readyok = undefined; return; }
    if (line.startsWith('bestmove ')) {
      const move = line.split(/\s+/)[1] ?? '';
      this.state = State.Idle;
      this.resolvers.bestmove?.(move);
      this.rejecters.bestmove = undefined;
      return;
    }
    if (line.startsWith('info ') && this.onInfo) {
      const info = parseInfoLine(line);
      if (info) this.onInfo(info);
    }
  }

  private send(cmd: string): void {
    if (!this.proc?.stdin?.writable) throw new UciEngineError('engine stdin not writable');
    this.proc.stdin.write(cmd + '\n');
  }

  private isReady(timeoutMs: number): Promise<void> {
    this.state = State.WaitReadyok;
    const p = new Promise<void>((resolve, reject) => {
      this.resolvers.readyok = resolve;
      this.rejecters.readyok = reject;
      setTimeout(() => reject(new UciEngineError('isready timeout')), timeoutMs).unref?.();
    });
    this.send('isready');
    return p;
  }

  newGame(): void {
    this.send('ucinewgame');
    this.send('position startpos');
  }

  setPosition(fen: string | 'startpos', moves: string[] = []): void {
    const movesPart = moves.length ? ` moves ${moves.join(' ')}` : '';
    this.send(fen === 'startpos' ? `position startpos${movesPart}` : `position fen ${fen}${movesPart}`);
  }

  /**
   * Run a search. Resolves with bestmove (e.g. "e2e4"). Info lines are
   * delivered through onInfo while searching.
   */
  async go(opts: GoOptions, timeoutMs = 30000): Promise<string> {
    if (opts.skill !== undefined) this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.floor(opts.skill)))}`);
    await this.isReady(5000);
    this.state = State.Searching;
    const p = new Promise<string>((resolve, reject) => {
      this.resolvers.bestmove = resolve;
      this.rejecters.bestmove = reject;
      setTimeout(() => reject(new UciEngineError('go timeout')), timeoutMs).unref?.();
    });
    const parts: string[] = ['go'];
    if (opts.depth !== undefined) parts.push(`depth ${Math.floor(opts.depth)}`);
    if (opts.movetime !== undefined) parts.push(`movetime ${Math.floor(opts.movetime)}`);
    if (parts.length === 1) parts.push('depth 10'); // sane default
    this.send(parts.join(' '));
    return p;
  }

  stop(): void { try { this.send('stop'); } catch { /* already dead */ } }

  async quit(): Promise<void> {
    if (!this.proc || this.proc.exitCode !== null) return;
    const exited = new Promise<void>(r => { this.proc!.once('exit', () => r()); setTimeout(r, 2000).unref?.(); });
    try { this.send('quit'); } catch { this.kill(); }
    await exited;
  }

  kill(): void {
    try { this.proc?.kill('SIGKILL'); } catch { /* ignore */ }
  }

  get running(): boolean { return !!this.proc && this.proc.exitCode === null; }
}

/** Parse `info depth 12 ... score cp 34 ... pv e2e4 e7e5 ...` */
export function parseInfoLine(line: string): EngineInfoLine | null {
  const tokens = line.split(/\s+/);
  let depth = -1, multipv = 1;
  let scoreCp: number | null = null;
  let scoreMate: number | null = null;
  let pv: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'depth') depth = Number(tokens[++i]);
    else if (t === 'multipv') multipv = Number(tokens[++i]);
    else if (t === 'score') {
      const kind = tokens[++i];
      const v = Number(tokens[++i]);
      if (kind === 'cp') scoreCp = v;
      else if (kind === 'mate') scoreMate = v;
    } else if (t === 'pv') {
      pv = tokens.slice(i + 1);
      break;
    }
  }
  if (depth < 0 && scoreCp === null && scoreMate === null) return null;
  return { depth: Math.max(0, depth), multipv, scoreCp, scoreMate, pv };
}
