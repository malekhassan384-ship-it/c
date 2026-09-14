/** Renderer state: typed bridge, settings cache, i18n, tiny event bus. */
import { makeT, T, Locale } from '../localization/i18n';
import { DEFAULT_SETTINGS, AppSettings } from '../settings/settings';
import { configureAudio } from '../audio/synth';

export interface CvBridge {
  settings: { get(): Promise<AppSettings>; set(v: unknown): Promise<AppSettings> };
  history: { list(): Promise<GameRecordLite[]>; save(r: unknown): Promise<unknown>; remove(id: string): Promise<unknown> };
  progress: {
    get(): Promise<{ solvedPuzzles: string[]; completedLessons: string[]; puzzleStreak: number }>;
    puzzleSolved(p: unknown): Promise<unknown>;
    lessonCompleted(p: unknown): Promise<unknown>;
    reset(): Promise<unknown>;
  };
  achievements: {
    get(): Promise<{ unlocked: Record<string, string>; counters: Record<string, number>; defs: Array<{ id: string; icon: string; threshold: number; metric: string; ar: string; en: string }> }>;
    onUnlocked(cb: (ids: string[]) => void): () => void;
  };
  engine: { getInfo(): Promise<unknown>; analyze(p: unknown): Promise<unknown>; stop(): Promise<unknown> };
  app: { getMeta(): Promise<{ version: string; platform: string; copyright: string; developer: string }>; resetData(): Promise<boolean>; licenseNotice(): Promise<string>; ready(): void };
}

export interface GameRecordLite {
  id: string; finishedAt: string; playerColor: 'white' | 'black'; level: number;
  result: 'win' | 'loss' | 'draw'; reason: string; sanMoves: string[]; uciMoves: string[]; startFen: string;
}

declare global {
  interface Window { chessVanguard: CvBridge }
}

export const bridge = window.chessVanguard;

export interface AppState {
  settings: AppSettings;
  t: T;
  lang: Locale;
}

export const state: AppState = {
  settings: { ...DEFAULT_SETTINGS },
  t: makeT('ar'),
  lang: 'ar'
};

export function applySettings(s: AppSettings): void {
  state.settings = s;
  state.lang = s.language;
  state.t = makeT(s.language);
  document.documentElement.lang = s.language;
  document.documentElement.dir = s.language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.theme = s.theme;
  configureAudio({ enabled: s.soundEnabled, volume: s.soundVolume });
}

export async function loadInitialSettings(): Promise<void> {
  try {
    const s = await bridge.settings.get();
    applySettings(s);
  } catch {
    applySettings({ ...DEFAULT_SETTINGS });
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const next = await bridge.settings.set({ ...state.settings, ...patch });
  applySettings(next);
}

/** tiny event bus */
type Handler = (data?: unknown) => void;
const listeners = new Map<string, Set<Handler>>();
export function on(event: string, fn: Handler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)?.delete(fn);
}
export function emit(event: string, data?: unknown): void {
  listeners.get(event)?.forEach(fn => fn(data));
}

/** toast helper */
export function toast(msg: string, kind: '' | 'gold' | 'err' = ''): void {
  let wrap = document.querySelector('.toast-wrap') as HTMLElement | null;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/** modal helper — returns container appended to body */
export function openModal(title: string): { box: HTMLElement; close(): void } {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const box = document.createElement('div');
  box.className = 'card modal';
  const h = document.createElement('h2');
  h.textContent = title;
  box.appendChild(h);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const close = (): void => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { box, close };
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
