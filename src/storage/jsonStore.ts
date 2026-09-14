import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Atomic JSON persistence (main process). Writes tmp file + rename so a crash
 * can never corrupt data. One file per domain under the app's userData dir.
 */
export class JsonStore<T extends object> {
  private readonly file: string;
  private readonly def: T;
  private cache: T | null = null;

  constructor(dir: string, name: string, def: T) {
    this.file = path.join(dir, `${name}.json`);
    this.def = def;
  }

  async load(): Promise<T> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      const parsed = JSON.parse(raw) as T & { __version?: number };
      this.cache = { ...this.def, ...parsed };
    } catch {
      this.cache = { ...this.def };
    }
    return this.cache;
  }

  async save(data: T): Promise<void> {
    this.cache = data;
    const tmp = this.file + '.tmp';
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, this.file);
  }

  async update(patch: Partial<T>): Promise<T> {
    const cur = await this.load();
    const next = { ...cur, ...patch };
    await this.save(next);
    return next;
  }

  async clear(): Promise<void> {
    this.cache = null;
    try { await fs.unlink(this.file); } catch { /* not existing is fine */ }
  }
}

export function uuid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
